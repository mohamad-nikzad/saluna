import { writeFile } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import { parseArgs } from 'node:util'
import postgres from 'postgres'
import { getDatabaseUrl } from '@repo/database/config'
import { repairStaffIdentities } from '@repo/database/staff-identity-repair'

async function main() {
  const { values } = parseArgs({
    options: {
      apply: { type: 'boolean', default: false },
      recovery: { type: 'string' },
      salon: { type: 'string' },
    },
  })
  const apply = values.apply
  const recoveryPath = values.recovery
  if (
    values.salon &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      values.salon,
    )
  ) {
    throw new Error('--salon must be a salon UUID')
  }
  if (apply && (!recoveryPath || !isAbsolute(recoveryPath))) {
    throw new Error(
      'Use --apply --recovery /absolute/path/report.json after taking a database backup',
    )
  }
  const sql = postgres(getDatabaseUrl({ preferDirect: true }), { max: 1 })
  try {
    const report = await repairStaffIdentities(sql, {
      apply,
      salonId: values.salon,
      saveRecovery: recoveryPath
        ? async (snapshot) => {
            await writeFile(recoveryPath, JSON.stringify(snapshot, null, 2), {
              mode: 0o600,
              flag: 'wx',
            })
          }
        : undefined,
    })
    // Keep names, phone numbers, and row snapshots in the private recovery file.
    console.log(
      JSON.stringify(
        {
          applied: report.applied,
          profilesCreated: report.profilesCreated.length,
          mappings: report.mappings,
          before: report.before,
          after: report.after,
          unresolved: report.unresolved,
        },
        null,
        2,
      ),
    )
  } finally {
    await sql.end()
  }
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
