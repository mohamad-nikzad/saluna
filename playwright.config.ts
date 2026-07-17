import { defineConfig, devices } from '@playwright/test'

/**
 * E2E runs against a real PWA dev server + Postgres (seeded salon).
 *
 * - Start the app first: `pnpm --filter @repo/pwa dev` (needs root `.env.local`), then:
 *   `pnpm test:e2e`
 * - Or let Playwright start it (same env files must exist):
 *   `pnpm test:e2e` with E2E_SKIP_SERVER unset.
 * - Point elsewhere: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 pnpm test:e2e`
 *
 * **Use a browser already on your machine (skip `playwright install chromium`):**
 * - Google Chrome: set `PLAYWRIGHT_SYSTEM_BROWSER=chrome`.
 * - Chromium / another binary: set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to the real binary, e.g.
 *   macOS Homebrew cask: `/Applications/Chromium.app/Contents/MacOS/Chromium`
 */
function browserFromEnv(): Record<string, unknown> {
  const exe = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim()
  if (exe) {
    return { launchOptions: { executablePath: exe } }
  }
  const channel = process.env.PLAYWRIGHT_SYSTEM_BROWSER?.trim().toLowerCase()
  if (channel === 'chrome') return { channel: 'chrome' as const }
  if (channel === 'msedge') return { channel: 'msedge' as const }
  return {}
}

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  use: {
    // Match Vite's default host so cookies and dev tooling align with local usage.
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    locale: 'fa-IR',
    ...devices['Desktop Chrome'],
    ...browserFromEnv(),
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: {} }],
  webServer: process.env.E2E_SKIP_SERVER
    ? undefined
    : {
        command: 'pnpm dev:pwa',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        stdout: 'pipe',
        stderr: 'pipe',
      },
})
