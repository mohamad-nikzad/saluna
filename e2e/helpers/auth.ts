import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export const SEEDED_MANAGER = { phone: '09120000000', password: 'admin123' }
export const SEEDED_STAFF = { phone: '09120000001', password: 'admin123' }
const OTP_BYPASS_CODE = '123456'

export async function login(
  page: Page,
  phone: string,
  password: string,
  salonName?: string,
) {
  await page.goto('/auth')
  await expect(
    page.getByRole('heading', { name: /سالونا|آراویرا/ }),
  ).toBeVisible()
  const phoneBox = page.getByRole('textbox', { name: 'شماره موبایل' })
  await phoneBox.click()
  await phoneBox.fill(phone)
  await page.getByRole('button', { name: 'ادامه' }).click()
  const passBox = page.getByRole('textbox', { name: 'رمز عبور' })
  await expect(passBox).toBeVisible()
  await passBox.click()
  await passBox.fill(password)
  await page.getByRole('button', { name: 'ورود', exact: true }).click()
  await page.waitForURL(/\/(today|dashboard|calendar|select-salon)/, {
    timeout: 30_000,
  })
  if (page.url().includes('/select-salon')) {
    await page
      .getByRole('button', { name: salonName ?? /سالن/ })
      .first()
      .click()
    await page.waitForURL(/\/(today|dashboard|calendar)/, { timeout: 30_000 })
  }
}

export async function loginManagerExpectsToday(page: Page) {
  await login(page, SEEDED_MANAGER.phone, SEEDED_MANAGER.password)
  await expect(page).toHaveURL(/\/today/)
  await expect(page.getByText('نوبت‌های امروز').first()).toBeVisible()
}

export async function loginManagerExpectsCalendar(page: Page) {
  await loginManagerExpectsToday(page)
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'تقویم' })
    .click()
  await expect(page).toHaveURL(/\/calendar/)
  await expect(page.locator('.calendar-header-gradient')).toBeVisible()
}

export async function loginStaffExpectsToday(page: Page) {
  await login(page, SEEDED_STAFF.phone, SEEDED_STAFF.password, 'سالن آراویرا')
  await expect(page).toHaveURL(/\/today/)
  await expect(page.getByText('الان و بعدی')).toBeVisible()
}

export async function logoutFromSettings(page: Page) {
  await page.goto('/settings')
  await page.getByRole('button', { name: /خروج از حساب/ }).click()
  await expect(page).toHaveURL(/\/auth/)
}

export async function signupNewSalon(
  page: Page,
  input: {
    phone: string
    salonLabel: string
    managerName: string
    password: string
  },
) {
  await page.context().clearCookies()
  await page.goto('/auth', { waitUntil: 'domcontentloaded' })

  await page.getByRole('textbox', { name: 'شماره موبایل' }).fill(input.phone)
  await page.getByRole('button', { name: 'ادامه' }).click()
  await expect(
    page.getByRole('button', { name: 'تایید و ادامه ثبت‌نام' }),
  ).toBeVisible()
  await page.locator('#otp').click()
  await page.keyboard.type(OTP_BYPASS_CODE)
  await expect(page.locator('#managerName')).toBeVisible()

  await page.locator('#managerName').fill(input.managerName)
  await page.locator('#password').fill(input.password)
  await page.locator('#confirmPassword').fill(input.password)
  await page.getByRole('button', { name: 'ادامه' }).click()

  await page.locator('#salonName').fill(input.salonLabel)
  const signupPost = page.waitForResponse(
    (r) =>
      /\/api\/(v\d+\/)?auth\/signup\/workspace/.test(r.url()) &&
      r.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'ساخت سالن' }).click()
  const res = await signupPost
  expect(res.ok(), await res.text()).toBeTruthy()
  await expect(page).toHaveURL(/\/onboarding\/welcome/)
}
