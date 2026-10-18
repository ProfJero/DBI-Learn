import { expect, test } from '@playwright/test';
import { MockSupabase, USERS } from './mock-supabase';

test.use({ serviceWorkers: 'allow' });

test('clicking through every nav link never blanks the page', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`${page.url()} :: ${e.message}`));
  // Newer Chrome returns a Promise from scrollTo; the app must not hand that to React as an effect cleanup.
  await page.addInitScript(() => {
    const original = window.scrollTo.bind(window) as (...a: unknown[]) => void;
    (window as unknown as { scrollTo: (...a: unknown[]) => Promise<void> }).scrollTo = (...args) => {
      original(...args);
      return Promise.resolve();
    };
  });
  const mock = new MockSupabase();
  await mock.install(page);
  await page.goto('/');
  for (const name of ['Courses', 'Verify certificate', 'About']) {
    await page.getByRole('navigation').getByRole('link', { name }).first().click();
    await page.waitForTimeout(600);
    await page.goBack();
    await page.waitForTimeout(400);
  }
  await page.getByRole('link', { name: /Start learning/ }).first().click();
  await page.waitForTimeout(500);
  await page.goto('/login');
  await page.getByLabel('Email or username').fill(USERS.student.email);
  await page.getByLabel('Password', { exact: true }).fill(USERS.student.password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/app$/);
  const links = await page.locator('aside nav a').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href')));
  for (const href of links) {
    await page.locator(`aside nav a[href="${href}"]`).first().click();
    await page.waitForTimeout(700);
    const text = await page.locator('#root').innerText();
    if (!text.trim()) errors.push(`blank page at ${href}`);
  }
  expect(errors).toEqual([]);
});
