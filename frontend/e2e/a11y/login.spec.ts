import { test, expect } from '@playwright/test';
import { runAxe, formatViolations } from './axe-helper';

test.describe('Login page — WCAG 2.2 Level A & AA', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/login');
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
    // Arrange — submit empty form
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText('Email is required')).toBeVisible();

    // Act
    const violations = await runAxe(page);

    // Assert
    expect(violations, formatViolations(violations)).toHaveLength(0);
  });

  // ── WCAG 1.3.1: Info and Relationships ────────────────────

  test('email and password inputs have associated labels', async ({ page }) => {
    // Arrange & Act & Assert
    const emailLabel = page.locator('label[for="email"]');
    const passwordLabel = page.locator('label[for="password"]');

    await expect(emailLabel).toBeVisible();
    await expect(emailLabel).toContainText('Email');
    await expect(passwordLabel).toBeVisible();
    await expect(passwordLabel).toContainText('Password');
  });

  test('error messages are associated with inputs via aria-describedby', async ({
    page,
  }) => {
    // Arrange — trigger errors
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText('Email is required')).toBeVisible();

    // Act & Assert
    for (const fieldId of ['email', 'password']) {
      const input = page.locator(`#${fieldId}`);
      const describedBy = await input.getAttribute('aria-describedby');
      expect(
        describedBy,
        `#${fieldId} should have aria-describedby in error state`,
      ).toBeTruthy();

      const errorEl = page.locator(`#${describedBy}`);
      await expect(errorEl).toBeVisible();
    }
  });

  // ── WCAG 2.1.1: Keyboard ─────────────────────────────────

  test('all fields reachable via Tab key in logical order', async ({ page }) => {
    // Arrange & Act
    await page.keyboard.press('Tab');
    await expect(page.locator('#email')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('#password')).toBeFocused();

    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toHaveRole('button');
  });

  test('form can be submitted via Enter key', async ({ page }) => {
    // Arrange
    await page.locator('#email').focus();

    // Act
    await page.keyboard.press('Enter');

    // Assert — validation error appears
    await expect(page.getByText('Email is required')).toBeVisible();
  });

  // ── WCAG 3.3.1: Error Identification ──────────────────────

  test('inputs in error state have aria-invalid="true"', async ({ page }) => {
    // Arrange — trigger errors
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText('Email is required')).toBeVisible();

    // Act & Assert
    await expect(page.locator('#email')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#password')).toHaveAttribute('aria-invalid', 'true');
  });

  // ── WCAG 1.3.5: Identify Input Purpose ────────────────────

  test('inputs have appropriate autocomplete attributes', async ({ page }) => {
    // Arrange & Act & Assert
    await expect(page.locator('#email')).toHaveAttribute('autocomplete', 'email');
    await expect(page.locator('#password')).toHaveAttribute(
      'autocomplete',
      'current-password',
    );
  });

  // ── WCAG 4.1.2: Name, Role, Value ────────────────────────

  test('password field has type="password" for assistive technology', async ({
    page,
  }) => {
    // Arrange & Act & Assert
    await expect(page.locator('#password')).toHaveAttribute('type', 'password');
  });

  // ── WCAG 2.4.2: Page Titled ───────────────────────────────

  test('page has a descriptive title', async ({ page }) => {
    // Arrange & Act
    const title = await page.title();

    // Assert
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(0);
  });
});
