import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:8000';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_SKIP_SERVER
    ? undefined
    : {
        command:
          'cd .. && HUB_MODEL_FALLBACK=distilbert-base-uncased-finetuned-sst-2-english RATE_LIMIT_ENABLED=False CACHE_ENABLED=False WANDB_MODE=disabled ./venv/bin/python backend/app.py',
        url: `${baseURL}/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
