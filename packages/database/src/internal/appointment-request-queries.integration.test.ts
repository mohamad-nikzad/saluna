import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres, { type Sql } from 'postgres'
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { addDaysYmd, salonTodayYmd } from '@repo/salon-core/salon-local-time'
import * as intake from './appointment-intake'
import * as appointments from './appointment-queries'
import {
  approveAppointmentRequest,
  convertFlexibleAppointmentRequest,
  rejectAppointmentRequest,
} from './appointment-request-queries'
import { SalonClosedError } from './salon-closure-queries'

const databaseName = `saluna_request_test_${process.pid}_${Date.now()}`
const databaseUrl = `postgres://postgres:postgres@127.0.0.1:5432/${databaseName}`
let adminSql: Sql
let testSql: Sql
let databaseCreated = false
const ids = {
  salon: randomUUID(),
  manager: randomUUID(),
  staff: randomUUID(),
  client: randomUUID(),
  category: randomUUID(),
  service: randomUUID(),
}
let day = 0

async function requestFor(timingMode: 'exact' | 'flexible') {
  const id = randomUUID()
  const date = addDaysYmd(salonTodayYmd(), ++day)
  await testSql`
    insert into appointment_requests (
      id, salon_id, service_id, client_id, timing_mode, staff_id,
      requested_date, requested_start_time, requested_end_time,
      acceptable_dates, time_preference, customer_name, customer_phone,
      booked_service_name, booked_service_duration, booked_service_price
    ) values (
      ${id}, ${ids.salon}, ${ids.service}, ${timingMode === 'flexible' ? ids.client : null},
      ${timingMode}, ${ids.staff}, ${timingMode === 'exact' ? date : null},
      ${timingMode === 'exact' ? '10:00' : null}, ${timingMode === 'exact' ? '10:45' : null},
      ${timingMode === 'flexible' ? [date] : null}, ${timingMode === 'flexible' ? 'any' : null},
      'Client', '09121111111', 'Saved service', 45, 750000
    )
  `
  const input = {
    id,
    salonId: ids.salon,
    reviewedByUserId: ids.manager,
  }
  return {
    id,
    date,
    convert: () =>
      timingMode === 'exact'
        ? approveAppointmentRequest(input)
        : convertFlexibleAppointmentRequest({
            ...input,
            finalDate: date,
            startTime: '10:00',
            staffAssignments: [
              {
                staffId: ids.staff,
                isLead: true,
                allocationBasisPoints: 10000,
              },
            ],
          }),
  }
}

describe.skipIf(process.env.RUN_DATABASE_INTEGRATION !== '1')(
  'AppointmentRequest Postgres conversion',
  () => {
    beforeAll(async () => {
      adminSql = postgres(
        'postgres://postgres:postgres@127.0.0.1:5432/postgres',
        { max: 1 },
      )
      await adminSql`create database ${adminSql(databaseName)}`
      databaseCreated = true
      testSql = postgres(databaseUrl, { max: 1 })
      await migrate(drizzle(testSql), {
        migrationsFolder: fileURLToPath(
          new URL('../migrations', import.meta.url),
        ),
      })
      process.env.DATABASE_URL = databaseUrl
      process.env.DATABASE_URL_DIRECT = databaseUrl
      await testSql`insert into organization (id, name, slug) values (${ids.salon}, 'Salon', ${databaseName})`
      await testSql`insert into "user" (id, name, email, email_verified) values (${ids.manager}, 'Manager', 'manager@example.test', true)`
      await testSql`insert into staff_profiles (id, salon_id, name, phone, color) values (${ids.staff}, ${ids.salon}, 'Staff', '09120000001', 'rose')`
      await testSql`insert into service_categories (id, salon_id, name) values (${ids.category}, ${ids.salon}, 'Hair')`
      await testSql`insert into services (id, salon_id, category_id, name, duration, price, color) values (${ids.service}, ${ids.salon}, ${ids.category}, 'Current service', 90, 900000, 'rose')`
      await testSql`insert into staff_services (salon_id, staff_user_id, service_id) values (${ids.salon}, ${ids.staff}, ${ids.service})`
      await testSql`insert into clients (id, salon_id, name, phone) values (${ids.client}, ${ids.salon}, 'Client', '09121111111')`
    }, 30000)

    afterEach(() => vi.restoreAllMocks())
    afterAll(async () => {
      const globals = globalThis as typeof globalThis & {
        __salon_postgres?: Sql
        __salon_drizzle?: unknown
      }
      await globals.__salon_postgres?.end({ timeout: 5 })
      delete globals.__salon_postgres
      delete globals.__salon_drizzle
      await testSql?.end({ timeout: 5 })
      if (databaseCreated)
        await adminSql`drop database ${adminSql(databaseName)} with (force)`
      await adminSql?.end({ timeout: 5 })
    }, 30000)

    it('rejects an unlisted date and leaves the saved request pending', async () => {
      const request = await requestFor('flexible')
      const acceptableDates = [addDaysYmd(request.date, 1)]
      await testSql`update appointment_requests set acceptable_dates = ${acceptableDates} where id = ${request.id}`

      expect(await request.convert()).toEqual({
        ok: false,
        status: 400,
        error: 'تاریخ انتخاب‌شده قابل قبول نیست',
      })
      expect(
        await testSql`select id from appointments where date = ${request.date}`,
      ).toHaveLength(0)
      expect(
        await testSql`select status, appointment_id, acceptable_dates from appointment_requests where id = ${request.id}`,
      ).toEqual([
        {
          status: 'pending',
          appointment_id: null,
          acceptable_dates: acceptableDates,
        },
      ])
    })

    for (const mode of ['exact', 'flexible'] as const) {
      it(`${mode}: persists the snapshot, roster, request link and notification`, async () => {
        const request = await requestFor(mode)
        const result = await request.convert()
        expect(result).toMatchObject({ ok: true, clientId: ids.client })
        if (!result.ok) throw new Error(result.error)
        const [stored] =
          await testSql`select * from appointments where id = ${result.appointmentId}`
        expect(stored).toMatchObject({
          date: request.date,
          start_time: '10:00',
          end_time: '10:45',
          booked_service_name: 'Saved service',
          booked_service_duration: 45,
          booked_service_price: 750000,
          booked_total_duration: 45,
        })
        const [linked] =
          await testSql`select * from appointment_requests where id = ${request.id}`
        expect(linked).toMatchObject({
          status: 'approved',
          appointment_id: result.appointmentId,
          reviewed_by_user_id: ids.manager,
        })
        expect(result.notification).toMatchObject({
          appointment: {
            id: result.appointmentId,
            staffAssignments: [{ staffId: ids.staff, isLead: true }],
          },
          staffIds: [ids.staff],
          clientName: 'Client',
          serviceName: 'Current service',
        })
      })

      it(`${mode}: a close after Intake leaves no orphan Appointment`, async () => {
        const request = await requestFor(mode)
        const validate = intake.validateCreateAppointmentIntake
        vi.spyOn(
          intake,
          'validateCreateAppointmentIntake',
        ).mockImplementationOnce(async (input) => {
          const result = await validate(input)
          expect(result.ok).toBe(true)
          await expect(
            rejectAppointmentRequest({
              id: request.id,
              salonId: ids.salon,
              reviewedByUserId: ids.manager,
            }),
          ).resolves.toEqual({ ok: true })
          return result
        })
        expect(await request.convert()).toMatchObject({
          ok: false,
          status: 409,
        })
        expect(
          await testSql`select id from appointments where date = ${request.date}`,
        ).toHaveLength(0)
        expect(
          await testSql`select status, appointment_id from appointment_requests where id = ${request.id}`,
        ).toEqual([{ status: 'rejected', appointment_id: null }])
      })

      it(`${mode}: a failure after insert rolls back the Appointment and request claim`, async () => {
        const request = await requestFor(mode)
        const create = appointments.createAppointment
        let insertedId: string | undefined
        vi.spyOn(appointments, 'createAppointment').mockImplementationOnce(
          async (...args) => {
            const appointment = await create(...args)
            insertedId = appointment.id
            throw new SalonClosedError()
          },
        )
        expect(await request.convert()).toMatchObject({
          ok: false,
          status: 409,
          code: 'SALON_CLOSED',
        })
        expect(insertedId).toBeDefined()
        expect(
          await testSql`select id from appointments where date = ${request.date}`,
        ).toHaveLength(0)
        expect(
          await testSql`select status, appointment_id, reviewed_at from appointment_requests where id = ${request.id}`,
        ).toEqual([
          { status: 'pending', appointment_id: null, reviewed_at: null },
        ])
        expect(
          await testSql`select id from appointment_staff_assignments where appointment_id = ${insertedId ?? ''}`,
        ).toHaveLength(0)
      })
    }
  },
)
