import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Run axe-core with WCAG 2.2 Level A & AA tags and assert zero violations. */
async function expectNoA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag22a', 'wcag22aa'])
    .analyze();

  const violations = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    description: v.description,
    helpUrl: v.helpUrl,
    nodes: v.nodes.length,
    targets: v.nodes.slice(0, 3).map((n) => n.target),
  }));

  expect(violations, 'Accessibility violations found').toEqual([]);
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@sixbee.health';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'Ch4ngeMe!Now123';

/**
 * Wait for React hydration on a specific element.
 * React attaches __reactFiber / __reactProps keys to hydrated DOM nodes.
 */
async function waitForHydration(page: Page, selector: string) {
  await page.waitForFunction(
    (sel: string) => {
      const el = document.querySelector(sel);
      return el !== null && Object.keys(el).some((k) => k.startsWith('__react'));
    },
    selector,
    { timeout: 10_000 },
  );
}

// ---------------------------------------------------------------------------
// Public pages
// ---------------------------------------------------------------------------

test.describe('Accessibility: Public pages', () => {
  test('Booking form (/) has no WCAG 2.2 A/AA violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('form[aria-label="Book an appointment"]');
    await expectNoA11yViolations(page);
  });

  test('Booking form — validation errors are accessible', async ({ page }) => {
    await page.goto('/');
    await waitForHydration(page, 'form[aria-label="Book an appointment"]');
    await page.getByRole('button', { name: 'Book appointment' }).click();
    await page.waitForSelector('[role="alert"]');
    await expectNoA11yViolations(page);
  });

  test('Booking form — keyboard tab order follows visual order', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('form[aria-label="Book an appointment"]');

    await page.locator('#field-name').focus();
    await expect(page.locator('#field-name')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#field-email')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#field-contactNumber')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#field-appointmentDate')).toBeFocused();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Tab');
    await expect(page.locator('#field-description')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Book appointment' })).toBeFocused();
  });

  test('Booking form — submit with Enter key', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('form[aria-label="Book an appointment"]');
    await page.locator('#field-name').focus();
    await page.keyboard.press('Enter');
    await page.waitForSelector('[role="alert"]');
    await expect(page.locator('.text-destructive').first()).toBeVisible();
  });

  test('Booking form — error messages are linked via aria-describedby', async ({ page }) => {
    await page.goto('/');
    await waitForHydration(page, 'form[aria-label="Book an appointment"]');
    await page.getByRole('button', { name: 'Book appointment' }).click();
    await page.waitForSelector('#field-description-error', { timeout: 10_000 });

    for (const field of ['name', 'email', 'contactNumber', 'appointmentDate', 'description']) {
      const input = page.locator(`#field-${field}`);
      await expect(input).toHaveAttribute('aria-invalid', 'true');
      await expect(input).toHaveAttribute('aria-describedby', `field-${field}-error`);
      await expect(page.locator(`#field-${field}-error`)).toBeVisible();
      await expect(page.locator(`#field-${field}-error`)).toHaveAttribute('role', 'alert');
    }
  });

  test('Booking form — form has accessible name via aria-label', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('form[aria-label="Book an appointment"]')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Admin login page (no auth needed)
// ---------------------------------------------------------------------------

test.describe('Accessibility: Admin login page', () => {
  test('Login page (/admin/login) has no violations', async ({ page }) => {
    await page.goto('/admin/login');
    await page.waitForSelector('form[aria-label="Login form"]');
    await expectNoA11yViolations(page);
  });

  test('Login page — validation errors are accessible', async ({ page }) => {
    await page.goto('/admin/login');
    await waitForHydration(page, 'form[aria-label="Login form"]');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForSelector('[role="alert"], #email-error, #password-error');
    await expectNoA11yViolations(page);
  });

  test('Login page — keyboard tab order and Enter submit', async ({ page }) => {
    await page.goto('/admin/login');
    await page.waitForSelector('form[aria-label="Login form"]');

    await page.locator('#email').focus();
    await expect(page.locator('#email')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#password')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeFocused();

    await page.locator('#password').focus();
    await page.keyboard.press('Enter');
    await page.waitForSelector('[role="alert"], #email-error, #password-error');
  });
});

// ---------------------------------------------------------------------------
// Admin dashboard (authenticated — single page to avoid cookie/CORS issues)
// ---------------------------------------------------------------------------

test.describe('Accessibility: Admin dashboard', () => {
  test('Admin dashboard: violations, filter tabs, keyboard navigation, sub-pages', async ({ page }, testInfo) => {
    testInfo.setTimeout(60_000);
    // Log in through the UI — this is the only reliable way to set the
    // session cookie so the browser sends it on subsequent API requests.
    await page.goto('/admin/login');
    await waitForHydration(page, 'form[aria-label="Login form"]');
    await page.locator('#email').fill(ADMIN_EMAIL);
    await page.locator('#password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForSelector('[role="tablist"]', { timeout: 30_000 });

    // ── No WCAG violations on dashboard ──
    await expectNoA11yViolations(page);

    // ── Filter tabs have correct ARIA semantics ──
    const tabs = page.locator('[role="tab"]');
    await expect(tabs).toHaveCount(4);
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');

    // ── Keyboard navigation through filter tabs ──
    await tabs.first().focus();
    await expect(tabs.first()).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(tabs.nth(1)).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(tabs.nth(2)).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(tabs.nth(3)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(tabs.nth(3)).toHaveAttribute('aria-selected', 'true');

    // ── Edit appointment page (if appointments exist) ──
    await page.goto('/admin');
    await page.waitForSelector('[role="tablist"]');
    const editLink = page.locator('a[aria-label^="Edit appointment"]').first();
    if (await editLink.isVisible()) {
      await editLink.click();
      await page.waitForSelector('form[aria-label="Edit appointment"]');
      await expectNoA11yViolations(page);

      // ── Appointment detail page ──
      await page.goto('/admin');
      await page.waitForSelector('[role="tablist"]');
      await page.locator('a[aria-label^="Edit appointment"]').first().click();
      await page.waitForURL('**/admin/appointments/**');
      await expectNoA11yViolations(page);
    }
  });
});
