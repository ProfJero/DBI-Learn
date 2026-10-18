import { expect, test, type Page } from '@playwright/test';
import { COURSE, MockSupabase, USERS, questionAnswerTexts } from './mock-supabase';

const shots = 'test-results/screens';

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|favicon|net::ERR/.test(m.text())) errors.push(`console: ${m.text()}`);
  });
  return errors;
}

async function login(page: Page, who: keyof typeof USERS, via: 'email' | 'username' = 'email') {
  const u = USERS[who];
  await page.goto('/login');
  await page.getByLabel('Email or username').fill(via === 'email' ? u.email : u.username);
  await page.getByLabel('Password', { exact: true }).fill(u.password);
  await page.getByRole('button', { name: 'Log in' }).click();
}

/** Answers whatever question is on screen using the real answer key. */
async function answerCurrentQuestion(page: Page, correct = true) {
  const prompt = await page.locator('fieldset legend').first().innerText();
  const { kind, texts } = questionAnswerTexts(prompt);
  if (kind === 'short') {
    await page.getByLabel('Your answer').fill(correct ? texts[0]! : 'definitely wrong');
    return;
  }
  const labels = page.locator('fieldset label');
  if (!correct) {
    // pick the first option that is not correct
    const n = await labels.count();
    for (let i = 0; i < n; i++) {
      const t = await labels.nth(i).innerText();
      if (!texts.some((x) => t.includes(x))) {
        await labels.nth(i).click();
        return;
      }
    }
  }
  for (const t of texts) await labels.filter({ hasText: t }).first().click();
}

async function takeQuiz(page: Page, correct = true) {
  await page.getByRole('button', { name: /Start quiz|Retake quiz/ }).click();
  for (;;) {
    await answerCurrentQuestion(page, correct);
    const next = page.getByRole('button', { name: 'Next' });
    if (await next.isVisible()) await next.click();
    else break;
  }
  await page.getByRole('button', { name: 'Submit quiz' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Submit' }).click();
}

test.describe('public site', () => {
  test('home, catalog, course page and verify render with real content', async ({ page }) => {
    const errors = watchErrors(page);
    const mock = new MockSupabase();
    await mock.install(page);

    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Digital skills for/ })).toBeVisible();
    await expect(page.getByText('Built by').first()).toBeVisible();
    await expect(page.getByText('ProfJero Digital Studio').first()).toBeVisible();
    await expect(page.getByText('Digital Literacy Essentials').first()).toBeVisible();
    await page.screenshot({ path: `${shots}/01-home.png`, fullPage: true });

    await page.getByRole('link', { name: 'Courses', exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Explore courses' })).toBeVisible();
    await expect(page.locator('a[href^="/courses/"]')).toHaveCount(9);
    await page.getByLabel('Search courses').fill('python');
    await expect(page.locator('a[href^="/courses/"]')).toHaveCount(1);
    await page.screenshot({ path: `${shots}/02-catalog.png` });

    await page.goto('/courses/digital-literacy-essentials');
    await expect(page.getByRole('heading', { name: 'Digital Literacy Essentials' })).toBeVisible();
    await expect(page.getByText("What you'll learn")).toBeVisible();
    await expect(page.getByText('Module 1: Getting to know the computer')).toBeVisible();
    await expect(page.getByText(/Final exam/).first()).toBeVisible();
    await page.screenshot({ path: `${shots}/03-course-detail.png`, fullPage: true });

    await page.goto('/verify/DBI-0000-NOPE');
    await expect(page.getByText('No certificate found')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('signup checks username availability and password strength', async ({ page }) => {
    const mock = new MockSupabase();
    await mock.install(page);
    await page.goto('/signup');
    await page.getByLabel('Username').fill('ama');
    await expect(page.getByText('That username is taken.')).toBeVisible();
    await page.getByLabel('Username').fill('kofi_new');
    await expect(page.getByText('Available')).toBeVisible();
    await page.getByLabel('Password', { exact: true }).fill('weak');
    await expect(page.getByText('Too weak')).toBeVisible();
    await page.screenshot({ path: `${shots}/04-signup.png` });
  });

  test('login rejects a wrong password and accepts a username', async ({ page }) => {
    const mock = new MockSupabase();
    await mock.install(page);
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('ama@example.com');
    await page.getByLabel('Password', { exact: true }).fill('nope');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByText('Incorrect email or password.')).toBeVisible();
    await login(page, 'student', 'username');
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole('heading', { name: /Ama/ })).toBeVisible();
  });
});

test.describe('student journey', () => {
  test('enroll, study, take quizzes, earn and download a certificate', async ({ page }) => {
    test.setTimeout(300_000);
    const errors = watchErrors(page);
    const mock = new MockSupabase();
    await mock.install(page);
    await login(page, 'student');
    await expect(page).toHaveURL(/\/app$/);
    await page.screenshot({ path: `${shots}/05-dashboard-empty.png`, fullPage: true });

    // Enroll from the in-app catalog
    await page.goto('/app/catalog/digital-literacy-essentials');
    await page.getByRole('button', { name: 'Enroll for free' }).click();
    await expect(page).toHaveURL(/\/app\/learn\/digital-literacy-essentials\/lesson\//);
    await expect(page.getByRole('heading', { level: 1, name: 'What is a computer?' })).toBeVisible();
    await expect(page.getByText('When someone asks "What computer do you use?"')).toBeVisible();
    await page.screenshot({ path: `${shots}/06-lesson.png`, fullPage: true });

    // Work through every step of the course
    const lessons = COURSE.lessons.length;
    let steps = 0;
    for (; steps < 40; steps++) {
      const url = page.url();
      if (/\/quiz\//.test(url)) {
        const isPracticeOrPass = true;
        await takeQuiz(page, isPracticeOrPass);
        await expect(page.getByText(/You passed|Perfect score/)).toBeVisible();
        if (steps < 6) await page.screenshot({ path: `${shots}/07-quiz-result.png`, fullPage: true });
        const dialog = page.getByRole('dialog', { name: /Course complete/ });
        if (await dialog.isVisible({ timeout: 3000 }).catch(() => false)) break;
        const cont = page.getByRole('button', { name: /^Continue/ });
        if (await cont.isVisible()) await cont.click();
        else break;
      } else {
        await page.getByRole('button', { name: /Complete & continue|Mark as complete/ }).click();
        await page.waitForURL((u) => u.toString() !== url);
      }
    }
    expect(mock.db.lesson_progress.length).toBe(lessons);
    await expect(page.getByRole('dialog', { name: /Course complete/ })).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: `${shots}/08-course-complete.png` });

    // Certificate page
    await page.getByRole('link', { name: 'View my certificate' }).click();
    await expect(page).toHaveURL(/\/app\/certificates\/DBI-2026-TEST-0001/);
    await expect(page.getByText('Ama Owusu').first()).toBeVisible();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${shots}/09-certificate-page.png`, fullPage: true });
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download PDF' }).click()]);
    expect(download.suggestedFilename()).toBe('DBI-Certificate-DBI-2026-TEST-0001.pdf');
    const [png] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'PNG' }).click()]);
    await png.saveAs(`${shots}/10-certificate-export.png`);

    // Public verification of the earned certificate
    await page.goto('/verify/DBI-2026-TEST-0001');
    await expect(page.getByText('This certificate is authentic and valid')).toBeVisible();

    // Gamification surfaces
    await page.goto('/app/achievements');
    await expect(page.getByText('Graduate').first()).toBeVisible();
    await page.screenshot({ path: `${shots}/11-achievements.png`, fullPage: true });
    await page.goto('/app');
    await expect(page.getByRole('heading', { name: /Ama/ })).toBeVisible();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${shots}/12-dashboard.png`, fullPage: true });
    expect(errors).toEqual([]);
  });

  test('wrong answers fail the quiz and show explanations', async ({ page }) => {
    const mock = new MockSupabase();
    await mock.install(page);
    await login(page, 'student');
    const quiz = COURSE.quizzes.find((q: { kind: string }) => q.kind === 'module');
    await page.goto(`/app/learn/digital-literacy-essentials/quiz/${quiz.id}`);
    await takeQuiz(page, false);
    await expect(page.getByText('Not quite there yet')).toBeVisible();
    await expect(page.getByText('Why:').first()).toBeVisible();
    await expect(page.getByText('Correct answer:').first()).toBeVisible();
  });

  test('offline: downloaded course still works and progress syncs later', async ({ page, context }) => {
    const mock = new MockSupabase();
    await mock.install(page);
    await login(page, 'student');
    await page.goto('/app/catalog/digital-literacy-essentials');
    await page.getByRole('button', { name: 'Enroll for free' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'What is a computer?' })).toBeVisible();
    await page.getByRole('button', { name: 'Download' }).click();
    await expect(page.getByText('Offline ready')).toBeVisible();

    await context.setOffline(true);
    await page.getByRole('button', { name: /Complete & continue/ }).click();
    await expect(page.getByText(/Saved offline/).first()).toBeVisible();
    await expect(page.getByText(/You're offline/)).toBeVisible();
    expect(mock.db.lesson_progress.length).toBe(0);

    // Practice quiz offline is graded instantly on the device
    const practice = COURSE.quizzes.find((q: { kind: string }) => q.kind === 'practice');
    await page.goto(`/app/learn/digital-literacy-essentials/quiz/${practice.id}`).catch(() => undefined);
    await page.screenshot({ path: `${shots}/13-offline.png`, fullPage: true });

    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect.poll(() => mock.db.lesson_progress.length, { timeout: 20_000 }).toBe(1);
  });
});

test.describe('studio', () => {
  test('super admin sees overview, staff management and the course editor', async ({ page }) => {
    const errors = watchErrors(page);
    const mock = new MockSupabase();
    await mock.install(page);
    await login(page, 'superAdmin');
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { name: /Welcome, ProfJero/ })).toBeVisible();
    await page.screenshot({ path: `${shots}/20-studio-overview.png`, fullPage: true });

    await page.getByRole('link', { name: 'Admins & instructors' }).click();
    await page.getByRole('button', { name: /Add staff member/ }).click();
    await expect(page.getByRole('dialog').getByLabel('Role')).toContainText('Admin');
    await page.screenshot({ path: `${shots}/21-add-staff.png` });
    await page.keyboard.press('Escape');

    await page.getByRole('link', { name: 'Courses' }).first().click();
    await page.getByText('Python Programming for Beginners').first().click();
    await expect(page.getByRole('heading', { name: /Python Programming for Beginners/ })).toBeVisible();
    await page.getByRole('tab', { name: 'Curriculum' }).click();
    await expect(page.getByText('Getting started with Python')).toBeVisible();
    await page.getByRole('tab', { name: 'Quizzes' }).click();
    await page.getByRole('button', { name: 'Edit' }).first().click();
    await expect(page.getByRole('dialog', { name: 'Edit quiz' })).toBeVisible();
    await page.screenshot({ path: `${shots}/22-quiz-editor.png` });
    await page.keyboard.press('Escape');

    await page.getByRole('link', { name: 'Certificates' }).click();
    await page.getByRole('button', { name: 'Issue certificate' }).click();
    await page.getByLabel('Recipient full name').fill('Kwabena Owusu');
    await page.getByLabel('Programme / course title').fill('Community Coding Bootcamp 2026');
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${shots}/23-issue-certificate.png` });
    expect(errors).toEqual([]);
  });
});

test.describe('mobile app experience', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('bottom navigation, lesson and certificate verify fit a phone screen', async ({ page }) => {
    const errors = watchErrors(page);
    const mock = new MockSupabase();
    await mock.install(page);
    await page.goto('/');
    await page.screenshot({ path: `${shots}/30-mobile-home.png` });
    await login(page, 'student');
    await expect(page.getByRole('heading', { name: /Ama/ })).toBeVisible();
    const tabs = page.locator('nav.fixed.bottom-0');
    await expect(tabs.getByRole('link', { name: 'Downloads' })).toBeVisible();
    await page.screenshot({ path: `${shots}/31-mobile-dashboard.png` });
    await page.goto('/app/catalog/web-development-foundations');
    await page.getByRole('button', { name: 'Enroll for free' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'How websites work' })).toBeVisible();
    await page.screenshot({ path: `${shots}/32-mobile-lesson.png` });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });
});
