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

// ---------------------------------------------------------------------------
// Public pages — Booking form
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

    // Date/time input — the native datetime-local control may have multiple
    // internal tab stops (date segments, time segments, AM/PM).
    // Tab until we reach the description textarea.
    await page.keyboard.press('Tab');
    await expect(page.locator('#field-appointmentDate')).toBeFocused();

    // Tab past the datetime-local internal segments to reach description
    // Use a loop since different browsers expose different numbers of sub-fields
    let maxTabs = 10;
    while (maxTabs-- > 0) {
      await page.keyboard.press('Tab');
      if (await page.locator('#field-description').evaluate(
        (el) => el === document.activeElement,
      )) break;
    }
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
    await page.getByRole('button', { name: 'Book appointment' }).click();

    // Wait for field errors to render (5 fields, possibly 6+ alerts if a field has multiple validations)
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
