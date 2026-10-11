import { expect, test } from '@playwright/test'

const token = 'a'.repeat(43)

test('Salon Handoff verifies OTP, validates the password, and enters manager app', async ({
  page,
}) => {
  await page.route(`**/api/v1/salon-handoff/${token}**`, async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (request.method() === 'GET') {
      await route.fulfill({
        json: {
          phone: '0912•••4567',
          expiresAt: '2026-06-24T12:00:00.000Z',
          requiresPassword: true,
        },
      })
      return
    }
    if (pathname.endsWith('/send-otp')) {
      await route.fulfill({ json: { status: true } })
      return
    }
    if (pathname.endsWith('/verify-otp')) {
      const body = request.postDataJSON() as { code: string }
      if (body.code === '000000') {
        await route.fulfill({
          status: 400,
          json: { error: 'کد تایید نامعتبر است', code: 'INVALID_OTP' },
        })
        return
      }
      await route.fulfill({ json: { status: true } })
      return
    }
    if (pathname.endsWith('/complete')) {
      expect(request.postDataJSON()).toEqual({
        displayName: 'سارا احمدی',
        password: 'safe-pass-123',
      })
      await route.fulfill({
        json: {
          salonId: 'salon-1',
          redirectTo: '/dashboard',
          publicEnabled: false,
        },
      })
      return
    }
    await route.abort()
  })
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      json: {
        status: 'ready',
        user: {
          id: 'owner-1',
          salonId: 'salon-1',
          name: 'سارا احمدی',
          role: 'manager',
          phone: '09121234567',
          createdAt: '2026-06-23T12:00:00.000Z',
          needsOnboarding: false,
          onboardingCompleted: true,
        },
      },
    }),
  )
  await page.route('**/api/v1/dashboard', (route) =>
    route.fulfill({
      json: {
        totalClients: 0,
        totalStaff: 0,
        todayAppointments: 0,
        weekAppointments: 0,
        monthAppointments: 0,
        todayStatusBreakdown: [],
        monthStatusBreakdown: [],
        popularServices: [],
        staffLoad: [],
        monthRevenue: 0,
        newClientsThisMonth: 0,
      },
    }),
  )

  await page.goto(`/handoff/${token}`)
  await expect(page.getByText('0912•••4567')).toBeVisible()
  await page.getByRole('button', { name: 'دریافت کد تایید' }).click()

  const otp = page.locator('input[autocomplete="one-time-code"]')
  await otp.fill('000000')
  await expect(page.getByText('کد واردشده درست نیست')).toBeVisible()
  await otp.fill('123456')
  await page.getByRole('button', { name: 'تایید شماره' }).click()

  await page.getByLabel('نام شما').fill('سارا احمدی')
  const password = page.getByLabel('رمز عبور', { exact: true })
  await password.fill('short')
  await page.getByLabel('تکرار رمز عبور').fill('short')
  await page.getByRole('button', { name: 'تحویل سالن و ورود' }).click()
  expect(
    await password.evaluate(
      (input) => !(input as HTMLInputElement).checkValidity(),
    ),
  ).toBe(true)

  await password.fill('safe-pass-123')
  await page.getByLabel('تکرار رمز عبور').fill('safe-pass-123')
  await page.getByRole('button', { name: 'تحویل سالن و ورود' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
})

test('Salon Handoff reuses an existing identity without asking for a new password', async ({
  page,
}) => {
  await page.route(`**/api/v1/salon-handoff/${token}**`, async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (request.method() === 'GET') {
      await route.fulfill({
        json: {
          phone: '0912•••4567',
          expiresAt: '2026-06-24T12:00:00.000Z',
          requiresPassword: false,
        },
      })
      return
    }
    if (pathname.endsWith('/send-otp') || pathname.endsWith('/verify-otp')) {
      await route.fulfill({ json: { status: true } })
      return
    }
    if (pathname.endsWith('/complete')) {
      expect(request.postDataJSON()).toEqual({
        displayName: 'سارا احمدی',
      })
      await route.fulfill({
        json: {
          salonId: 'salon-1',
          redirectTo: '/dashboard',
          publicEnabled: true,
        },
      })
      return
    }
    await route.abort()
  })
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      json: {
        status: 'ready',
        user: {
          id: 'owner-1',
          salonId: 'salon-1',
          name: 'سارا احمدی',
          role: 'manager',
          phone: '09121234567',
          createdAt: '2026-06-23T12:00:00.000Z',
          needsOnboarding: false,
          onboardingCompleted: true,
        },
      },
    }),
  )
  await page.route('**/api/v1/dashboard', (route) =>
    route.fulfill({
      json: {
        totalClients: 0,
        totalStaff: 0,
        todayAppointments: 0,
        weekAppointments: 0,
        monthAppointments: 0,
        todayStatusBreakdown: [],
        monthStatusBreakdown: [],
        popularServices: [],
        staffLoad: [],
        monthRevenue: 0,
        newClientsThisMonth: 0,
      },
    }),
  )

  await page.goto(`/handoff/${token}`)
  await page.getByRole('button', { name: 'دریافت کد تایید' }).click()
  const otp = page.locator('input[autocomplete="one-time-code"]')
  await otp.fill('123456')

  await expect(page.getByText('رمز عبورتان بدون تغییر می‌ماند')).toBeVisible()
  await expect(page.getByLabel('رمز عبور', { exact: true })).toHaveCount(0)
  await page.getByLabel('نام شما').fill('سارا احمدی')
  await page.getByRole('button', { name: 'تحویل سالن و ورود' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
})
