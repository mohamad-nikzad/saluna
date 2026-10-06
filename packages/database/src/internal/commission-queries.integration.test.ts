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

type CommissionQueries = typeof import('./commission-queries') &
  typeof import('./salon-money-report-queries')
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
  staffAssignments?: Array<{
    staffId: string
    allocationBasisPoints: number
    isLead?: boolean
  }>
}) {
  const id = input.id ?? randomUUID()
  const serviceId = input.serviceId ?? ids.serviceA
  const leadStaffId = input.staffId ?? ids.profileA
  await testSql!`
    insert into appointments (
      id, salon_id, client_id, service_id, date, start_time, end_time,
      booked_service_name, booked_service_duration, booked_service_price,
      booked_total_duration, booked_total_price, status
    ) values (
      ${id}, ${ids.salon}, ${ids.client},
      ${serviceId}, ${input.date}, '10:00', '10:30', 'Booked service', 30,
      ${input.price}, 30, ${input.price}, ${input.status ?? 'scheduled'}
    )
  `
  const assignments = input.staffAssignments ?? [
    { staffId: leadStaffId, allocationBasisPoints: 10_000, isLead: true },
  ]
  for (const assignment of assignments) {
    await testSql!`
      insert into appointment_staff_assignments (
        id, salon_id, appointment_id, staff_id, is_lead, allocation_basis_points
      ) values (
        ${randomUUID()}, ${ids.salon}, ${id}, ${assignment.staffId},
        ${assignment.isLead ?? false}, ${assignment.allocationBasisPoints}
      )
    `
  }
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
      commissions = {
        ...(await import('./commission-queries')),
        ...(await import('./salon-money-report-queries')),
      }
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

      const money = await commissions.getSalonMoneyReport({
        salonId: ids.salon,
        startDate: '2026-07-01',
        endDate: '2026-07-31',
      })
      expect(money).toEqual({
        ok: true,
        report: expect.objectContaining({
          summary: {
            bookedTotal: 1201,
            staffCommissionTotal: 151,
            salonRetainedAmount: 1050,
          },
        }),
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

    it('allocates one appointment across staff without multiplying salon revenue', async () => {
      await commissions.setCommissionAgreement({
        salonId: ids.salon,
        staffProfileId: ids.profileA,
        percentageBasisPoints: 5000,
      })
      const appointmentId = await insertAppointment({
        date: '2026-09-01',
        price: 101,
        staffAssignments: [
          {
            staffId: ids.profileA,
            allocationBasisPoints: 5000,
            isLead: true,
          },
          { staffId: ids.profileB, allocationBasisPoints: 5000 },
        ],
      })
      await appointmentQueries.updateAppointment(appointmentId, ids.salon, {
        status: 'completed',
      })

      await expect(
        commissions.getSalonMoneyReport({
          salonId: ids.salon,
          startDate: '2026-09-01',
          endDate: '2026-09-01',
        }),
      ).resolves.toEqual({
        ok: true,
        report: expect.objectContaining({
          summary: {
            bookedTotal: 101,
            staffCommissionTotal: 26,
            salonRetainedAmount: 75,
          },
        }),
      })
      expect(
        (
          await commissions.getStaffCommissionReport({
            salonId: ids.salon,
            staffProfileId: ids.profileA,
            startDate: '2026-09-01',
            endDate: '2026-09-01',
          })
        )?.rows,
      ).toEqual([
        expect.objectContaining({
          appointmentId,
          basis: 51,
          percentage: 50,
          amount: 26,
        }),
      ])
      expect(
        (
          await commissions.getStaffCommissionReport({
            salonId: ids.salon,
            staffProfileId: ids.profileB,
            startDate: '2026-09-01',
            endDate: '2026-09-01',
          })
        )?.rows,
      ).toEqual([])

      await commissions.setCommissionAgreement({
        salonId: ids.salon,
        staffProfileId: ids.profileB,
        percentageBasisPoints: 2000,
      })
      await appointmentQueries.updateAppointment(appointmentId, ids.salon, {
        status: 'cancelled',
      })
      await appointmentQueries.updateAppointment(appointmentId, ids.salon, {
        status: 'completed',
      })
      expect(
        (
          await commissions.getStaffCommissionReport({
            salonId: ids.salon,
            staffProfileId: ids.profileB,
            startDate: '2026-09-01',
            endDate: '2026-09-01',
          })
        )?.rows,
      ).toEqual([])
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

      const money = await commissions.getSalonMoneyReport({
        salonId: ids.salon,
        startDate: '2026-08-01',
        endDate: '2026-08-01',
      })
      expect(money.ok).toBe(true)
      if (!money.ok) return
      expect(
        money.report.appointments.flatMap((appointment) =>
          appointment.commissions.map((row) => [row.basis, row.amount]),
        ),
      ).toEqual([
        [84, 8],
        [166, 33],
        [250, 25],
      ])
      expect(money.report.summary).toEqual({
        bookedTotal: 500,
        staffCommissionTotal: 66,
        salonRetainedAmount: 434,
      })

      await expect(
        appointmentQueries.deleteAppointment(appointmentIds[0]!, ids.salon),
      ).resolves.toBe(true)
      await expect(
        commissions.getSalonMoneyReport({
          salonId: ids.salon,
          startDate: '2026-08-01',
          endDate: '2026-08-01',
        }),
      ).resolves.toEqual({
        ok: true,
        report: expect.objectContaining({
          summary: {
            // Remaining package tasks re-split the booked package price; commissions stay stored.
            bookedTotal: 500,
            staffCommissionTotal: 58,
            salonRetainedAmount: 442,
          },
        }),
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

    it('applies Service Commission Overrides prospectively without rewriting stored commissions', async () => {
      await commissions.setCommissionAgreement({
        salonId: ids.salon,
        staffProfileId: ids.profileA,
        percentageBasisPoints: 2000,
      })
      const defaulted = await insertAppointment({
        serviceId: ids.serviceA,
        date: '2026-10-01',
        price: 100,
      })
      const overridden = await insertAppointment({
        serviceId: ids.serviceB,
        date: '2026-10-02',
        price: 100,
      })
      const afterDefaultChange = await insertAppointment({
        serviceId: ids.serviceA,
        date: '2026-10-03',
        price: 100,
      })
      const afterOverrideRemoved = await insertAppointment({
        serviceId: ids.serviceB,
        date: '2026-10-04',
        price: 100,
      })
      const whileDisabled = await insertAppointment({
        serviceId: ids.serviceB,
        date: '2026-10-05',
        price: 100,
      })
      const multiStaff = await insertAppointment({
        serviceId: ids.serviceB,
        date: '2026-10-06',
        price: 100,
        staffAssignments: [
          {
            staffId: ids.profileA,
            allocationBasisPoints: 5000,
            isLead: true,
          },
          { staffId: ids.profileB, allocationBasisPoints: 5000 },
        ],
      })
      const otherSalon = randomUUID()
      const otherService = randomUUID()
      const otherCategory = randomUUID()
      await testSql!`
        insert into organization (id, name, slug)
        values (${otherSalon}, 'Other Salon', ${`other-${databaseName}`})
      `
      await testSql!`
        insert into service_categories (id, salon_id, name)
        values (${otherCategory}, ${otherSalon}, 'Other')
      `
      await testSql!`
        insert into services (id, salon_id, category_id, name, duration, price, color)
        values (${otherService}, ${otherSalon}, ${otherCategory}, 'Foreign', 30, 100, 'rose')
      `

      expect(
        await commissions.setServiceCommissionOverride({
          salonId: ids.salon,
          staffProfileId: ids.profileA,
          serviceId: otherService,
          percentageBasisPoints: 4000,
        }),
      ).toEqual({ ok: false, reason: 'service' })

      const created = await commissions.setServiceCommissionOverride({
        salonId: ids.salon,
        staffProfileId: ids.profileA,
        serviceId: ids.serviceB,
        percentageBasisPoints: 4000,
      })
      expect(created).toMatchObject({
        ok: true,
        agreement: {
          percentage: 20,
          overrides: [
            expect.objectContaining({
              serviceId: ids.serviceB,
              serviceName: 'Service B',
              serviceActive: true,
              percentage: 40,
            }),
          ],
        },
      })

      await appointmentQueries.updateAppointment(defaulted, ids.salon, {
        status: 'completed',
      })
      await appointmentQueries.updateAppointment(overridden, ids.salon, {
        status: 'completed',
      })

      let report = await commissions.getStaffCommissionReport({
        salonId: ids.salon,
        staffProfileId: ids.profileA,
        startDate: '2026-10-01',
        endDate: '2026-10-31',
      })
      expect(report?.rows).toEqual([
        expect.objectContaining({
          appointmentId: defaulted,
          percentage: 20,
          amount: 20,
        }),
        expect.objectContaining({
          appointmentId: overridden,
          percentage: 40,
          amount: 40,
        }),
      ])

      await commissions.setCommissionAgreement({
        salonId: ids.salon,
        staffProfileId: ids.profileA,
        percentageBasisPoints: 1000,
      })
      await appointmentQueries.updateAppointment(
        afterDefaultChange,
        ids.salon,
        {
          status: 'completed',
        },
      )
      report = await commissions.getStaffCommissionReport({
        salonId: ids.salon,
        staffProfileId: ids.profileA,
        startDate: '2026-10-01',
        endDate: '2026-10-31',
      })
      expect(report?.agreement).toMatchObject({
        percentage: 10,
        overrides: [
          expect.objectContaining({ serviceId: ids.serviceB, percentage: 40 }),
        ],
      })
      expect(
        report?.rows.find((row) => row.appointmentId === overridden),
      ).toMatchObject({ percentage: 40, amount: 40 })
      expect(
        report?.rows.find((row) => row.appointmentId === afterDefaultChange),
      ).toMatchObject({ percentage: 10, amount: 10 })

      await appointmentQueries.updateAppointment(overridden, ids.salon, {
        finalPrice: 200,
      })
      report = await commissions.getStaffCommissionReport({
        salonId: ids.salon,
        staffProfileId: ids.profileA,
        startDate: '2026-10-01',
        endDate: '2026-10-31',
      })
      expect(
        report?.rows.find((row) => row.appointmentId === overridden),
      ).toMatchObject({ basis: 200, percentage: 40, amount: 80 })

      await commissions.setServiceCommissionOverride({
        salonId: ids.salon,
        staffProfileId: ids.profileA,
        serviceId: ids.serviceB,
        percentageBasisPoints: 5000,
      })
      await appointmentQueries.updateAppointment(overridden, ids.salon, {
        status: 'cancelled',
      })
      await appointmentQueries.updateAppointment(overridden, ids.salon, {
        status: 'completed',
      })
      report = await commissions.getStaffCommissionReport({
        salonId: ids.salon,
        staffProfileId: ids.profileA,
        startDate: '2026-10-01',
        endDate: '2026-10-31',
      })
      expect(
        report?.rows.find((row) => row.appointmentId === overridden),
      ).toMatchObject({ percentage: 40, amount: 80 })

      await expect(
        commissions.deleteServiceCommissionOverride({
          salonId: ids.salon,
          staffProfileId: ids.profileA,
          serviceId: ids.serviceB,
        }),
      ).resolves.toMatchObject({
        ok: true,
        agreement: { overrides: [] },
      })
      await appointmentQueries.updateAppointment(
        afterOverrideRemoved,
        ids.salon,
        { status: 'completed' },
      )
      report = await commissions.getStaffCommissionReport({
        salonId: ids.salon,
        staffProfileId: ids.profileA,
        startDate: '2026-10-01',
        endDate: '2026-10-31',
      })
      expect(
        report?.rows.find((row) => row.appointmentId === afterOverrideRemoved),
      ).toMatchObject({ percentage: 10, amount: 10 })

      await commissions.setServiceCommissionOverride({
        salonId: ids.salon,
        staffProfileId: ids.profileA,
        serviceId: ids.serviceB,
        percentageBasisPoints: 3000,
      })
      await commissions.disableCommissionAgreement({
        salonId: ids.salon,
        staffProfileId: ids.profileA,
      })
      await appointmentQueries.updateAppointment(whileDisabled, ids.salon, {
        status: 'completed',
      })
      report = await commissions.getStaffCommissionReport({
        salonId: ids.salon,
        staffProfileId: ids.profileA,
        startDate: '2026-10-01',
        endDate: '2026-10-31',
      })
      expect(report?.agreement).toMatchObject({
        active: false,
        overrides: [
          expect.objectContaining({ serviceId: ids.serviceB, percentage: 30 }),
        ],
      })
      expect(
        report?.rows.some((row) => row.appointmentId === whileDisabled),
      ).toBe(false)

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
      await appointmentQueries.updateAppointment(multiStaff, ids.salon, {
        status: 'completed',
      })
      expect(
        (
          await commissions.getStaffCommissionReport({
            salonId: ids.salon,
            staffProfileId: ids.profileA,
            startDate: '2026-10-06',
            endDate: '2026-10-06',
          })
        )?.rows,
      ).toEqual([
        expect.objectContaining({
          appointmentId: multiStaff,
          basis: 50,
          percentage: 30,
          amount: 15,
        }),
      ])
      expect(
        (
          await commissions.getStaffCommissionReport({
            salonId: ids.salon,
            staffProfileId: ids.profileB,
            startDate: '2026-10-06',
            endDate: '2026-10-06',
          })
        )?.rows,
      ).toEqual([
        expect.objectContaining({
          appointmentId: multiStaff,
          basis: 50,
          percentage: 20,
          amount: 10,
        }),
      ])

      await testSql!`
        update services set active = false where id = ${ids.serviceB}
      `
      await testSql!`
        delete from staff_services
        where salon_id = ${ids.salon} and staff_user_id = ${ids.profileA}
      `
      report = await commissions.getStaffCommissionReport({
        salonId: ids.salon,
        staffProfileId: ids.profileA,
        startDate: '2026-10-01',
        endDate: '2026-10-31',
      })
      expect(report?.agreement?.overrides).toEqual([
        expect.objectContaining({
          serviceId: ids.serviceB,
          serviceActive: false,
          percentage: 30,
        }),
      ])
      await expect(
        commissions.deleteServiceCommissionOverride({
          salonId: ids.salon,
          staffProfileId: ids.profileA,
          serviceId: ids.serviceB,
        }),
      ).resolves.toMatchObject({ ok: true, agreement: { overrides: [] } })
    })

    it('counts unique completed booked totals and stored commissions with filters', async () => {
      const extraCategory = randomUUID()
      const extraService = randomUUID()
      await testSql!`
        insert into service_categories (id, salon_id, name)
        values (${extraCategory}, ${ids.salon}, 'Color')
      `
      await testSql!`
        insert into services (id, salon_id, category_id, name, duration, price, color)
        values (${extraService}, ${ids.salon}, ${extraCategory}, 'Balayage', 30, 400, 'gold')
      `

      await commissions.setCommissionAgreement({
        salonId: ids.salon,
        staffProfileId: ids.profileA,
        percentageBasisPoints: 2000,
      })
      await commissions.setCommissionAgreement({
        salonId: ids.salon,
        staffProfileId: ids.profileB,
        percentageBasisPoints: 2000,
      })

      const withoutCommission = await insertAppointment({
        staffId: ids.profileB,
        date: '2026-11-02',
        price: 300,
      })
      const withCommission = await insertAppointment({
        date: '2026-11-03',
        price: 200,
      })
      const multiStaff = await insertAppointment({
        date: '2026-11-04',
        price: 100,
        staffAssignments: [
          {
            staffId: ids.profileA,
            allocationBasisPoints: 5000,
            isLead: true,
          },
          { staffId: ids.profileB, allocationBasisPoints: 5000 },
        ],
      })
      const otherCategoryAppointment = await insertAppointment({
        serviceId: extraService,
        date: '2026-11-05',
        price: 400,
      })
      const scheduled = await insertAppointment({
        date: '2026-11-06',
        price: 900,
      })

      await appointmentQueries.updateAppointment(withoutCommission, ids.salon, {
        status: 'completed',
      })
      await appointmentQueries.updateAppointment(withCommission, ids.salon, {
        status: 'completed',
      })
      await appointmentQueries.updateAppointment(multiStaff, ids.salon, {
        status: 'completed',
      })
      await appointmentQueries.updateAppointment(
        otherCategoryAppointment,
        ids.salon,
        { status: 'completed' },
      )

      const all = await commissions.getSalonMoneyReport({
        salonId: ids.salon,
        startDate: '2026-11-01',
        endDate: '2026-11-30',
      })
      expect(all.ok).toBe(true)
      if (!all.ok) return
      expect(all.report.appointments.map((row) => row.appointmentId)).toEqual(
        expect.arrayContaining([
          withoutCommission,
          withCommission,
          multiStaff,
          otherCategoryAppointment,
        ]),
      )
      expect(
        all.report.appointments.some((row) => row.appointmentId === scheduled),
      ).toBe(false)
      expect(all.report.summary.bookedTotal).toBe(1000)
      expect(all.report.summary.staffCommissionTotal).toBe(
        all.report.staff.reduce(
          (sum, row) => sum + row.staffCommissionTotal,
          0,
        ),
      )
      expect(all.report.summary.salonRetainedAmount).toBe(
        all.report.summary.bookedTotal -
          all.report.summary.staffCommissionTotal,
      )

      const staffA = await commissions.getSalonMoneyReport({
        salonId: ids.salon,
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        staffProfileId: ids.profileA,
      })
      expect(staffA.ok).toBe(true)
      if (!staffA.ok) return
      expect(
        staffA.report.appointments.map((row) => row.appointmentId).sort(),
      ).toEqual([withCommission, multiStaff, otherCategoryAppointment].sort())
      expect(staffA.report.summary.bookedTotal).toBe(700)
      // Staff cut is A's commissions only; salon cut subtracts A + B on those Appointments.
      expect(staffA.report.summary.staffCommissionTotal).toBe(130)
      expect(staffA.report.summary.salonRetainedAmount).toBe(560)

      const byService = await commissions.getSalonMoneyReport({
        salonId: ids.salon,
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        serviceId: extraService,
      })
      expect(byService.ok).toBe(true)
      if (!byService.ok) return
      expect(byService.report.appointments).toEqual([
        expect.objectContaining({
          appointmentId: otherCategoryAppointment,
          bookedTotal: 400,
        }),
      ])

      const byCategory = await commissions.getSalonMoneyReport({
        salonId: ids.salon,
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        categoryId: extraCategory,
      })
      expect(byCategory).toEqual(byService)

      await expect(
        commissions.getSalonMoneyReport({
          salonId: ids.salon,
          startDate: '2026-11-01',
          endDate: '2026-11-30',
          staffProfileId: randomUUID(),
        }),
      ).resolves.toEqual({ ok: false, reason: 'staff' })
      await expect(
        commissions.getSalonMoneyReport({
          salonId: ids.salon,
          startDate: '2026-11-01',
          endDate: '2026-11-30',
          serviceId: randomUUID(),
        }),
      ).resolves.toEqual({ ok: false, reason: 'service' })
      await expect(
        commissions.getSalonMoneyReport({
          salonId: ids.salon,
          startDate: '2026-11-01',
          endDate: '2026-11-30',
          categoryId: randomUUID(),
        }),
      ).resolves.toEqual({ ok: false, reason: 'category' })
    })
    it('audits staff transitions atomically with every assignment commission and preserves manager corrections', async () => {
      await testSql!`insert into staff_profile_accesses (salon_id, staff_profile_id, user_id, accepted_at)
        values (${ids.salon}, ${ids.profileA}, ${ids.staffUser}, now())`
      await commissions.setCommissionAgreement({
        salonId: ids.salon,
        staffProfileId: ids.profileA,
        percentageBasisPoints: 2000,
      })
      await commissions.setCommissionAgreement({
        salonId: ids.salon,
        staffProfileId: ids.profileB,
        percentageBasisPoints: 3000,
      })
      const actor = {
        userId: ids.staffUser,
        name: 'Staff Identity',
        staffProfileId: ids.profileA,
      }
      const manager = { userId: randomUUID(), name: 'Manager' }
      const id = await insertAppointment({
        date: '2026-12-01',
        price: 100,
        staffAssignments: [
          { staffId: ids.profileA, allocationBasisPoints: 5000, isLead: true },
          { staffId: ids.profileB, allocationBasisPoints: 5000 },
        ],
      })
      await Promise.all(
        [1, 2].map(() =>
          appointmentQueries.updateAppointment(
            id,
            ids.salon,
            { status: 'completed' },
            actor,
          ),
        ),
      )
      let history = await appointmentQueries.getAppointmentStatusHistory(
        id,
        ids.salon,
      )
      expect(history).toEqual([
        expect.objectContaining({
          salonId: ids.salon,
          appointmentId: id,
          actorUserId: ids.staffUser,
          actorName: actor.name,
          previousStatus: 'scheduled',
          newStatus: 'completed',
          changedAt: expect.any(Date),
        }),
      ])
      let rows =
        await testSql!`select * from staff_commissions where appointment_id = ${id}`
      expect(rows).toHaveLength(2)
      expect(rows.every((row) => row.voided_at === null)).toBe(true)
      await expect(
        appointmentQueries.updateAppointment(
          id,
          ids.salon,
          { status: 'confirmed' },
          actor,
        ),
      ).rejects.toThrow()
      expect(
        await appointmentQueries.getAppointmentStatusHistory(id, ids.salon),
      ).toHaveLength(1)
      await appointmentQueries.updateAppointment(
        id,
        ids.salon,
        { status: 'no-show' },
        manager,
      )
      await expect(
        appointmentQueries.updateAppointment(
          id,
          ids.salon,
          { status: 'completed' },
          actor,
        ),
      ).rejects.toThrow()
      rows =
        await testSql!`select * from staff_commissions where appointment_id = ${id}`
      expect(rows.every((row) => row.voided_at !== null)).toBe(true)
      await appointmentQueries.updateAppointment(
        id,
        ids.salon,
        { status: 'completed' },
        manager,
      )
      await appointmentQueries.updateAppointment(
        id,
        ids.salon,
        { status: 'completed' },
        manager,
      )
      rows =
        await testSql!`select * from staff_commissions where appointment_id = ${id}`
      expect(rows).toHaveLength(2)
      expect(rows.every((row) => row.voided_at === null)).toBe(true)
      history = await appointmentQueries.getAppointmentStatusHistory(
        id,
        ids.salon,
      )
      expect(history.map((row) => [row.previousStatus, row.newStatus])).toEqual(
        [
          ['scheduled', 'completed'],
          ['completed', 'no-show'],
          ['no-show', 'completed'],
        ],
      )
      expect(history[1]?.actorUserId).toBe(manager.userId)
      expect(
        await appointmentQueries.getAppointmentStatusHistory(id, randomUUID()),
      ).toEqual([])
      expect(
        await appointmentQueries.updateAppointment(
          id,
          randomUUID(),
          { status: 'confirmed' },
          actor,
        ),
      ).toBeUndefined()
      const additional = await insertAppointment({
        date: '2026-12-02',
        price: 100,
        staffAssignments: [
          { staffId: ids.profileB, allocationBasisPoints: 5000, isLead: true },
          { staffId: ids.profileA, allocationBasisPoints: 5000 },
        ],
      })
      await expect(
        appointmentQueries.updateAppointment(
          additional,
          ids.salon,
          { status: 'completed' },
          actor,
        ),
      ).rejects.toThrow()
      await expect(
        appointmentQueries.updateAppointment(
          additional,
          ids.salon,
          { status: 'confirmed', notes: 'forbidden' },
          actor,
        ),
      ).rejects.toThrow()
      await appointmentQueries.updateAppointment(
        additional,
        ids.salon,
        { status: 'confirmed' },
        actor,
      )
      await appointmentQueries.updateAppointment(
        additional,
        ids.salon,
        { status: 'no-show' },
        actor,
      )
      expect(
        await appointmentQueries.getAppointmentStatusHistory(
          additional,
          ids.salon,
        ),
      ).toHaveLength(2)
      const unassigned = await insertAppointment({
        date: '2026-12-03',
        price: 100,
        staffId: ids.profileB,
      })
      await expect(
        appointmentQueries.updateAppointment(
          unassigned,
          ids.salon,
          { status: 'confirmed' },
          actor,
        ),
      ).rejects.toThrow()
      const solo = await insertAppointment({ date: '2026-12-04', price: 100 })
      await appointmentQueries.updateAppointment(
        solo,
        ids.salon,
        { status: 'completed' },
        actor,
      )
      expect(
        await testSql!`select * from staff_commissions where appointment_id = ${solo}`,
      ).toHaveLength(1)
      const inactive = await insertAppointment({
        date: '2026-12-06',
        price: 100,
      })
      await testSql!`update staff_profiles set active = false where id = ${ids.profileA}`
      await expect(
        appointmentQueries.updateAppointment(
          inactive,
          ids.salon,
          { status: 'completed' },
          actor,
        ),
      ).rejects.toThrow()
      expect(
        await appointmentQueries.getAppointmentStatusHistory(
          inactive,
          ids.salon,
        ),
      ).toEqual([])
      await testSql!`update staff_profiles set active = true where id = ${ids.profileA}`
      const cancelled = await insertAppointment({
        date: '2026-12-07',
        price: 100,
        status: 'cancelled',
      })
      await expect(
        appointmentQueries.updateAppointment(
          cancelled,
          ids.salon,
          { status: 'confirmed' },
          actor,
        ),
      ).rejects.toThrow()
      const temporaryClientId = randomUUID()
      await testSql!`insert into clients (id, salon_id, name, is_placeholder) values (${temporaryClientId}, ${ids.salon}, 'Temporary Client', true)`
      const temporary = await insertAppointment({
        date: '2026-12-08',
        price: 100,
      })
      await testSql!`update appointments set client_id = ${temporaryClientId} where id = ${temporary}`
      const { cancelIncompletePlaceholderAppointment } =
        await import('./placeholder-client-queries')
      expect(
        await cancelIncompletePlaceholderAppointment({
          salonId: ids.salon,
          appointmentId: temporary,
          actor: manager,
        }),
      ).toMatchObject({ ok: true, appointmentDeleted: true })
      expect(
        await appointmentQueries.getAppointmentById(temporary, ids.salon),
      ).toBeUndefined()
      expect(
        await appointmentQueries.getAppointmentStatusHistory(
          temporary,
          ids.salon,
        ),
      ).toEqual([
        expect.objectContaining({
          previousStatus: 'scheduled',
          newStatus: 'cancelled',
          actorUserId: manager.userId,
        }),
      ])
      const revoked = await insertAppointment({
        date: '2026-12-05',
        price: 100,
      })
      await testSql!`update staff_profile_accesses set revoked_at = now() where user_id = ${ids.staffUser}`
      await expect(
        appointmentQueries.updateAppointment(
          revoked,
          ids.salon,
          { status: 'completed' },
          actor,
        ),
      ).rejects.toThrow()
      expect(
        await appointmentQueries.getAppointmentStatusHistory(
          revoked,
          ids.salon,
        ),
      ).toEqual([])
    })
  },
)
