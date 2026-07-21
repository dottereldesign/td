import { defineConfig, devices } from '@playwright/test';

const stress = process.env.PERF_STRESS === '1';

export default defineConfig({
  testDir: './tests/performance',
  timeout: stress ? 90_000 : 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:4173',
    viewport: stress ? { width: 1440, height: 900 } : { width: 1280, height: 720 },
    deviceScaleFactor: stress ? 1.5 : 1,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'vite --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
});
