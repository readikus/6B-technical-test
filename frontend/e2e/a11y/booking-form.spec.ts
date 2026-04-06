import { test, expect } from '@playwright/test';
import { runAxe, formatViolations } from './axe-helper';

test.describe('Booking form — WCAG 2.2 Level A & AA', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  // ── axe-core automated checks ─────────────────────────────

  test('has no axe-core violations on initial load', async ({ page }) => {
    // Arrange — page loaded in beforeEach

    // Act
    const violations = await runAxe(page);

    // Assert
    expect(violations, formatViolations(violations)).toHaveLength(0);
  });

  test('has no axe-core violations after triggering validation errors', async ({
    page,
  }) => {
    // Arrange — submit empty form to trigger all errors
    await page.getByRole('button', { name: /book appointment/i }).click();
    await expect(page.getByText('Name is required')).toBeVisible();

    // Act
    const violations = await runAxe(page);

    // Assert
    expect(violations, formatViolations(violations)).toHaveLength(0);
  });

  // ── WCAG 1.1.1: Non-text content ─────────────────────────

  test('all form inputs have associated labels', async ({ page }) => {
    // Arrange
    const inputs = page.locator('input, textarea');
    const count = await inputs.count();

    // Act & Assert
    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute('id');
      expect(id, `Input at index ${i} is missing an id`).toBeTruthy();

      const label = page.locator(`label[for="${id}"]`);
      await expect(label, `Input #${id} has no associated label`).toBeVisible();
    }
  });

  // ── WCAG 1.3.1: Info and Relationships ────────────────────

  test('error messages are programmatically associated with inputs via aria-describedby', async ({
    page,
  }) => {
    // Arrange — trigger validation errors
    await page.getByRole('button', { name: /book appointment/i }).click();
    await expect(page.getByText('Name is required')).toBeVisible();

    // Act & Assert — each input with an error should have aria-describedby
    const fieldsWithErrors = ['name', 'email', 'phone', 'description', 'appointmentDate'];

    for (const fieldName of fieldsWithErrors) {
      const input = page.locator(`#${fieldName}`);
      const describedBy = await input.getAttribute('aria-describedby');
      expect(
        describedBy,
        `Input #${fieldName} should have aria-describedby when in error state`,
      ).toBeTruthy();

      // The referenced element should exist and contain the error text
      const errorEl = page.locator(`#${describedBy}`);
      await expect(errorEl).toBeVisible();
    }
  });

  test('required fields are marked with aria-required', async ({ page }) => {
    // Arrange
    const requiredFields = ['name', 'email', 'phone', 'description', 'appointmentDate'];

    // Act & Assert
    for (const fieldName of requiredFields) {
      const input = page.locator(`#${fieldName}`);
      const ariaRequired = await input.getAttribute('aria-required');
      expect(
        ariaRequired,
        `#${fieldName} should have aria-required="true"`,
      ).toBe('true');
    }
  });

  // ── WCAG 1.3.5: Identify Input Purpose ────────────────────

  test('inputs have appropriate autocomplete attributes', async ({ page }) => {
    // Arrange & Act & Assert
    await expect(page.locator('#name')).toHaveAttribute('autocomplete', 'name');
    await expect(page.locator('#email')).toHaveAttribute('autocomplete', 'email');
    await expect(page.locator('#phone')).toHaveAttribute('autocomplete', 'tel');
  });

  // ── WCAG 1.4.3: Contrast (AA) ────────────────────────────
  // Handled by axe-core color-contrast rule in the automated scan above.

  // ── WCAG 2.1.1: Keyboard ─────────────────────────────────

  test('all form fields are reachable via Tab key', async ({ page }) => {
    // Arrange — simple text/email/tel fields first
    const simpleFields = ['name', 'email', 'phone'];

    // Act & Assert — tab through simple fields
    for (const fieldId of simpleFields) {
      await page.keyboard.press('Tab');
      const focused = page.locator(':focus');
      const id = await focused.getAttribute('id');
      expect(id, `Expected focus on #${fieldId}`).toBe(fieldId);
    }

    // Date input (read-only) then date picker trigger button
    await page.keyboard.press('Tab');
    await expect(page.locator('#appointmentDate')).toBeFocused();

    await page.keyboard.press('Tab');
    const triggerFocused = page.locator(':focus');
    await expect(triggerFocused).toHaveRole('button');

    // Description textarea
    await page.keyboard.press('Tab');
    await expect(page.locator('#description')).toBeFocused();

    // Submit button
    await page.keyboard.press('Tab');
    const submitFocused = page.locator(':focus');
    await expect(submitFocused).toHaveRole('button');
    await expect(submitFocused).toContainText('Book Appointment');
  });

  test('form can be submitted via Enter key', async ({ page }) => {
    // Arrange — focus on the submit button
    await page.getByRole('button', { name: /book appointment/i }).focus();

    // Act
    await page.keyboard.press('Enter');

    // Assert — validation errors appear (form was submitted)
    await expect(page.getByText('Name is required')).toBeVisible();
  });

  // ── WCAG 2.4.3: Focus Order ──────────────────────────────

  test('focus is visible on all interactive elements', async ({ page }) => {
    // Arrange
    const interactiveSelectors = [
      '#name',
      '#email',
      '#phone',
      '#appointmentDate',
      '#description',
      'button[type="submit"]',
    ];

    for (const selector of interactiveSelectors) {
      // Act — focus the element
      await page.locator(selector).focus();
      const el = page.locator(selector);

      // Assert — element has a visible focus indicator (outline or ring)
      const outlineStyle = await el.evaluate((node) => {
        const styles = window.getComputedStyle(node);
        return {
          outline: styles.outline,
          outlineWidth: styles.outlineWidth,
          boxShadow: styles.boxShadow,
        };
      });

      const hasFocusIndicator =
        outlineStyle.outlineWidth !== '0px' ||
        outlineStyle.boxShadow !== 'none';

      expect(
        hasFocusIndicator,
        `${selector} should have a visible focus indicator`,
      ).toBe(true);
    }
  });

  // ── WCAG 3.3.1: Error Identification ──────────────────────

  test('error messages clearly identify which field has the error', async ({
    page,
  }) => {
    // Arrange — submit empty form
    await page.getByRole('button', { name: /book appointment/i }).click();

    // Act & Assert — each error message is near its corresponding field
    const expectedErrors = [
      { field: 'name', error: 'Name is required' },
      { field: 'email', error: 'Email is required' },
      { field: 'phone', error: 'Phone number is required' },
      { field: 'description', error: 'Description is required' },
      { field: 'appointmentDate', error: 'Appointment date is required' },
    ];

    for (const { field, error } of expectedErrors) {
      // Error text should be visible
      await expect(page.getByText(error)).toBeVisible();

      // Error should be linked via aria-describedby
      const describedBy = await page.locator(`#${field}`).getAttribute('aria-describedby');
      expect(describedBy, `#${field} should have aria-describedby`).toBeTruthy();
      await expect(page.locator(`#${describedBy}`)).toContainText(error);
    }
  });

  // ── WCAG 3.3.2: Labels or Instructions ────────────────────

  test('all inputs have visible labels (not just placeholders)', async ({
    page,
  }) => {
    // Arrange
    const fields = ['name', 'email', 'phone', 'appointmentDate', 'description'];

    // Act & Assert
    for (const fieldId of fields) {
      const label = page.locator(`label[for="${fieldId}"]`);
      await expect(
        label,
        `#${fieldId} should have a visible label`,
      ).toBeVisible();
      const text = await label.textContent();
      expect(text?.trim().length, `Label for #${fieldId} should not be empty`).toBeGreaterThan(0);
    }
  });

  // ── WCAG 4.1.2: Name, Role, Value ────────────────────────

  test('inputs in error state have aria-invalid="true"', async ({ page }) => {
    // Arrange — trigger validation errors
    await page.getByRole('button', { name: /book appointment/i }).click();
    await expect(page.getByText('Name is required')).toBeVisible();

    // Act & Assert
    const errorFields = ['name', 'email', 'phone', 'description', 'appointmentDate'];
    for (const fieldId of errorFields) {
      const input = page.locator(`#${fieldId}`);
      await expect(
        input,
        `#${fieldId} should have aria-invalid when in error`,
      ).toHaveAttribute('aria-invalid', 'true');
    }
  });

  // ── ARIA DatePicker Dialog (WAI-APG pattern) ───────────────

  test('date picker dialog has correct ARIA attributes', async ({ page }) => {
    // Arrange — open the date picker
    await page.getByRole('button', { name: /choose date/i }).click();

    // Act
    const dialog = page.getByRole('dialog');

    // Assert
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog).toHaveAttribute('aria-label');
  });

  test('date picker grid has role="grid" with labelled month heading', async ({
    page,
  }) => {
    // Arrange
    await page.getByRole('button', { name: /choose date/i }).click();

    // Act
    const grid = page.getByRole('grid');
    const labelledBy = await grid.getAttribute('aria-labelledby');

    // Assert
    expect(labelledBy).toBeTruthy();
    const heading = page.locator(`#${labelledBy}`);
    await expect(heading).toBeVisible();
    await expect(heading).toHaveAttribute('aria-live', 'polite');
  });

  test('date picker has no axe-core violations', async ({ page }) => {
    // Arrange — open the picker
    await page.getByRole('button', { name: /choose date/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Act
    const violations = await runAxe(page);

    // Assert
    expect(violations, formatViolations(violations)).toHaveLength(0);
  });

  test('date picker closes on Escape and returns focus to trigger', async ({
    page,
  }) => {
    // Arrange
    const trigger = page.getByRole('button', { name: /choose date/i });
    await trigger.click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Act
    await page.keyboard.press('Escape');

    // Assert
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(trigger).toBeFocused();
  });

  test('date picker supports keyboard navigation (arrow keys)', async ({
    page,
  }) => {
    // Arrange — open picker
    await page.getByRole('button', { name: /choose date/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Act — press ArrowRight to move to next day
    const initialFocused = await page.evaluate(() => document.activeElement?.textContent);
    await page.keyboard.press('ArrowRight');
    const newFocused = await page.evaluate(() => document.activeElement?.textContent);

    // Assert — focus should have moved to a different day
    expect(newFocused).not.toBe(initialFocused);
  });

  test('selecting a date via Enter closes dialog and updates input', async ({
    page,
  }) => {
    // Arrange
    await page.getByRole('button', { name: /choose date/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Act — press Enter to select the focused date
    await page.keyboard.press('Enter');

    // Assert — dialog closes, input has a value
    await expect(page.getByRole('dialog')).not.toBeVisible();
    const input = page.locator('#appointmentDate');
    const val = await input.inputValue();
    expect(val.length).toBeGreaterThan(0);
  });
});
