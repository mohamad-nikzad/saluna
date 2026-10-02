import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres, { type Sql } from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { formatCompactServiceLabel } from '@repo/salon-core/service-catalog'

const databaseName = `saluna_appointment_details_test_${process.pid}_${Date.now()}`
const databaseUrl = `postgres://postgres:postgres@127.0.0.1:5432/${databaseName}`
const ids = {
  salon: randomUUID(),
  pendingStaff: randomUUID(),
  acceptedStaff: randomUUID(),
  client: randomUUID(),
  category: randomUUID(),
  service: randomUUID(),
  nailsCategory: randomUUID(),
  nailsService: randomUUID(),
  pendingAppointment: randomUUID(),
  acceptedAppointment: randomUUID(),
}
let adminSql: Sql | undefined
let testSql: Sql | undefined
let databaseCreated = false

describe.skipIf(process.env.RUN_DATABASE_INTEGRATION !== '1')(
  'Appointment details for prepared staff',
  () => {
    beforeAll(async () => {
      adminSql = postgres(
        'postgres://postgres:postgres@127.0.0.1:5432/postgres',
        {
          max: 1,
        },
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
      await testSql`insert into "user" (id, name, email, email_verified, phone_number) values (${ids.acceptedStaff}, 'Accepted staff', 'accepted@example.test', true, '09120000002')`
      await testSql`insert into member (id, organization_id, user_id, role) values (${randomUUID()}, ${ids.salon}, ${ids.acceptedStaff}, 'member')`
      await testSql`insert into staff_profiles (id, salon_id, name, phone, color) values (${ids.pendingStaff}, ${ids.salon}, 'Invited staff', '09120000001', 'rose')`
      await testSql`insert into service_categories (id, salon_id, name) values (${ids.category}, ${ids.salon}, 'مو'), (${ids.nailsCategory}, ${ids.salon}, 'ناخن')`
      await testSql`insert into services (id, salon_id, category_id, name, duration, price, color) values (${ids.service}, ${ids.salon}, ${ids.category}, 'Service', 30, 100, 'rose')`
      await testSql`insert into services (id, salon_id, category_id, name, duration, price, color) values (${ids.nailsService}, ${ids.salon}, ${ids.nailsCategory}, 'ترمیم ناخن', 30, 100, 'rose')`
      await testSql`insert into clients (id, salon_id, name, phone) values (${ids.client}, ${ids.salon}, 'Client', '09121111111')`

      for (const [appointmentId, staffId, date, serviceId, serviceName] of [
        [
          ids.pendingAppointment,
          ids.pendingStaff,
          '2026-10-01',
          ids.nailsService,
          'ترمیم ناخن',
        ],
        [
          ids.acceptedAppointment,
          ids.acceptedStaff,
          '2026-10-02',
          ids.service,
          'Service',
        ],
      ]) {
        await testSql`
          insert into appointments (
            id, salon_id, client_id, service_id, date, start_time, end_time,
            booked_service_name, booked_service_duration, booked_service_price,
            booked_total_duration, booked_total_price, status
          ) values (
            ${appointmentId}, ${ids.salon}, ${ids.client}, ${serviceId},
            ${date}, '10:00', '10:30', ${serviceName}, 30, 100, 30, 100, 'scheduled'
          )
        `
        await testSql`
          insert into appointment_staff_assignments (
            id, salon_id, appointment_id, staff_id, is_lead, allocation_basis_points
          ) values (
            ${randomUUID()}, ${ids.salon}, ${appointmentId}, ${staffId}, true, 10000
          )
        `
      }
    }, 30_000)

    afterAll(async () => {
      const globals = globalThis as typeof globalThis & {
        __salon_postgres?: Sql
        __salon_drizzle?: unknown
      }
      await globals.__salon_postgres?.end({ timeout: 5 })
      delete globals.__salon_postgres
      delete globals.__salon_drizzle
      await testSql?.end({ timeout: 5 })
      if (databaseCreated && adminSql) {
        await adminSql`drop database ${adminSql(databaseName)} with (force)`
      }
      await adminSql?.end({ timeout: 5 })
    }, 30_000)

    it.each([true, false])(
      'keeps each appointment category in calendar, history and detail with catalog active=%s',
      async (active) => {
        const sql = testSql
        if (!sql) throw new Error('Test database not initialized')
        await sql`update service_categories set active = ${active} where id = ${ids.nailsCategory}`
        await sql`update services set active = ${active} where id = ${ids.nailsService}`
        const queries = await import('./appointment-queries')
        const calendar = await queries.getAppointmentsWithDetailsByDateRange(
          ids.salon,
          '2026-10-01',
          '2026-10-02',
        )
        const history = await queries.getClientAppointmentsWithDetails(
          ids.salon,
          ids.client,
        )
        const detail = await queries.getAppointmentWithDetailsById(
          ids.pendingAppointment,
          ids.salon,
        )
        for (const appointment of [
          calendar.find((item) => item.id === ids.pendingAppointment),
          history.find((item) => item.id === ids.pendingAppointment),
          detail,
        ]) {
          expect(appointment?.service).toMatchObject({
            categoryId: ids.nailsCategory,
            categoryName: 'ناخن',
            category: 'nails',
            familyId: null,
          })
          expect(formatCompactServiceLabel(appointment?.service)).toBe(
            'ناخن / ترمیم ناخن',
          )
        }
        expect(
          calendar.find((item) => item.id === ids.acceptedAppointment)?.service,
        ).toMatchObject({ categoryId: ids.category, categoryName: 'مو' })
      },
    )

    it('shows the pending staff booking on calendar, client history and detail while it blocks overlap', async () => {
      const queries = await import('./appointment-queries')
      const calendar = await queries.getAppointmentsWithDetailsByDateRange(
        ids.salon,
        '2026-10-01',
        '2026-10-02',
      )
      expect(calendar.map((appointment) => appointment.id)).toEqual([
        ids.pendingAppointment,
        ids.acceptedAppointment,
      ])
      expect(calendar[0]?.staff).toMatchObject({
        id: ids.pendingStaff,
        name: 'Invited staff',
      })
      expect(calendar[1]?.staff).toMatchObject({
        id: ids.acceptedStaff,
        name: 'Accepted staff',
      })

      const history = await queries.getClientAppointmentsWithDetails(
        ids.salon,
        ids.client,
      )
      expect(history.map((appointment) => appointment.id)).toContain(
        ids.pendingAppointment,
      )
      expect(
        await queries.getAppointmentWithDetailsById(
          ids.pendingAppointment,
          ids.salon,
        ),
      ).toMatchObject({
        id: ids.pendingAppointment,
        staff: { id: ids.pendingStaff },
      })
      expect(
        await queries.getScheduleOverlapFlags(
          ids.salon,
          ids.pendingStaff,
          ids.client,
          '2026-10-01',
          '10:00',
          '10:30',
        ),
      ).toMatchObject({ staffConflict: true, clientConflict: true })

      const reassigned = await queries.updateAppointment(
        ids.pendingAppointment,
        ids.salon,
        {
          staffAssignments: [
            {
              staffId: ids.acceptedStaff,
              isLead: true,
              allocationBasisPoints: 10000,
            },
          ],
        },
      )
      expect(reassigned?.staffAssignments).toMatchObject([
        { staffId: ids.acceptedStaff, isLead: true },
      ])
      expect(
        await queries.getAppointmentWithDetailsById(
          ids.pendingAppointment,
          ids.salon,
        ),
      ).toMatchObject({ staff: { id: ids.acceptedStaff } })
      expect(
        await queries.getScheduleOverlapFlags(
          ids.salon,
          ids.pendingStaff,
          randomUUID(),
          '2026-10-01',
          '10:00',
          '10:30',
        ),
      ).toMatchObject({ staffConflict: false, clientConflict: false })
    })
  },
)
