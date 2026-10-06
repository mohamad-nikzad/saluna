import { expect, test } from '@playwright/test'
import {
  loginManagerExpectsToday,
  loginStaffExpectsToday,
} from './helpers/auth'
import { tehranTodayYmd } from './helpers/date'

test('staff completes an assigned Appointment from its detail without Client contact details', async ({
  page,
}) => {
  await loginManagerExpectsToday(page)
  const date = tehranTodayYmd()
  const response = await page.request.get(
    `/api/v1/appointments?startDate=${date}&endDate=${date}`,
  )
  expect(response.ok()).toBeTruthy()
  const appointments = (await response.json()).appointments
  const appointment = appointments.find(
    (row: any) =>
      row.staff.phone === '09120000001' && !row.client.isPlaceholder,
  )
  expect(appointment).toBeTruthy()
  const reset = await page.request.patch(
    `/api/v1/appointments/${appointment.id}`,
    { data: { status: 'scheduled' } },
  )
  expect(reset.ok(), await reset.text()).toBeTruthy()
  await page.context().clearCookies()
  await loginStaffExpectsToday(page)
  const detailResponse = await page.request.get(
    `/api/v1/appointments/${appointment.id}`,
  )
  expect(detailResponse.ok()).toBeTruthy()
  const staffView = (await detailResponse.json()).appointment
  expect(staffView.client).toEqual({
    id: appointment.client.id,
    name: appointment.client.name,
    isPlaceholder: false,
  })
  expect(
    (
      await page.request.get(`/api/v1/clients/${appointment.client.id}`)
    ).status(),
  ).toBe(403)
  await page.goto(`/calendar?date=${date}&appointmentId=${appointment.id}`)
  await expect(page.getByRole('heading', { name: 'جزئیات نوبت' })).toBeVisible()
  await expect(
    page.getByText(appointment.client.name, { exact: true }).last(),
  ).toBeVisible()
  await expect(page.locator('a[href^="tel:"]')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'لغو شده', exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'ویرایش', exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByText('برای تماس با مشتری از مدیر سالن کمک بگیرید.'),
  ).toBeVisible()
  // Exercise failed writes through the same controls before retrying against the API.
  await page.route(
    `**/api/v1/appointments/${appointment.id}`,
    async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'ثبت وضعیت انجام نشد' }),
        })
      } else await route.continue()
    },
  )
  await page.getByRole('button', { name: 'انجام شده', exact: true }).click()
  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: /ثبت وضعیت انجام نشد|خطا/ })
      .first(),
  ).toBeVisible()
  await page.unroute(`**/api/v1/appointments/${appointment.id}`)
  const completed = page.waitForResponse(
    (r) =>
      r.url().includes(`/appointments/${appointment.id}`) &&
      r.request().method() === 'PATCH',
  )
  await page.getByRole('button', { name: 'انجام شده', exact: true }).click()
  const saved = await completed
  expect(saved.ok(), await saved.text()).toBeTruthy()
  expect((await saved.json()).appointment.client).not.toHaveProperty('phone')
  await expect(
    page.getByText('وضعیت نوبت ثبت شد.', { exact: true }),
  ).toBeVisible()
  await expect(page.locator('a[href^="tel:"]')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'تایید شده', exact: true }),
  ).toHaveCount(0)
  await page.context().clearCookies()
  await loginManagerExpectsToday(page)
  const corrected = await page.request.patch(
    `/api/v1/appointments/${appointment.id}`,
    { data: { status: 'scheduled' } },
  )
  expect(corrected.ok()).toBeTruthy()
  const history = (await corrected.json()).appointment.statusHistory
  expect(
    history
      .slice(-2)
      .map((entry: any) => [entry.previousStatus, entry.newStatus]),
  ).toEqual([
    ['scheduled', 'completed'],
    ['completed', 'scheduled'],
  ])
  await page.goto(`/calendar?date=${date}&appointmentId=${appointment.id}`)
  await expect(
    page.getByRole('region', { name: 'تاریخچه وضعیت' }),
  ).toBeVisible()
  await expect(page.locator('a[href^="tel:"]')).toHaveCount(1)
})
