import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres, { type Sql } from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const runIntegration = process.env.RUN_DATABASE_INTEGRATION === '1'
const databaseName = `saluna_commission_test_${process.pid}_${Date.now()}`
const adminUrl = 'postgres://postgres:postgres@127.0.0.1:5432/postgres'
const databaseUrl = `postgres://postgres:postgres@127.0.0.1:5432/${databaseName}`
const migrationsFolder = fileURLToPath(
  new URL('../migrations', import.meta.url),
)

type CommissionQueries = typeof import('./commission-queries')
type AppointmentQueries = typeof import('./appointment-queries')

let adminSql: Sql | undefined
let testSql: Sql | undefined
let commissions: CommissionQueries
let appointmentQueries: AppointmentQueries
let databaseCreated = false

const ids = {
  salon: randomUUID(),
  staffUser: randomUUID(),
  profileA: randomUUID(),
  profileB: randomUUID(),
  client: randomUUID(),
  category: randomUUID(),
  serviceA: randomUUID(),
  serviceB: randomUUID(),
  serviceC: randomUUID(),
}

function assertDisposableDatabase(url: string) {
  const parsed = new URL(url)
  if (
    parsed.hostname !== '127.0.0.1' ||
    !parsed.pathname.slice(1).startsWith('saluna_commission_test_')
  ) {
    throw new Error(`Refusing to use non-disposable database: ${url}`)
  }
}

async function seed(sql: Sql) {
  await sql`
    insert into organization (id, name, slug)
    values (${ids.salon}, 'Commission Salon', ${`commission-${databaseName}`})
  `
  await sql`
    insert into "user" (id, name, email, email_verified, created_at, updated_at)
    values (${ids.staffUser}, 'Staff Identity', 'commission-staff@example.test', true, now(), now())
  `
  await sql`
    insert into staff_profiles (id, salon_id, name, phone, color)
    values
      (${ids.profileA}, ${ids.salon}, 'Mina', '09120000001', 'rose'),
      (${ids.profileB}, ${ids.salon}, 'Sara', '09120000002', 'mint')
  `
  await sql`
    insert into service_categories (id, salon_id, name)
    values (${ids.category}, ${ids.salon}, 'Hair')
  `
  await sql`
    insert into services (id, salon_id, category_id, name, duration, price, color)
    values
      (${ids.serviceA}, ${ids.salon}, ${ids.category}, 'Service A', 30, 100, 'rose'),
      (${ids.serviceB}, ${ids.salon}, ${ids.category}, 'Service B', 30, 200, 'mint'),
      (${ids.serviceC}, ${ids.salon}, ${ids.category}, 'Service C', 30, 300, 'gold')
  `
  await sql`
    insert into clients (id, salon_id, name, phone)
    values (${ids.client}, ${ids.salon}, 'Client', '09121111111')
  `
}

async function insertAppointment(input: {
  id?: string
  staffId?: string
  serviceId?: string
  date: string
  status?: string
  price: number
}) {
  const id = input.id ?? randomUUID()
  const serviceId = input.serviceId ?? ids.serviceA
  await testSql!`
    insert into appointments (
      id, salon_id, client_id, staff_id, service_id, date, start_time, end_time,
      booked_service_name, booked_service_duration, booked_service_price,
      booked_total_duration, booked_total_price, status
    ) values (
      ${id}, ${ids.salon}, ${ids.client}, ${input.staffId ?? ids.profileA},
      ${serviceId}, ${input.date}, '10:00', '10:30', 'Booked service', 30,
      ${input.price}, 30, ${input.price}, ${input.status ?? 'scheduled'}
    )
  `
  return id
}

describe.skipIf(!runIntegration)(
  'Staff Commission Postgres integration',
  () => {
    beforeAll(async () => {
      assertDisposableDatabase(databaseUrl)
      adminSql = postgres(adminUrl, { max: 1 })
      await adminSql`create database ${adminSql(databaseName)}`
      databaseCreated = true
      testSql = postgres(databaseUrl, { max: 1 })
      await migrate(drizzle(testSql), { migrationsFolder })
      await seed(testSql)
      process.env.DATABASE_URL = databaseUrl
      process.env.DATABASE_URL_DIRECT = databaseUrl
      commissions = await import('./commission-queries')
      appointmentQueries = await import('./appointment-queries')
    }, 30_000)

    afterAll(async () => {
      const globals = globalThis as typeof globalThis & {
        __salon_postgres?: Sql
        __salon_drizzle?: unknown
      }
      if (globals.__salon_postgres)
        await globals.__salon_postgres.end({ timeout: 5 })
      delete globals.__salon_postgres
      delete globals.__salon_drizzle
      if (testSql) await testSql.end({ timeout: 5 })
      if (adminSql && databaseCreated) {
        assertDisposableDatabase(databaseUrl)
        await adminSql`drop database if exists ${adminSql(databaseName)} with (force)`
      }
      if (adminSql) await adminSql.end({ timeout: 5 })
    }, 30_000)

    it('keeps regular Appointment commissions prospective, stable, reversible, and deletable', async () => {
      const historical = await insertAppointment({
        date: '2026-07-01',
        status: 'completed',
        price: 500,
      })
      const first = await insertAppointment({ date: '2026-07-02', price: 101 })
      const second = await insertAppointment({ date: '2026-07-03', price: 200 })
      const disabled = await insertAppointment({
        date: '2026-07-04',
        price: 300,
      })

      await commissions.setCommissionAgreement({
        salonId: ids.salon,
        staffProfileId: ids.profileA,
        percentageBasisPoints: 5000,
      })
      await appointmentQueries.updateAppointment(historical, ids.salon, {
        notes: 'must not backfill',
      })
      await appointmentQueries.updateAppointment(first, ids.salon, {
        status: 'completed',
      })
      await appointmentQueries.updateAppointment(first, ids.salon, {
        status: 'completed',
      })

      await commissions.setCommissionAgreement({
        salonId: ids.salon,
        staffProfileId: ids.profileA,
        percentageBasisPoints: 2500,
      })
      await appointmentQueries.updateAppointment(second, ids.salon, {
        status: 'completed',
      })
      await appointmentQueries.updateAppointment(first, ids.salon, {
        finalPrice: 201,
      })
      await appointmentQueries.updateAppointment(first, ids.salon, {
        status: 'cancelled',
      })

      let report = await commissions.getStaffCommissionReport({
        salonId: ids.salon,
        staffProfileId: ids.profileA,
        startDate: '2026-07-01',
        endDate: '2026-07-31',
      })
      expect(report?.rows).toEqual([
        expect.objectContaining({
          appointmentId: second,
          basis: 200,
          percentage: 25,
          amount: 50,
        }),
      ])

      await appointmentQueries.updateAppointment(first, ids.salon, {
        status: 'completed',
      })
      await commissions.disableCommissionAgreement({
        salonId: ids.salon,
        staffProfileId: ids.profileA,
      })
      await appointmentQueries.updateAppointment(disabled, ids.salon, {
        status: 'completed',
      })

      report = await commissions.getStaffCommissionReport({
        salonId: ids.salon,
        staffProfileId: ids.profileA,
        startDate: '2026-07-01',
        endDate: '2026-07-31',
      })
      expect(report).toMatchObject({
        agreement: { active: false, percentage: 25 },
        summary: {
          completedCount: 2,
          grossAppointmentRevenue: 401,
          staffCommissionTotal: 151,
        },
      })
      expect(report?.rows).toEqual([
        expect.objectContaining({
          appointmentId: first,
          basis: 201,
          percentage: 50,
          amount: 101,
        }),
        expect.objectContaining({ appointmentId: second, amount: 50 }),
      ])
      expect(report?.rows.some((row) => row.appointmentId === historical)).toBe(
        false,
      )

      const salon = await commissions.getSalonCommissionReport({
        salonId: ids.salon,
        startDate: '2026-07-01',
        endDate: '2026-07-31',
      })
      expect(salon?.summary).toEqual({
        grossAppointmentRevenue: 401,
        staffCommissionTotal: 151,
        salonRetainedAmount: 250,
      })
      await expect(
        commissions.getSalonFinancialSummary({
          salonId: ids.salon,
          startDate: '2026-07-01',
          endDate: '2026-07-31',
        }),
      ).resolves.toEqual({
        grossAppointmentRevenue: 1201,
        staffCommissionTotal: 151,
        salonRetainedAmount: 1050,
      })

      await appointmentQueries.deleteAppointment(first, ids.salon)
      expect(
        (
          await commissions.getStaffCommissionReport({
            salonId: ids.salon,
            staffProfileId: ids.profileA,
            startDate: '2026-07-01',
            endDate: '2026-07-31',
          })
        )?.summary.completedCount,
      ).toBe(1)
    })

    it('persists commission exclusion across every later status sequence', async () => {
      const historicalNoShow = await insertAppointment({
        date: '2026-07-20',
        price: 500,
      })
      const historicalScheduled = await insertAppointment({
        date: '2026-07-20',
        price: 600,
      })
      const completedWhileDisabled = await insertAppointment({
        date: '2026-07-20',
        price: 700,
      })
      const eligible = await insertAppointment({
        date: '2026-07-20',
        price: 800,
      })
      await appointmentQueries.updateAppointment(historicalNoShow, ids.salon, {
        status: 'completed',
      })
      await appointmentQueries.updateAppointment(
        historicalScheduled,
        ids.salon,
        { status: 'completed' },
      )
      await commissions.setCommissionAgreement({
        salonId: ids.salon,
        staffProfileId: ids.profileA,
        percentageBasisPoints: 2000,
      })

      await appointmentQueries.updateAppointment(historicalNoShow, ids.salon, {
        status: 'no-show',
      })
      await appointmentQueries.updateAppointment(historicalNoShow, ids.salon, {
        status: 'completed',
      })
      await appointmentQueries.updateAppointment(
        historicalScheduled,
        ids.salon,
        { status: 'scheduled' },
      )
      await appointmentQueries.updateAppointment(
        historicalScheduled,
        ids.salon,
        { status: 'completed' },
      )
      await commissions.disableCommissionAgreement({
        salonId: ids.salon,
        staffProfileId: ids.profileA,
      })
      await appointmentQueries.updateAppointment(
        completedWhileDisabled,
        ids.salon,
        { status: 'completed' },
      )
      await appointmentQueries.updateAppointment(
        completedWhileDisabled,
        ids.salon,
        { status: 'scheduled' },
      )
      await commissions.setCommissionAgreement({
        salonId: ids.salon,
        staffProfileId: ids.profileA,
        percentageBasisPoints: 2000,
      })
      await appointmentQueries.updateAppointment(
        completedWhileDisabled,
        ids.salon,
        { status: 'completed' },
      )
      await appointmentQueries.updateAppointment(eligible, ids.salon, {
        status: 'completed',
      })

      expect(
        (
          await commissions.getStaffCommissionReport({
            salonId: ids.salon,
            staffProfileId: ids.profileA,
            startDate: '2026-07-20',
            endDate: '2026-07-20',
          })
        )?.rows.map((row) => row.appointmentId),
      ).toEqual([eligible])
    })

    it('allocates an overridden package price exactly across unequal tasks and multiple Staff Profiles', async () => {
      await commissions.setCommissionAgreement({
        salonId: ids.salon,
        staffProfileId: ids.profileA,
        percentageBasisPoints: 1000,
      })
      await commissions.setCommissionAgreement({
        salonId: ids.salon,
        staffProfileId: ids.profileB,
        percentageBasisPoints: 2000,
      })
      const packageId = randomUUID()
      const bookingId = randomUUID()
      const serviceIds = [ids.serviceA, ids.serviceB, ids.serviceC]
      const profileIds = [ids.profileA, ids.profileB, ids.profileA]
      const prices = [100, 200, 300]
      const appointmentIds: string[] = []

      await testSql!`
      insert into service_packages (id, salon_id, category_id, name, price_override)
      values (${packageId}, ${ids.salon}, ${ids.category}, 'Package', 500)
    `
      const componentIds: string[] = []
      for (let index = 0; index < serviceIds.length; index++) {
        const componentId = randomUUID()
        componentIds.push(componentId)
        await testSql!`
        insert into service_package_components (id, salon_id, package_id, service_id, sort_order)
        values (${componentId}, ${ids.salon}, ${packageId}, ${serviceIds[index]}, ${index})
      `
        appointmentIds.push(
          await insertAppointment({
            staffId: profileIds[index],
            serviceId: serviceIds[index],
            date: '2026-08-01',
            price: prices[index]!,
          }),
        )
      }
      await testSql!`
      insert into service_package_bookings (
        id, salon_id, package_id, client_id, lead_staff_id, date,
        booked_package_name, booked_package_price, status
      ) values (
        ${bookingId}, ${ids.salon}, ${packageId}, ${ids.client}, ${ids.profileA},
        '2026-08-01', 'Package', 500, 'scheduled'
      )
    `
      for (let index = 0; index < appointmentIds.length; index++) {
        await testSql!`
        insert into service_package_tasks (
          salon_id, package_booking_id, package_component_id, service_id,
          appointment_id, staff_id, start_time, end_time, sort_order
        ) values (
          ${ids.salon}, ${bookingId}, ${componentIds[index]}, ${serviceIds[index]},
          ${appointmentIds[index]}, ${profileIds[index]}, '10:00', '10:30', ${index}
        )
      `
        await appointmentQueries.updateAppointment(
          appointmentIds[index]!,
          ids.salon,
          {
            status: 'completed',
          },
        )
      }

      await appointmentQueries.updateAppointment(
        appointmentIds[0]!,
        ids.salon,
        {
          finalPrice: 999,
        },
      )
      await appointmentQueries.updateAppointment(
        appointmentIds[1]!,
        ids.salon,
        {
          status: 'no-show',
        },
      )
      await appointmentQueries.updateAppointment(
        appointmentIds[1]!,
        ids.salon,
        {
          status: 'completed',
        },
      )

      const salon = await commissions.getSalonCommissionReport({
        salonId: ids.salon,
        startDate: '2026-08-01',
        endDate: '2026-08-01',
      })
      expect(salon?.rows.map((row) => [row.basis, row.amount])).toEqual([
        [84, 8],
        [166, 33],
        [250, 25],
      ])
      expect(salon?.summary).toEqual({
        grossAppointmentRevenue: 500,
        staffCommissionTotal: 66,
        salonRetainedAmount: 434,
      })
      await expect(
        commissions.getSalonFinancialSummary({
          salonId: ids.salon,
          startDate: '2026-08-01',
          endDate: '2026-08-01',
        }),
      ).resolves.toEqual(salon?.summary)

      await expect(
        appointmentQueries.deleteAppointment(appointmentIds[0]!, ids.salon),
      ).resolves.toBe(true)
      expect(
        (
          await commissions.getSalonCommissionReport({
            salonId: ids.salon,
            startDate: '2026-08-01',
            endDate: '2026-08-01',
          })
        )?.summary,
      ).toEqual({
        grossAppointmentRevenue: 416,
        staffCommissionTotal: 58,
        salonRetainedAmount: 358,
      })
      await expect(
        commissions.getSalonFinancialSummary({
          salonId: ids.salon,
          startDate: '2026-08-01',
          endDate: '2026-08-01',
        }),
      ).resolves.toEqual({
        grossAppointmentRevenue: 416,
        staffCommissionTotal: 58,
        salonRetainedAmount: 358,
      })
    })

    it('keeps salon-owned history when Staff Profile Access is established and revoked', async () => {
      await testSql!`
      update staff_profiles
      set user_id = ${ids.staffUser}, claimed_at = now(), access_detached_at = null
      where id = ${ids.profileA}
    `
      const accessId = randomUUID()
      await testSql!`
      insert into staff_profile_accesses (
        id, salon_id, staff_profile_id, user_id, accepted_at
      ) values (
        ${accessId}, ${ids.salon}, ${ids.profileA}, ${ids.staffUser}, now()
      )
    `
      await commissions.setCommissionAgreement({
        salonId: ids.salon,
        staffProfileId: ids.profileA,
        percentageBasisPoints: 1500,
      })
      const identityAssignedAppointment = await insertAppointment({
        staffId: ids.staffUser,
        date: '2026-08-02',
        price: 400,
      })
      await appointmentQueries.updateAppointment(
        identityAssignedAppointment,
        ids.salon,
        { status: 'completed' },
      )
      await expect(
        commissions.getStaffCommissionReport({
          salonId: ids.salon,
          staffProfileId: ids.staffUser,
          startDate: '2026-08-01',
          endDate: '2026-08-02',
        }),
      ).resolves.toBeNull()
      const claimed = await commissions.getStaffCommissionReport({
        salonId: ids.salon,
        staffProfileId: ids.profileA,
        startDate: '2026-08-01',
        endDate: '2026-08-02',
      })
      expect(
        claimed?.rows.some(
          (row) => row.appointmentId === identityAssignedAppointment,
        ),
      ).toBe(true)
      await testSql!`
      update staff_profile_accesses set revoked_at = now() where id = ${accessId}
    `
      const managerAfterRevocation = await commissions.getStaffCommissionReport(
        {
          salonId: ids.salon,
          staffProfileId: ids.profileA,
          startDate: '2026-08-01',
          endDate: '2026-08-02',
        },
      )
      expect(claimed?.summary).toEqual(managerAfterRevocation?.summary)
      expect(managerAfterRevocation?.summary.completedCount).toBe(2)
    })
  },
)
