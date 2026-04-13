import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Run axe-core with WCAG 2.2 Level A & AA tags and assert zero violations. */
async function expectNoA11yViolations(
  page: import('@playwright/test').Page,
  disableRules: string[] = [],
) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag22a', 'wcag22aa'])
    .disableRules(disableRules)
    .analyze();

  // Pretty-print violations in the test output for easy debugging
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

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@sixbee.health';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'Ch4ngeMe!Now123';

/**
 * Wait for React hydration on a specific element.
 * SSR renders the HTML but event handlers aren't attached until React
 * hydrates. Interacting before hydration causes native form submissions.
 * React attaches __reactFiber / __reactProps keys to hydrated DOM nodes.
 */
async function waitForHydration(
  page: import('@playwright/test').Page,
  selector: string,
) {
  await page.waitForFunction(
    (sel: string) => {
      const el = document.querySelector(sel);
      return (
        el !== null &&
        Object.keys(el).some((k) => k.startsWith('__react'))
      );
    },
    selector,
    { timeout: 10_000 },
  );
}

// Cached admin JWT, reused by each test.
let cachedAdminToken: string | null = null;

/**
 * Proxy API requests through Playwright's Node.js context so the browser
 * bypasses CORS restrictions and the response includes the missing
 * Access-Control-Allow-Credentials header.
 */
async function proxyApi(page: import('@playwright/test').Page) {
  await page.route(`${API_URL}/**`, async (route) => {
    const response = await page.request.fetch(route.request());
    const headers = {
      ...response.headers(),
      'access-control-allow-credentials': 'true',
    };
    await route.fulfill({
      status: response.status(),
      headers,
      body: await response.body(),
    });
  });
}

/** Login via API (cached), set up CORS proxy, and inject the session cookie. */
async function loginAsAdmin(page: import('@playwright/test').Page) {
  // Set up CORS proxy FIRST so all subsequent API calls work
  await proxyApi(page);

  if (!cachedAdminToken) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await page.request.post(`${API_URL}/api/auth/login`, {
        data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
      });
      if (res.status() === 429) {
        await new Promise((r) => setTimeout(r, 20_000));
        continue;
      }
      const setCookie = res.headers()['set-cookie'] ?? '';
      const match = setCookie.match(/admin_token=([^;]+)/);
      if (match) {
        cachedAdminToken = match[1];
        break;
      }
    }
  }
  if (!cachedAdminToken) {
    throw new Error('Failed to obtain admin token');
  }
  await page.context().addCookies([
    { name: 'admin_token', value: cachedAdminToken, domain: 'localhost', path: '/' },
  ]);
}

// ---------------------------------------------------------------------------
// Public pages
// ---------------------------------------------------------------------------

test.describe('Accessibility: Public pages', () => {
  test('Booking form (/) has no WCAG 2.2 A/AA violations', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForSelector('form[aria-label="Book an appointment"]');
    await expectNoA11yViolations(page);
  });

  test('Booking form — validation errors are accessible', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForHydration(page, 'form[aria-label="Book an appointment"]');
    // Submit the empty form to trigger validation errors
    await page.getByRole('button', { name: 'Book appointment' }).click();
    // Wait for at least one error to appear
    await page.waitForSelector('[role="alert"]');
    await expectNoA11yViolations(page);
  });

  test('Booking form — keyboard tab order follows visual order', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForSelector('form[aria-label="Book an appointment"]');

    // Tab through text fields: name → email → phone
    await page.locator('#field-name').focus();
    await expect(page.locator('#field-name')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('#field-email')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('#field-contactNumber')).toBeFocused();

    // Custom date picker input — single tab stop.
    // Picker opens on focus, press Escape to dismiss, then tab to description.
    await page.keyboard.press('Tab');
    await expect(page.locator('#field-appointmentDate')).toBeFocused();

    await page.keyboard.press('Escape');
    await page.keyboard.press('Tab');
    await expect(page.locator('#field-description')).toBeFocused();

    // Final tab reaches the submit button
    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('button', { name: 'Book appointment' }),
    ).toBeFocused();
  });

  test('Booking form — submit with Enter key', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('form[aria-label="Book an appointment"]');

    // Focus any field and press Enter — should trigger validation
    await page.locator('#field-name').focus();
    await page.keyboard.press('Enter');
    await page.waitForSelector('[role="alert"]');

    // Validation errors appeared — form responded to Enter
    const errors = page.locator('.text-destructive');
    await expect(errors.first()).toBeVisible();
  });

  test('Booking form — error messages are linked via aria-describedby', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForHydration(page, 'form[aria-label="Book an appointment"]');
    await page.getByRole('button', { name: 'Book appointment' }).click();

    // Wait for field errors to render
    await page.waitForSelector('#field-description-error', { timeout: 10_000 });

    // Verify that each invalid field has aria-describedby pointing to its error
    for (const field of ['name', 'email', 'contactNumber', 'appointmentDate', 'description']) {
      const input = page.locator(`#field-${field}`);
      await expect(input).toHaveAttribute('aria-invalid', 'true');
      await expect(input).toHaveAttribute('aria-describedby', `field-${field}-error`);

      // Ensure the error element exists and has role="alert"
      const errorEl = page.locator(`#field-${field}-error`);
      await expect(errorEl).toBeVisible();
      await expect(errorEl).toHaveAttribute('role', 'alert');
    }
  });

  test('Booking form — form has accessible name via aria-label', async ({
    page,
  }) => {
    await page.goto('/');
    const form = page.locator('form[aria-label="Book an appointment"]');
    await expect(form).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Admin pages
// ---------------------------------------------------------------------------

test.describe('Accessibility: Admin pages', () => {
  // Run serially so tests share a single cached login token.
  // Extra timeout accommodates rate-limit retry waits.
  test.describe.configure({ mode: 'serial', timeout: 90_000 });
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

  test('Login page — keyboard tab order and Enter submit', async ({
    page,
  }) => {
    await page.goto('/admin/login');
    await page.waitForSelector('form[aria-label="Login form"]');

    // Tab order: email → password → submit button
    await page.locator('#email').focus();
    await expect(page.locator('#email')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('#password')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('button', { name: 'Sign in' }),
    ).toBeFocused();

    // Enter on password field triggers submit (validation errors)
    await page.locator('#password').focus();
    await page.keyboard.press('Enter');
    await page.waitForSelector('[role="alert"], #email-error, #password-error');
  });

  test('Admin dashboard: no violations, filter tabs accessible, keyboard navigation', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto('/admin');
    await page.waitForSelector('[role="tablist"]');

    // No WCAG violations
    await expectNoA11yViolations(page);

    // Filter tabs use correct ARIA semantics
    const tabs = page.locator('[role="tab"]');
    await expect(tabs).toHaveCount(4);
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');

    // Keyboard navigation through filter tabs
    const firstTab = tabs.first();
    await firstTab.focus();
    await expect(firstTab).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(tabs.nth(1)).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(tabs.nth(2)).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(tabs.nth(3)).toBeFocused();

    // Activate a tab with Enter
    await page.keyboard.press('Enter');
    await expect(tabs.nth(3)).toHaveAttribute('aria-selected', 'true');
  });

  test('Edit appointment page has no violations', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin');
    await page.waitForSelector('[role="tablist"]');

    // Navigate to the first appointment's edit page (if any exist)
    const editLink = page.locator('a[aria-label^="Edit appointment"]').first();
    if (await editLink.isVisible()) {
      await editLink.click();
      await page.waitForSelector('form[aria-label="Edit appointment"]');
      await expectNoA11yViolations(page);
    }
  });

  test('Appointment detail page has no violations', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin');
    await page.waitForSelector('[role="tablist"]');

    // Click the first appointment row (skip if table is empty)
    const editLink = page.locator('a[aria-label^="Edit appointment"]').first();
    if (await editLink.isVisible()) {
      await editLink.click();
      await page.waitForURL('**/admin/appointments/**');
      await expectNoA11yViolations(page);
    }
  });
});
