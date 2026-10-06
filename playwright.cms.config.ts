import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e/cms',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report/cms' }],
  ],
  outputDir: 'test-results/cms',
  use: {
    baseURL: 'http://localhost:3303',
    actionTimeout: 15_000,
    ...devices['Desktop Chrome'],
    ...(process.env.PLAYWRIGHT_SYSTEM_BROWSER === 'chrome'
      ? { channel: 'chrome' }
      : {}),
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? {
          launchOptions: {
            executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
          },
        }
      : {}),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'node scripts/cms-e2e-server.mjs',
    url: 'http://localhost:3303/_emdash/api/setup/status',
    reuseExistingServer: false,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
    timeout: 180_000,
  },
})
