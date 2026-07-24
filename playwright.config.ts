import { defineConfig, devices } from '@playwright/test';

const productionPreview = process.env.E2E_PRODUCTION === '1';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4187',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: productionPreview
      ? 'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4187'
      : 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4187',
    url: 'http://127.0.0.1:4187',
    reuseExistingServer: !process.env.CI,
  },
});
