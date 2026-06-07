import { copyFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

import { devices, expect, test } from '@playwright/test'

import { SEEDED_MANAGER, login } from './helpers/auth'

const OUT_DIR = path.join(
  process.cwd(),
  'apps/pwa/public/screenshots/bale',
)
const MANIFEST_SCREENSHOTS_DIR = path.join(
  process.cwd(),
  'apps/pwa/public/screenshots',
)

/** 9:16 phone viewport; @3x → 1080×1920 PNGs for Bale previews. */
const MOBILE_9_16 = {
  ...devices['Pixel 7'],
  viewport: { width: 360, height: 640 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
}

test.use(MOBILE_9_16)

async function hideDevUi(page: import('@playwright/test').Page) {
  await page.addStyleTag({
    content: `
      button[aria-label="Open TanStack Devtools"],
      img[alt="TanStack Devtools"] {
        display: none !important;
      }
    `,
  })
}

async function capturePageScreenshot(
  page: import('@playwright/test').Page,
  filename: string,
) {
  await hideDevUi(page)
  await page.screenshot({
    path: path.join(OUT_DIR, filename),
    fullPage: false,
  })
}

function syncManifestScreenshot(sourceFilename: string, manifestFilename: string) {
  copyFileSync(
    path.join(OUT_DIR, sourceFilename),
    path.join(MANIFEST_SCREENSHOTS_DIR, manifestFilename),
  )
}

test.describe('Bale bot preview screenshots', () => {
  test.describe.configure({ mode: 'serial' })

  test('capture 9:16 mobile PWA screens', async ({ page }) => {
    mkdirSync(OUT_DIR, { recursive: true })

    await login(page, SEEDED_MANAGER.phone, SEEDED_MANAGER.password)

    await test.step('today', async () => {
      await page.goto('/today')
      await expect(page).toHaveURL(/\/today/)
      await expect(page.getByText('نوبت‌های امروز')).toBeVisible()
      await page.waitForTimeout(800)
      await capturePageScreenshot(page, 'today.png')
    })

    await test.step('calendar', async () => {
      await page.goto('/calendar')
      await expect(page).toHaveURL(/\/calendar/)
      await expect(page.locator('.calendar-header-gradient')).toBeVisible()
      await page.waitForTimeout(800)
      await capturePageScreenshot(page, 'calendar.png')
      syncManifestScreenshot('calendar.png', 'manifest-calendar.png')
    })

    await test.step('requests', async () => {
      await page.goto('/requests')
      await expect(page).toHaveURL(/\/requests/)
      await expect(page.getByText('درخواست‌ها').first()).toBeVisible({
        timeout: 20_000,
      })
      await page.waitForTimeout(800)
      await capturePageScreenshot(page, 'requests.png')
    })

    await test.step('clients', async () => {
      await page.goto('/clients')
      await expect(page).toHaveURL(/\/clients/)
      await expect(page.getByText('مشتریان').first()).toBeVisible({
        timeout: 20_000,
      })
      await page.waitForTimeout(800)
      await capturePageScreenshot(page, 'clients.png')
      syncManifestScreenshot('clients.png', 'manifest-clients.png')
    })

    await test.step('settings — Bale connect', async () => {
      await page.goto('/settings')
      await expect(page.getByText('اعلان‌ها')).toBeVisible()
      const baleRow = page.getByText('اتصال بله')
      await baleRow.scrollIntoViewIfNeeded()
      await expect(baleRow).toBeVisible({ timeout: 20_000 })
      await page.waitForTimeout(500)
      await capturePageScreenshot(page, 'settings-bale.png')
    })
  })
})
