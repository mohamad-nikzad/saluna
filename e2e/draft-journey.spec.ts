import { test, expect, type Page } from '@playwright/test'
import {
  JALALI_MONTHS,
  JALALI_WEEKDAYS_SHORT,
  parseGregorianToJalali,
} from '../packages/salon-core/src/jalali'
import { apiPathPattern } from './helpers/api'
import { addDaysYmd, tehranTodayYmd } from './helpers/date'
import {
  login,
  loginManagerExpectsToday,
  loginStaffExpectsToday,
} from './helpers/auth'
import { pickOpenJalaliDate, pickTime } from './helpers/jalali-pickers'

const chipNumFmt = new Intl.NumberFormat('fa-IR')

function acceptableDateChip(ymd: string) {
  const { jd, jm } = parseGregorianToJalali(ymd)
  const weekdayIndex = (new Date(`${ymd}T12:00:00Z`).getUTCDay() + 1) % 7
  return `${JALALI_WEEKDAYS_SHORT[weekdayIndex]} ${chipNumFmt.format(jd)} ${JALALI_MONTHS[jm - 1]}`
}

type Client = { id: string; name: string }
type Service = { id: string; name: string; duration: number }
type Staff = {
  id: string
  name: string
  role: 'manager' | 'staff'
  serviceIds?: string[] | null
}

type DraftOperationInput = {
  draftId: string
  clientId: string
  serviceId: string
  staffId: string
  date: string
  startTime: string
  marker: string
}

async function attemptDraftMutations(page: Page, input: DraftOperationInput) {
  return Promise.all([
    page.request.post('/api/v1/appointment-requests', {
      data: {
        clientId: input.clientId,
        serviceId: input.serviceId,
        acceptableDates: [input.date],
        timePreference: 'any',
        notes: input.marker,
      },
    }),
    page.request.patch(`/api/v1/appointment-requests/${input.draftId}`, {
      data: {
        acceptableDates: [input.date],
        timePreference: 'any',
        notes: input.marker,
      },
    }),
    page.request.post(`/api/v1/appointment-requests/${input.draftId}/convert`, {
      data: {
        finalDate: input.date,
        startTime: input.startTime,
        staffId: input.staffId,
      },
    }),
    page.request.post(`/api/v1/appointment-requests/${input.draftId}/reject`, {
      data: {},
    }),
    page.request.post(`/api/v1/appointment-requests/${input.draftId}/cancel`, {
      data: {},
    }),
    page.request.post(`/api/v1/appointment-requests/${input.draftId}/renew`, {
      data: {
        clientId: input.clientId,
        serviceId: input.serviceId,
        acceptableDates: [input.date],
        timePreference: 'any',
      },
    }),
  ])
}

function draftCard(page: Page, clientName: string) {
  return page.getByRole('article', {
    name: `پیش‌نویس ${clientName}`,
  })
}

test.describe('Flexible AppointmentRequest journey', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 })

  test('manager records, edits, conflict-checks, and converts one Draft', async ({
    browser,
    baseURL,
    page,
  }) => {
    page.setDefaultTimeout(10_000)
    const runId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
    const suffix = Math.floor(Math.random() * 10_000_000)
      .toString()
      .padStart(7, '0')
    const clientName = `Draft E2E ${runId}`
    const clientPhone = `0914${suffix}`
    const marker = `draft-${runId}`
    const editedMarker = `${marker}-edited`
    let offset = 18 + (Number(suffix.at(-1)) % 8)
    let firstDate = addDaysYmd(tehranTodayYmd(), offset)
    if (new Date(`${firstDate}T12:00:00Z`).getUTCDay() === 5) {
      firstDate = addDaysYmd(firstDate, 1)
    }
    const secondDate = addDaysYmd(firstDate, 1)
    const editedSecondDate = addDaysYmd(firstDate, 2)
    const startHour = [9, 11, 13, 15, 17][Number(suffix.at(-2)) % 5]!
    const startTime = `${startHour.toString().padStart(2, '0')}:00`

    await loginManagerExpectsToday(page)

    const [servicesResponse, staffResponse] = await Promise.all([
      page.request.get('/api/v1/services'),
      page.request.get('/api/v1/staff'),
    ])
    expect(servicesResponse.ok(), await servicesResponse.text()).toBeTruthy()
    expect(staffResponse.ok(), await staffResponse.text()).toBeTruthy()
    const service = (
      (await servicesResponse.json()) as { services: Service[] }
    ).services.find((item) => item.name === 'پاکسازی پوست')
    expect(service).toBeTruthy()
    const staff = (
      (await staffResponse.json()) as { staff: Staff[] }
    ).staff.find(
      (member) =>
        member.role === 'staff' &&
        member.name === 'سارا محمودی' &&
        (member.serviceIds == null || member.serviceIds.includes(service!.id)),
    )
    expect(staff).toBeTruthy()
    const clientResponse = await page.request.post('/api/v1/clients', {
      data: { name: clientName, phone: clientPhone, notes: marker, tags: [] },
    })
    expect(clientResponse.ok(), await clientResponse.text()).toBeTruthy()
    const client = ((await clientResponse.json()) as { client: Client }).client
    let draftId = ''
    const appointmentIdsForCleanup = new Set<string>()
    const operationInput = (): DraftOperationInput => ({
      draftId,
      clientId: client.id,
      serviceId: service!.id,
      staffId: staff!.id,
      date: firstDate,
      startTime,
      marker,
    })

    try {
      await test.step('Create a uniquely identified Draft in the PWA', async () => {
        await page.goto('/requests')
        await page.getByRole('button', { name: /پیش‌نویس‌ها/ }).click()
        await page.getByRole('button', { name: 'پیش‌نویس جدید' }).click()
        const sheet = page.getByRole('dialog', { name: 'پیش‌نویس جدید' })
        await expect(sheet).toBeVisible()

        await sheet.getByRole('button', { name: 'مشتری', exact: true }).click()
        await page.getByPlaceholder('جستجو نام یا شماره…').fill(clientName)
        await page.getByRole('button', { name: new RegExp(clientName) }).click()

        await sheet.getByRole('combobox', { name: 'خدمت', exact: true }).click()
        await page.getByRole('option', { name: /پاکسازی پوست/ }).click()
        await sheet.getByRole('button', { name: 'افزودن تاریخ' }).click()
        await pickOpenJalaliDate(page, firstDate)
        await sheet.getByRole('button', { name: 'افزودن تاریخ' }).click()
        await pickOpenJalaliDate(page, secondDate)
        await sheet.getByRole('radio', { name: 'بعدازظهر', exact: true }).click()
        await sheet.locator('textarea').fill(marker)

        const createDraftResponse = page.waitForResponse(
          (response) =>
            apiPathPattern('appointment-requests').test(response.url()) &&
            response.request().method() === 'POST',
        )
        await sheet.getByRole('button', { name: 'ثبت پیش‌نویس' }).click()
        const response = await createDraftResponse
        expect(response.status(), await response.text()).toBe(201)
        draftId = ((await response.json()) as { request: { id: string } })
          .request.id
      })

      await test.step('Only this salon manager can access the Draft', async () => {
        const unauthenticatedContext = await browser.newContext({ baseURL })
        const unauthenticatedPage = await unauthenticatedContext.newPage()
        expect(
          (
            await unauthenticatedPage.request.get(
              '/api/v1/appointment-requests',
            )
          ).status(),
        ).toBe(401)
        expect(
          (
            await attemptDraftMutations(unauthenticatedPage, operationInput())
          ).map((response) => response.status()),
        ).toEqual([401, 401, 401, 401, 401, 401])
        await unauthenticatedContext.close()

        const staffContext = await browser.newContext({ baseURL })
        const staffPage = await staffContext.newPage()
        await loginStaffExpectsToday(staffPage)
        expect(
          (
            await staffPage.request.get('/api/v1/appointment-requests')
          ).status(),
        ).toBe(403)
        expect(
          (await attemptDraftMutations(staffPage, operationInput())).map(
            (response) => response.status(),
          ),
        ).toEqual([403, 403, 403, 403, 403, 403])
        await staffContext.close()

        const foreignManagerContext = await browser.newContext({ baseURL })
        const foreignManagerPage = await foreignManagerContext.newPage()
        await login(
          foreignManagerPage,
          '09130000000',
          'admin123',
          'سالن نیلوفر',
        )
        const foreignList = await foreignManagerPage.request.get(
          '/api/v1/appointment-requests',
        )
        expect(foreignList.ok(), await foreignList.text()).toBeTruthy()
        expect(
          ((await foreignList.json()) as { requests: Array<{ id: string }> })
            .requests,
        ).not.toContainEqual(expect.objectContaining({ id: draftId }))

        const foreignOperations = await attemptDraftMutations(
          foreignManagerPage,
          operationInput(),
        )
        expect(foreignOperations.map((response) => response.status())).toEqual([
          404, 404, 404, 404, 404, 404,
        ])
        await foreignManagerContext.close()
      })

      const originalCard = draftCard(page, clientName)
      await expect(originalCard).toContainText(clientName)
      await expect(originalCard).toContainText('پاکسازی پوست')
      await expect(originalCard).toContainText('بعدازظهر')
      await expect(originalCard).toContainText(acceptableDateChip(firstDate))
      await expect(originalCard).toContainText(acceptableDateChip(secondDate))
      await expect(page.getByRole('region', { name: 'بعدتر' })).toContainText(
        clientName,
      )

      await test.step('Edit only the Draft timing agreement and notes', async () => {
        await originalCard.getByRole('button', { name: 'ویرایش' }).click()
        const sheet = page.getByRole('dialog', {
          name: 'ویرایش زمان پیش‌نویس',
        })
        await sheet
          .getByRole('button', {
            name: `حذف ${acceptableDateChip(secondDate)}`,
          })
          .click()
        await sheet.getByRole('button', { name: 'افزودن تاریخ' }).click()
        await pickOpenJalaliDate(page, editedSecondDate)
        await sheet.getByRole('radio', { name: 'هر زمان', exact: true }).click()
        await sheet.locator('textarea').fill(editedMarker)
        const updateResponse = page.waitForResponse(
          (response) =>
            apiPathPattern('appointment-requests/').test(response.url()) &&
            response.request().method() === 'PATCH',
        )
        await sheet.getByRole('button', { name: 'ذخیره' }).click()
        expect((await updateResponse).ok()).toBeTruthy()
      })

      const card = draftCard(page, clientName)
      await expect(card).toContainText('هر زمان')
      await expect(card).toContainText(acceptableDateChip(editedSecondDate))
      await expect(card).not.toContainText(acceptableDateChip(secondDate))

      await test.step('Pending Draft stays off-calendar', async () => {
        await page.goto(`/calendar?date=${firstDate}`)
        await page.getByRole('button', { name: 'لیست', exact: true }).click()
        await expect(
          page.locator('.fc-event').filter({ hasText: clientName }),
        ).toHaveCount(0)
      })

      let conflictingAppointmentId = ''
      await test.step('Pending Draft does not block an overlapping Appointment', async () => {
        const response = await page.request.post('/api/v1/appointments', {
          data: {
            clientId: client.id,
            staffId: staff!.id,
            serviceId: service!.id,
            date: firstDate,
            startTime,
            durationMinutes: service!.duration,
            notes: `${marker}-conflict`,
          },
        })
        expect(response.status(), await response.text()).toBe(200)
        conflictingAppointmentId = (
          (await response.json()) as { appointment: { id: string } }
        ).appointment.id
        appointmentIdsForCleanup.add(conflictingAppointmentId)
      })

      await page.goto('/requests')
      await page.getByRole('button', { name: /پیش‌نویس‌ها/ }).click()
      const conflictedCard = draftCard(page, clientName)
      await conflictedCard
        .getByRole('button', { name: 'تبدیل به نوبت' })
        .click()
      const conversionSheet = page.getByRole('dialog', {
        name: 'تبدیل پیش‌نویس به نوبت',
      })
      await pickTime(
        page,
        conversionSheet.getByRole('button', { name: 'ساعت شروع' }),
        startTime,
      )
      await conversionSheet
        .getByRole('combobox', { name: 'پرسنل', exact: true })
        .click()
      await page.getByRole('option', { name: 'سارا محمودی' }).click()

      await test.step('Changed availability rejects atomically and keeps the Draft', async () => {
        const rejectedConversion = page.waitForResponse(
          (response) =>
            /\/appointment-requests\/[^/]+\/convert$/.test(response.url()) &&
            response.request().method() === 'POST',
        )
        await conversionSheet.getByRole('button', { name: 'ثبت نوبت' }).click()
        const response = await rejectedConversion
        expect(response.status(), await response.text()).toBe(409)
        await expect(conversionSheet).toBeVisible()

        const pending = await page.request.get(
          '/api/v1/appointment-requests?status=pending&timingMode=flexible',
        )
        expect(pending.ok(), await pending.text()).toBeTruthy()
        expect(
          (
            (await pending.json()) as {
              requests: Array<{ notes: string | null }>
            }
          ).requests,
        ).toContainEqual(expect.objectContaining({ notes: editedMarker }))
        const appointments = await page.request.get(
          `/api/v1/appointments?startDate=${firstDate}&endDate=${firstDate}`,
        )
        const rows = (
          (await appointments.json()) as {
            appointments: Array<{ client: { name: string } }>
          }
        ).appointments.filter(
          (appointment) => appointment.client.name === clientName,
        )
        expect(rows).toHaveLength(1)
      })

      expect(
        (
          await page.request.delete(
            `/api/v1/appointments/${conflictingAppointmentId}`,
          )
        ).ok(),
      ).toBeTruthy()
      appointmentIdsForCleanup.delete(conflictingAppointmentId)

      let convertedAppointmentId = ''
      await test.step('Conversion creates one linked Appointment and removes the active Draft', async () => {
        const successfulConversion = page.waitForResponse(
          (response) =>
            /\/appointment-requests\/[^/]+\/convert$/.test(response.url()) &&
            response.request().method() === 'POST',
        )
        await conversionSheet.getByRole('button', { name: 'ثبت نوبت' }).click()
        const response = await successfulConversion
        expect(response.ok(), await response.text()).toBeTruthy()
        convertedAppointmentId = (
          (await response.json()) as { appointmentId: string }
        ).appointmentId
        appointmentIdsForCleanup.add(convertedAppointmentId)
        await expect(conversionSheet).toBeHidden()
        await expect(page.getByText(editedMarker, { exact: true })).toHaveCount(
          0,
        )

        const approved = await page.request.get(
          '/api/v1/appointment-requests?status=approved&timingMode=flexible',
        )
        expect(approved.ok(), await approved.text()).toBeTruthy()
        expect(
          (
            (await approved.json()) as {
              requests: Array<{
                notes: string | null
                appointmentId: string | null
              }>
            }
          ).requests,
        ).toContainEqual(
          expect.objectContaining({
            notes: editedMarker,
            appointmentId: convertedAppointmentId,
          }),
        )
      })

      await test.step('Calendar shows exactly the linked Appointment', async () => {
        await page.goto(
          `/calendar?date=${firstDate}&appointmentId=${convertedAppointmentId}`,
        )
        const detail = page.getByRole('dialog', { name: 'جزئیات نوبت' })
        await expect(detail).toBeVisible()
        await expect(detail).toContainText(clientName)
        await expect(detail).toContainText(editedMarker)
        const appointments = await page.request.get(
          `/api/v1/appointments?startDate=${firstDate}&endDate=${firstDate}`,
        )
        expect(appointments.ok(), await appointments.text()).toBeTruthy()
        expect(
          (
            (await appointments.json()) as {
              appointments: Array<{ id: string; client: { name: string } }>
            }
          ).appointments.filter(
            (appointment) => appointment.client.name === clientName,
          ),
        ).toEqual([
          expect.objectContaining({
            id: convertedAppointmentId,
          }),
        ])
      })

      expect(
        (
          await page.request.delete(
            `/api/v1/appointments/${convertedAppointmentId}`,
          )
        ).ok(),
      ).toBeTruthy()
      appointmentIdsForCleanup.delete(convertedAppointmentId)

      await test.step('Simultaneous conversion attempts create one Appointment', async () => {
        const concurrentMarker = `${marker}-concurrent`
        const createResponse = await page.request.post(
          '/api/v1/appointment-requests',
          {
            data: {
              clientId: client.id,
              serviceId: service!.id,
              acceptableDates: [firstDate],
              timePreference: 'any',
              notes: concurrentMarker,
            },
          },
        )
        expect(createResponse.status(), await createResponse.text()).toBe(201)
        const concurrentDraftId = (
          (await createResponse.json()) as { request: { id: string } }
        ).request.id
        expect(concurrentDraftId).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
        )
        const conversionBody = {
          finalDate: firstDate,
          startTime,
          staffId: staff!.id,
        }
        const conversions = await Promise.all([
          page.request.post(
            `/api/v1/appointment-requests/${concurrentDraftId}/convert`,
            { data: conversionBody },
          ),
          page.request.post(
            `/api/v1/appointment-requests/${concurrentDraftId}/convert`,
            { data: conversionBody },
          ),
        ])
        const successfulConversions = conversions.filter(
          (response) => response.status() === 200,
        )
        await Promise.all(
          successfulConversions.map(async (response) => {
            const { appointmentId } = (await response.json()) as {
              appointmentId: string
            }
            appointmentIdsForCleanup.add(appointmentId)
          }),
        )
        expect(
          conversions.map((response) => response.status()).sort(),
          JSON.stringify(
            await Promise.all(conversions.map((response) => response.json())),
          ),
        ).toEqual([200, 409])
        const [successfulConversion] = successfulConversions
        const concurrentAppointmentId = (
          (await successfulConversion!.json()) as { appointmentId: string }
        ).appointmentId

        const approved = await page.request.get(
          '/api/v1/appointment-requests?status=approved&timingMode=flexible',
        )
        expect(approved.ok(), await approved.text()).toBeTruthy()
        expect(
          (
            (await approved.json()) as {
              requests: Array<{
                id: string
                appointmentId: string | null
              }>
            }
          ).requests,
        ).toContainEqual(
          expect.objectContaining({
            id: concurrentDraftId,
            appointmentId: concurrentAppointmentId,
          }),
        )
        const appointments = await page.request.get(
          `/api/v1/appointments?startDate=${firstDate}&endDate=${firstDate}`,
        )
        expect(appointments.ok(), await appointments.text()).toBeTruthy()
        expect(
          (
            (await appointments.json()) as {
              appointments: Array<{ id: string; client: { name: string } }>
            }
          ).appointments.filter(
            (appointment) => appointment.client.name === clientName,
          ),
        ).toEqual([expect.objectContaining({ id: concurrentAppointmentId })])

        expect(
          (
            await page.request.delete(
              `/api/v1/appointments/${concurrentAppointmentId}`,
            )
          ).ok(),
        ).toBeTruthy()
        appointmentIdsForCleanup.delete(concurrentAppointmentId)
      })
    } finally {
      await Promise.all(
        [...appointmentIdsForCleanup].map((appointmentId) =>
          page.request.delete(`/api/v1/appointments/${appointmentId}`),
        ),
      )
    }
  })
})
