import { expect, test, type Page } from '@playwright/test';
import { COURSE, MockSupabase, USERS } from './mock-supabase';

const shots = 'test-results/screens';

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

async function login(page: Page, who: keyof typeof USERS) {
  const u = USERS[who];
  await page.goto('/login');
  await page.getByLabel('Email or username').fill(u.email);
  await page.getByLabel('Password', { exact: true }).fill(u.password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(who === 'student' ? /\/app$/ : /\/(app|admin)/);
}

/** Replaces the whole editor document, the way a learner would after selecting all. */
async function setCode(page: Page, code: string) {
  const editor = page.locator('.cm-content').first();
  await editor.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(code);
}

test.describe('Code Lab', () => {
  test('web challenge with Emmet, live checks and XP', async ({ page }) => {
    const errors = watchErrors(page);
    const mock = new MockSupabase();
    await mock.install(page);
    await login(page, 'student');

    await page.getByRole('link', { name: 'Practice Lab' }).first().click();
    await expect(page.getByRole('heading', { name: 'Practice Lab' })).toBeVisible();
    await page.screenshot({ path: `${shots}/30-practice-hub.png`, fullPage: true });

    await page.getByRole('link', { name: /Your first web page/ }).click();
    await expect(page.getByRole('heading', { name: 'Your first web page' })).toBeVisible();

    // Emmet: "h1" + Tab expands to a heading tag.
    const editor = page.locator('.cm-content').first();
    await editor.click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type('h1');
    await page.keyboard.press('Tab');
    await expect(editor).toContainText('<h1></h1>');
    await page.keyboard.type('Kofi Mensah');
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('p');
    await page.keyboard.press('Tab');
    await page.keyboard.type('I love football and coding.');

    await page.getByRole('button', { name: 'Run & check' }).click();
    await expect(page.getByText('Well done! Challenge complete.')).toBeVisible();
    await expect(page.getByText(/Challenge passed! \+10 XP/)).toBeVisible();
    expect(mock.db.practice_completions).toHaveLength(1);
    await expect(page.frameLocator('iframe[title="Web page preview"]').getByRole('heading', { name: 'Kofi Mensah' })).toBeVisible();
    await page.screenshot({ path: `${shots}/31-codelab-web.png` });
    expect(errors).toEqual([]);
  });

  test('JavaScript and SQL challenges are graded; failures show which check failed', async ({ page }) => {
    const errors = watchErrors(page);
    const mock = new MockSupabase();
    await mock.install(page);
    await login(page, 'student');

    await page.goto('/app/practice/challenge/js-sum');
    await setCode(page, 'function add(a, b) {\n  return a - b;\n}\nconsole.log(add(2, 3));');
    await page.getByRole('button', { name: 'Run & check' }).click();
    await expect(page.locator('pre').getByText('-1', { exact: true })).toBeVisible();
    await expect(page.getByText('Show a hint')).toBeVisible();
    expect(mock.db.practice_completions).toHaveLength(0);

    await setCode(page, 'function add(a, b) {\n  return a + b;\n}\nconsole.log(add(2, 3));');
    await page.getByRole('button', { name: 'Run & check' }).click();
    await expect(page.getByText('Well done! Challenge complete.')).toBeVisible();
    await expect(page.getByText(/Challenge passed! \+10 XP/)).toBeVisible();

    // Endless loops are stopped instead of freezing the page.
    await page.goto('/app/practice/code?lang=javascript');
    await setCode(page, 'while (true) {}');
    await page.getByRole('button', { name: 'Run', exact: true }).click();
    await expect(page.getByText(/Stopped after 8 seconds/)).toBeVisible({ timeout: 20_000 });

    await page.goto('/app/practice/challenge/sql-shs');
    await setCode(page, "SELECT name, class FROM students WHERE class LIKE 'SHS%' ORDER BY name;");
    await page.getByRole('button', { name: 'Run & check' }).click();
    await expect(page.getByRole('cell', { name: 'Abena Ofori' })).toBeVisible();
    await expect(page.getByText('Well done! Challenge complete.')).toBeVisible();
    await page.screenshot({ path: `${shots}/32-codelab-sql.png` });
    expect(mock.db.practice_completions.map((c) => c.challenge_id).sort()).toEqual(['js-sum', 'sql-shs']);
    expect(errors).toEqual([]);
  });

  test('extensions can be switched off and projects are saved on the device', async ({ page }) => {
    const mock = new MockSupabase();
    await mock.install(page);
    await login(page, 'student');
    await page.goto('/app/practice/code?lang=web');
    await page.getByRole('button', { name: 'Extensions' }).click();
    await expect(page.getByRole('dialog', { name: 'Extensions' })).toBeVisible();
    await page.screenshot({ path: `${shots}/33-codelab-extensions.png` });
    await page.getByRole('switch', { name: 'Emmet on' }).click();
    await expect(page.getByRole('switch', { name: 'Emmet off' })).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();

    await setCode(page, 'ul');
    await page.keyboard.press('Tab');
    await expect(page.locator('.cm-content').first()).not.toContainText('<ul>');

    await page.getByRole('button', { name: 'My projects' }).click();
    await page.getByLabel('Project name').fill('My first site');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Saved on this device')).toBeVisible();
    await expect(page).toHaveURL(/project=/);
    await page.reload();
    await expect(page.getByText('My first site').first()).toBeVisible();
  });
});

test.describe('Ask a teacher', () => {
  test('a learner asks privately from a lesson and an admin answers', async ({ page, browser }) => {
    const errors = watchErrors(page);
    const mock = new MockSupabase();
    await mock.install(page);
    await login(page, 'student');
    await page.goto(`/app/catalog/${COURSE.course.slug}`);
    await page.getByRole('button', { name: 'Enroll for free' }).click();
    await expect(page).toHaveURL(/\/lesson\//);

    await page.getByRole('button', { name: 'Ask a question' }).click();
    await page.getByLabel('Your question').fill('What is the difference between RAM and storage?');
    await page.getByRole('radio', { name: /Only my teachers/ }).click();
    await page.getByRole('button', { name: 'Send question' }).click();
    await expect(page).toHaveURL(/\/app\/questions\//);
    await expect(page.getByText('Private — only teachers')).toBeVisible();
    await expect(page.getByText('Waiting for a teacher')).toBeVisible();
    expect(mock.db.course_questions[0]).toMatchObject({ visibility: 'private', lesson_id: COURSE.lessons[0].id });

    const adminCtx = await browser.newContext();
    const admin = await adminCtx.newPage();
    await mock.install(admin);
    await login(admin, 'superAdmin');
    await admin.goto('/admin/questions');
    await admin.getByRole('link', { name: /RAM and storage/ }).click();
    await admin.getByLabel(/Answer as/).fill('RAM is short-term memory used while the computer is on. Storage keeps your files when it is off.');
    await admin.getByRole('button', { name: 'Send answer' }).click();
    await expect(admin.getByText('RAM is short-term memory')).toBeVisible();
    await admin.screenshot({ path: `${shots}/34-studio-question.png` });
    await adminCtx.close();

    await page.reload();
    await expect(page.getByText('Answered', { exact: true })).toBeVisible();
    await expect(page.getByText('RAM is short-term memory')).toBeVisible();
    await page.screenshot({ path: `${shots}/35-question-answered.png` });
    expect(mock.db.notifications.some((n) => n.user_id === USERS.student.id && n.title === 'Your question was answered')).toBe(true);
    expect(errors).toEqual([]);
  });
});

test.describe('JHS/SHS friendly', () => {
  test('first-visit tour, accessibility settings and read-aloud', async ({ page }) => {
    const errors = watchErrors(page);
    const mock = new MockSupabase();
    await mock.install(page, { tour: true });
    await login(page, 'student');
    const tour = page.getByRole('dialog');
    await expect(tour.getByText('Akwaaba to DBI Learn!')).toBeVisible();
    await page.screenshot({ path: `${shots}/36-welcome-tour.png` });
    for (let i = 0; i < 5; i++) await tour.getByRole('button', { name: 'Next' }).click();
    await tour.getByRole('button', { name: 'Find a course' }).click();
    await expect(page).toHaveURL(/\/app\/catalog/);
    await page.goto('/app');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.goto('/app/settings');
    await page.getByRole('radio', { name: /Extra large/ }).click();
    await page.getByRole('switch', { name: 'Easy-read font' }).click();
    await page.getByRole('switch', { name: 'Data saver' }).click();
    expect(await page.evaluate(() => document.documentElement.style.fontSize)).toBe('125%');
    await expect(page.locator('html')).toHaveClass(/easy-font/);
    await page.screenshot({ path: `${shots}/37-accessibility.png`, fullPage: true });
    await page.reload();
    expect(await page.evaluate(() => document.documentElement.style.fontSize)).toBe('125%');

    await page.goto(`/app/catalog/${COURSE.course.slug}`);
    await page.getByRole('button', { name: 'Enroll for free' }).click();
    await expect(page.getByRole('button', { name: 'Listen' })).toBeVisible();
    await page.screenshot({ path: `${shots}/38-lesson-large-text.png` });
    expect(errors).toEqual([]);
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true });
  test('Code Lab switches between task, code and output and has a symbol bar', async ({ page }) => {
    const errors = watchErrors(page);
    const mock = new MockSupabase();
    await mock.install(page);
    await login(page, 'student');
    await page.goto('/app/practice/challenge/web-list');
    await expect(page.getByRole('heading', { name: 'Favourite foods list' })).toBeVisible();
    await page.screenshot({ path: `${shots}/40-phone-task.png` });
    await page.getByRole('tab', { name: 'Code' }).click();
    await page.locator('.cm-content').first().click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.getByRole('button', { name: '<', exact: true }).click();
    await expect(page.locator('.cm-content').first()).toContainText('<>');
    await page.screenshot({ path: `${shots}/41-phone-code.png` });
    await page.getByRole('button', { name: 'Run & check' }).click();
    await expect(page.getByRole('tab', { name: /Preview/ })).toHaveAttribute('aria-selected', 'true');
    await page.screenshot({ path: `${shots}/42-phone-output.png` });
    expect(errors).toEqual([]);
  });
});
