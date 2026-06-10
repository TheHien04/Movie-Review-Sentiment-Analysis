import { test, expect } from '@playwright/test';

test.describe('CineSentiment browser E2E', () => {
  test('home page loads cinema brand', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page.locator('.brand-name')).toContainText('CineSentiment');
  });

  test('batch analyze page has textarea', async ({ page }) => {
    await page.goto('/batch.html');
    await expect(page.locator('#review-text, textarea').first()).toBeVisible();
  });

  test('health API returns JSON', async ({ request }) => {
    const res = await request.get('/health');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe('healthy');
  });

  test('predict API returns sentiment', async ({ request }) => {
    const res = await request.post('/api/predict', {
      data: { text: 'An absolutely wonderful film with great acting.' },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.sentiment).toMatch(/positive|negative/i);
    expect(body.confidence).toBeGreaterThan(0);
  });

  test('modern UI or classic fallback', async ({ page }) => {
    const res = await page.goto('/modern/');
    expect(res?.status()).toBeLessThan(500);
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });
});
