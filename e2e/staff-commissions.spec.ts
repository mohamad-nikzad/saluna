import { expect, test } from '@playwright/test'

import {
  loginManagerExpectsToday,
  loginStaffExpectsToday,
} from './helpers/auth'
import { tehranTodayYmd } from './helpers/date'

type StaffRow = { id: string; name: string; phone: string }
type AppointmentRow = {
  id: string
  status: string
  client: { name: string }
  staff: { id: string }
}

test('manager configures a commission and both roles see the completed visit', async ({
  page,
}) => {
  await loginManagerExpectsToday(page)

  const staffResponse = await page.request.get('/api/v1/staff')
  expect(staffResponse.ok(), await staffResponse.text()).toBeTruthy()
  const staff = (
    (await staffResponse.json()) as { staff: StaffRow[] }
  ).staff.find((member) => member.phone === '09120000001')
  expect(staff).toBeTruthy()

  await test.step('Manager saves a prospective percentage', async () => {
    await page.goto('/staff')
    await page
      .getByRole('button')
      .filter({ has: page.getByText(staff!.name, { exact: true }) })
      .first()
      .click()
    const percentage = page.getByRole('textbox', {
      name: 'درصد کمیسیون',
    })
    await percentage.fill('12.5')
    await expect(percentage).toHaveValue('۱۲.۵')
    const saved = page.waitForResponse(
      (response) =>
        response.url().includes(`/commissions/staff/${staff!.id}/agreement`) &&
        response.request().method() === 'PUT',
    )
    await page
      .getByRole('button', { name: /فعال‌کردن توافق|ذخیره درصد جدید/ })
      .click()
    expect((await saved).ok()).toBeTruthy()
  })

  const today = tehranTodayYmd()
  const appointmentsResponse = await page.request.get(
    `/api/v1/appointments?startDate=${today}&endDate=${today}`,
  )
  expect(
    appointmentsResponse.ok(),
    await appointmentsResponse.text(),
  ).toBeTruthy()
  const appointment = (
    (await appointmentsResponse.json()) as { appointments: AppointmentRow[] }
  ).appointments.find(
    (row) => row.staff.id === staff!.id && row.client.name === 'دمو VIP امروز',
  )
  expect(appointment).toBeTruthy()

  if (appointment!.status === 'completed') {
    const reset = await page.request.patch(
      `/api/v1/appointments/${appointment!.id}`,
      { data: { status: 'scheduled' } },
    )
    expect(reset.ok(), await reset.text()).toBeTruthy()
  }

  await test.step('Completing the visit creates its commission snapshot', async () => {
    await page.goto('/today')
    await page.getByText('دمو VIP امروز', { exact: true }).first().click()
    const completed = page.waitForResponse(
      (response) =>
        response.url().includes(`/appointments/${appointment!.id}`) &&
        response.request().method() === 'PATCH',
    )
    await page.getByRole('button', { name: 'انجام شده' }).click()
    expect((await completed).ok()).toBeTruthy()
  })

  await test.step('Manager sees salon-retained and per-visit reporting', async () => {
    await page.goto('/commissions')
    await expect(
      page.getByRole('heading', { name: 'گزارش کمیسیون سالن' }),
    ).toBeVisible()
    await expect(
      page.getByText('مبلغ باقی‌مانده سالن', { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText('دمو VIP امروز', { exact: false }),
    ).toBeVisible()
  })

  await test.step('Dashboard separates completed value from the salon share', async () => {
    const response = await page.request.get('/api/v1/dashboard')
    expect(response.ok(), await response.text()).toBeTruthy()
    const dashboard = (await response.json()) as {
      monthSalonRetainedAmount?: number
    }
    expect(Number.isFinite(dashboard.monthSalonRetainedAmount)).toBeTruthy()

    await page.goto('/dashboard')
    await expect(
      page.getByText('جمع مبلغ نوبت‌های انجام‌شده', { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText('مبلغ باقی‌مانده سالن', { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText('مبلغ باقی‌مانده سالن', { exact: true }).locator('..'),
    ).toContainText(/[۰-۹][۰-۹٬]* تومان/)
    await expect(page.getByText(/ناعدد/)).toHaveCount(0)
  })

  await test.step('Staff sees only the private self-service report', async () => {
    await page.context().clearCookies()
    await loginStaffExpectsToday(page)
    await page.goto('/earnings')
    await expect(
      page.getByRole('heading', { name: 'کمیسیون من' }),
    ).toBeVisible()
    await expect(page.getByText('۱۲.۵٪', { exact: true })).toBeVisible()
    await expect(
      page.getByText('دمو VIP امروز', { exact: false }),
    ).toBeVisible()
    await expect(
      page.getByText('مبلغ باقی‌مانده سالن', { exact: true }),
    ).toHaveCount(0)
  })
})
