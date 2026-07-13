import { expect, test } from '@playwright/test'

import { loginManagerExpectsCalendar } from './helpers/auth'

test.use({
  hasTouch: true,
  isMobile: true,
  reducedMotion: 'reduce',
  viewport: { width: 393, height: 852 },
})

test('appointment detail stays closed after a touch dismissal', async ({
  page,
}) => {
  await loginManagerExpectsCalendar(page)
  await page.getByRole('button', { name: 'لیست', exact: true }).tap()
  await page
    .getByText(/دمو VIP امروز/)
    .first()
    .tap()

  const drawer = page.getByRole('dialog', { name: 'جزئیات نوبت' })
  await expect(drawer).toBeVisible()
  await drawer.getByRole('button', { name: 'بستن' }).first().tap()
  await expect(drawer).toBeHidden()
  await page.waitForTimeout(500)
  await expect(drawer).toBeHidden()
})

test('new appointment X removes the closed form sheet', async ({ page }) => {
  await loginManagerExpectsCalendar(page)
  await page.getByLabel('نوبت جدید').tap()

  const dialog = page.getByRole('dialog', { name: 'ثبت نوبت' })
  const sheet = page.locator('[data-slot="form-sheet-content"]')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'بستن' }).tap()

  await expect(sheet).toHaveCount(0)
})
