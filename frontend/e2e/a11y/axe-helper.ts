import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

/**
 * Run axe-core against the page targeting WCAG 2.2 Level A and AA.
 * Returns the violations array for assertions.
 */
export async function runAxe(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag22a', 'wcag22aa'])
    .analyze();

  return results.violations;
}

/** Format violations for readable test failure output. */
export function formatViolations(
  violations: Awaited<ReturnType<typeof runAxe>>,
): string {
  return violations
    .map(
      (v) =>
        `[${v.id}] ${v.description} (${v.impact})\n` +
        v.nodes.map((n) => `  → ${n.html}`).join('\n'),
    )
    .join('\n\n');
}
