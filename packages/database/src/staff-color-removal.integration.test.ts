import { randomUUID } from 'node:crypto'
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { describe, expect, it } from 'vitest'

const migrationsFolder = fileURLToPath(new URL('./migrations', import.meta.url))

describe.skipIf(process.env.RUN_DATABASE_INTEGRATION !== '1')(
  'Staff Profile color removal migration',
  () => {
    it('retains existing profiles and operational references while removing colors', async () => {
      const databaseName = `saluna_staff_colors_test_${process.pid}_${Date.now()}`
      const adminSql = postgres(
        'postgres://postgres:postgres@127.0.0.1:5432/postgres',
        { max: 1 },
      )
      const sql = postgres(
        `postgres://postgres:postgres@127.0.0.1:5432/${databaseName}`,
        { max: 1 },
      )
      const baselineFolder = mkdtempSync(
        path.join(tmpdir(), 'saluna-staff-colors-'),
      )
      let created = false
      try {
        await adminSql`create database ${adminSql(databaseName)}`
        created = true
        cpSync(migrationsFolder, baselineFolder, { recursive: true })
        const journalPath = path.join(baselineFolder, 'meta/_journal.json')
        const journal = JSON.parse(readFileSync(journalPath, 'utf8'))
        const removalIndex = journal.entries.findIndex(
          (entry: { tag: string }) =>
            entry.tag === '0034_remove_staff_profile_colors',
        )
        if (removalIndex < 0)
          throw new Error('Missing Staff Profile color removal migration')
        journal.entries = journal.entries.slice(0, removalIndex)
        writeFileSync(journalPath, JSON.stringify(journal))
        await migrate(drizzle(sql), { migrationsFolder: baselineFolder })

        const ids = Object.fromEntries(
          [
            'salon',
            'user',
            'profile',
            'category',
            'service',
            'client',
            'appointment',
            'assignment',
          ].map((name) => [name, randomUUID()]),
        )
        await sql`insert into organization (id, name, slug) values (${ids.salon}, 'Salon', ${databaseName})`
        await sql`insert into "user" (id, name, email) values (${ids.user}, 'Staff', 'staff@example.test')`
        await sql`insert into member (organization_id, user_id, role) values (${ids.salon}, ${ids.user}, 'member')`
        await sql`insert into salon_member (organization_id, user_id, display_name, color) values (${ids.salon}, ${ids.user}, 'Mina', 'mint')`
        await sql`insert into staff_profiles (id, salon_id, user_id, name, phone, color) values (${ids.profile}, ${ids.salon}, ${ids.user}, 'Mina', '09120000001', 'mint')`
        await sql`insert into staff_profile_accesses (salon_id, staff_profile_id, user_id, accepted_at) values (${ids.salon}, ${ids.profile}, ${ids.user}, now())`
        await sql`insert into staff_schedules (salon_id, staff_id, day_of_week, working_start, working_end) values (${ids.salon}, ${ids.profile}, 0, '09:00', '17:00')`
        await sql`insert into service_categories (id, salon_id, name) values (${ids.category}, ${ids.salon}, 'Hair')`
        await sql`insert into services (id, salon_id, category_id, name, duration, price, color) values (${ids.service}, ${ids.salon}, ${ids.category}, 'Cut', 30, 100000, 'rose')`
        await sql`insert into staff_services (staff_user_id, service_id, salon_id) values (${ids.profile}, ${ids.service}, ${ids.salon})`
        await sql`insert into clients (id, salon_id, name) values (${ids.client}, ${ids.salon}, 'Client')`
        await sql`insert into appointments (id, salon_id, client_id, service_id, date, start_time, end_time, booked_service_name, booked_service_duration, booked_service_price, booked_total_duration, booked_total_price, status) values (${ids.appointment}, ${ids.salon}, ${ids.client}, ${ids.service}, '2026-10-11', '10:00', '10:30', 'Cut', 30, 100000, 30, 100000, 'completed')`
        await sql`insert into appointment_staff_assignments (id, salon_id, appointment_id, staff_id, is_lead, allocation_basis_points) values (${ids.assignment}, ${ids.salon}, ${ids.appointment}, ${ids.profile}, true, 10000)`
        await sql`insert into staff_commissions (salon_id, staff_profile_id, appointment_id, appointment_staff_assignment_id, basis, percentage_basis_points, amount) values (${ids.salon}, ${ids.profile}, ${ids.appointment}, ${ids.assignment}, 100000, 5000, 50000)`

        const tables = [
          'staff_profiles',
          'salon_member',
          'member',
          'staff_profile_accesses',
          'staff_schedules',
          'staff_services',
          'appointments',
          'appointment_staff_assignments',
          'staff_commissions',
        ]
        const before = await Promise.all(
          tables.map((table) => sql`select * from ${sql(table)}`),
        )
        await migrate(drizzle(sql), { migrationsFolder })
        const after = await Promise.all(
          tables.map((table) => sql`select * from ${sql(table)}`),
        )
        expect(after).toEqual(
          before.map((rows) => rows.map(({ color: _color, ...row }) => row)),
        )
        const columns =
          await sql`select column_name from information_schema.columns where table_schema = 'public' and table_name in ('staff_profiles', 'salon_member') and column_name = 'color'`
        expect(columns).toHaveLength(0)
        expect(
          (await sql`select color from services where id = ${ids.service}`)[0]
            ?.color,
        ).toBe('rose')
        await sql`update staff_profiles set name = 'Mina updated' where id = ${ids.profile}`
        await sql`insert into staff_profiles (salon_id, name, phone) values (${ids.salon}, 'Sara', '09120000002')`
        expect(
          (await sql`select name from staff_profiles order by name`).map(
            (row) => row.name,
          ),
        ).toEqual(['Mina updated', 'Sara'])
      } finally {
        await sql.end({ timeout: 5 })
        if (created) await adminSql`drop database ${adminSql(databaseName)}`
        await adminSql.end({ timeout: 5 })
        rmSync(baselineFolder, { recursive: true, force: true })
      }
    }, 30000)
  },
)
