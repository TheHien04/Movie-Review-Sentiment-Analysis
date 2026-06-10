import { test, expect } from '@playwright/test';

test.describe('Evaluation view detail buttons', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/evaluation.html');
    await page.waitForSelector('#summary-box .summary-value', { timeout: 120_000 });
  });

  test('View Metrics Details opens modal', async ({ page }) => {
    await page.locator('#metrics-detail-btn').click();
    const modal = page.locator('#cine-eval-detail-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await expect(modal.locator('#cine-eval-detail-title')).toContainText(/metrics/i);
    await expect(modal.locator('.cm-table')).toBeVisible();
  });

  test('View Confusion Matrix Details opens modal', async ({ page }) => {
    await page.locator('#cm-detail-btn').click();
    await expect(page.locator('#cine-eval-detail-modal')).toBeVisible();
  });

  test('View Label Distribution opens modal', async ({ page }) => {
    await page.locator('#label-detail-btn').click();
    await expect(page.locator('#cine-eval-detail-modal')).toBeVisible();
  });
});
