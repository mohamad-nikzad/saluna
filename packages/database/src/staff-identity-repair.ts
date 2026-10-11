import { randomUUID } from 'node:crypto'
import type { Sql } from 'postgres'

// Only these operational references are repairable. Authentication, status history,
// allocation, assignment IDs, and earned commission snapshots are never rewritten.
const references = [
  {
    table: 'appointment_staff_assignments',
    column: 'staff_id',
    key: ['appointment_id'],
  },
  { table: 'staff_services', column: 'staff_user_id', key: ['service_id'] },
  { table: 'staff_schedules', column: 'staff_id', key: ['day_of_week'] },
  {
    table: 'staff_package_capabilities',
    column: 'staff_id',
    key: ['package_id'],
  },
  { table: 'appointment_requests', column: 'staff_id', key: [] },
  { table: 'service_package_tasks', column: 'staff_id', key: [] },
  { table: 'service_package_bookings', column: 'lead_staff_id', key: [] },
] as const

type Profile = {
  id: string
  salon_id: string
  user_id: string | null
  name: string
  phone: string
  active: boolean
}
type ReferenceRow = Record<string, unknown> & { salon_id: string }
type Mapping = { salonId: string; userId: string; profileId: string }
export type StaffIdentityRepairReport = {
  applied: boolean
  profilesCreated: Profile[]
  mappings: Mapping[]
  unresolved: Array<{ salonId: string; staffId: string; reason: string }>
  before: Record<string, number>
  after: Record<string, number>
  recovery: Array<{
    table: string
    column: string
    row: ReferenceRow
    profileId: string
  }>
}

/** Audit all salons or repair unambiguous salon-owned references in one transaction.
 * Applying requires saving the recovery report before the first database write.
 * A table lock prevents access lifecycle and scheduling writes changing the mapping
 * between inspection and repair. Missing or conflicting ownership is left untouched.
 */
export async function repairStaffIdentities(
  sql: Sql,
  options: {
    salonId?: string
    apply?: boolean
    saveRecovery?: (report: StaffIdentityRepairReport) => Promise<void>
  } = {},
): Promise<StaffIdentityRepairReport> {
  if (options.apply && !options.saveRecovery)
    throw new Error('Applying requires a recovery report destination')
  return sql.begin(async (tx) => {
    if (options.apply) {
      await tx`set local lock_timeout = '10s'`
      for (const table of [
        'staff_profiles',
        'staff_profile_accesses',
        'member',
        'salon_member',
        'user',
        ...references.map((ref) => ref.table),
      ]) {
        await tx`lock table ${tx(table)} in share row exclusive mode`
      }
    } else {
      await tx`set transaction isolation level repeatable read, read only`
    }
    const report: StaffIdentityRepairReport = {
      applied: false,
      profilesCreated: [],
      mappings: [],
      unresolved: [],
      before: {},
      after: {},
      recovery: [],
    }
    const profiles = await tx<
      Profile[]
    >`select id, salon_id, user_id, name, phone, active from staff_profiles`
    const accesses = await tx<
      { salon_id: string; user_id: string; staff_profile_id: string }[]
    >`select salon_id, user_id, staff_profile_id from staff_profile_accesses`
    const members = await tx<
      {
        salon_id: string
        user_id: string
        name: string
        phone: string | null
        active: boolean
      }[]
    >`
      select m.organization_id as salon_id, m.user_id, coalesce(sm.display_name, u.name) as name,
        coalesce(u.phone_number, u.username) as phone, coalesce(sm.active, true) as active
      from member m join "user" u on u.id = m.user_id
      left join salon_member sm on sm.organization_id = m.organization_id and sm.user_id = m.user_id`
    const key = (salon: string, id: string) => `${salon}/${id}`
    const candidates = new Map<string, Set<string>>()
    const add = (salon: string, identity: string, profile: string) => {
      const ids = candidates.get(key(salon, identity)) ?? new Set<string>()
      ids.add(profile)
      candidates.set(key(salon, identity), ids)
    }
    for (const p of profiles) if (p.user_id) add(p.salon_id, p.user_id, p.id)
    for (const a of accesses) {
      // Historical access is useful evidence of ownership, never permission to log in.
      if (
        profiles.some(
          (p) => p.id === a.staff_profile_id && p.salon_id === a.salon_id,
        )
      )
        add(a.salon_id, a.user_id, a.staff_profile_id)
    }
    for (const m of members) {
      if (options.salonId && m.salon_id !== options.salonId) continue
      if (candidates.has(key(m.salon_id, m.user_id))) continue
      if (
        !m.phone ||
        profiles.some((p) => p.salon_id === m.salon_id && p.phone === m.phone)
      ) {
        report.unresolved.push({
          salonId: m.salon_id,
          staffId: m.user_id,
          reason:
            'Missing phone or an existing profile owns this phone; explicit mapping required',
        })
        continue
      }
      const p: Profile = {
        id: randomUUID(),
        salon_id: m.salon_id,
        user_id: m.user_id,
        name: m.name,
        phone: m.phone,
        active: m.active,
      }
      profiles.push(p)
      report.profilesCreated.push(p)
      add(m.salon_id, m.user_id, p.id)
    }
    const canonical = new Set(profiles.map((p) => key(p.salon_id, p.id)))
    const blocked = new Set<string>()
    const unresolved = (salon: string, id: string, reason: string) => {
      const k = key(salon, id)
      if (!blocked.has(k))
        report.unresolved.push({ salonId: salon, staffId: id, reason })
      blocked.add(k)
    }
    for (const ref of references) {
      const rows = await tx<
        ReferenceRow[]
      >`select * from ${tx(ref.table)} ${options.salonId ? tx`where salon_id = ${options.salonId}` : tx``}`
      report.before[ref.table] = rows.filter(
        (r) =>
          r[ref.column] &&
          !canonical.has(key(r.salon_id, String(r[ref.column]))),
      ).length
      // Check the final unique keys, including collisions between two source IDs.
      const destinations = new Map<string, string>()
      for (const row of rows) {
        const id = row[ref.column] as string | null
        if (!id) continue
        const k = key(row.salon_id, id)
        const ids = candidates.get(k)
        if (!canonical.has(k) && ids?.size !== 1) {
          unresolved(
            row.salon_id,
            id,
            ids?.size
              ? 'Ambiguous Staff Profile ownership'
              : 'No salon-owned Staff Profile mapping',
          )
          continue
        }
        const destination = canonical.has(k) ? id : [...ids!][0]!
        if (!canonical.has(k)) {
          report.recovery.push({
            table: ref.table,
            column: ref.column,
            row,
            profileId: destination,
          })
        }
        if (ref.key.length === 0) continue
        const unique = JSON.stringify([
          row.salon_id,
          destination,
          ...ref.key.map((column) => row[column]),
        ])
        const prior = destinations.get(unique)
        if (prior && prior !== id) {
          if (!canonical.has(key(row.salon_id, prior)))
            unresolved(
              row.salon_id,
              prior,
              `Conflicting ${ref.table} destination`,
            )
          if (!canonical.has(k))
            unresolved(row.salon_id, id, `Conflicting ${ref.table} destination`)
        }
        destinations.set(unique, id)
      }
    }
    report.recovery = report.recovery.filter(
      ({ row, column }) => !blocked.has(key(row.salon_id, String(row[column]))),
    )
    for (const [k, ids] of candidates) {
      const [salonId, userId] = k.split('/') as [string, string]
      if (options.salonId && salonId !== options.salonId) continue
      if (ids.size !== 1 || blocked.has(k)) continue
      report.mappings.push({ salonId, userId, profileId: [...ids][0]! })
    }
    if (options.apply) {
      await options.saveRecovery!(report)
      for (const p of report.profilesCreated) {
        await tx`insert into staff_profiles (id, salon_id, user_id, name, phone, active, claimed_at)
          values (${p.id}, ${p.salon_id}, ${p.user_id}, ${p.name}, ${p.phone}, ${p.active}, now())`
      }
      for (const mapping of report.mappings) {
        if (mapping.profileId === mapping.userId) continue
        for (const ref of references) {
          await tx`update ${tx(ref.table)} set ${tx(ref.column)} = ${mapping.profileId}
            where salon_id = ${mapping.salonId} and ${tx(ref.column)} = ${mapping.userId}`
        }
      }
      report.applied = true
    }
    for (const ref of references) {
      if (!options.apply) {
        report.after[ref.table] = report.before[ref.table]!
        continue
      }
      const [count] = await tx<
        { count: number }[]
      >`select count(*)::int as count from ${tx(ref.table)} r
        left join staff_profiles p on p.id = r.${tx(ref.column)} and p.salon_id = r.salon_id
        where r.${tx(ref.column)} is not null and p.id is null
        ${options.salonId ? tx`and r.salon_id = ${options.salonId}` : tx``}`
      report.after[ref.table] = count!.count
    }
    return report
  }) as Promise<StaffIdentityRepairReport>
}
