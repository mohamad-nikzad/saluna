import { cpSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')
const metaDir = path.join(repoRoot, 'packages/database/src/migrations/meta')

const tempDir = mkdtempSync(path.join(os.tmpdir(), 'saluna-drizzle-check-'))

try {
  cpSync(metaDir, path.join(tempDir, 'meta'), { recursive: true })

  const result = spawnSync(
    'pnpm',
    [
      'exec',
      'drizzle-kit',
      'generate',
      '--schema=packages/database/src/schema.ts',
      '--dialect=postgresql',
      `--out=${tempDir}`,
    ],
    {
      cwd: repoRoot,
      encoding: 'utf8',
    },
  )

  const output = [result.stdout, result.stderr]
    .filter(Boolean)
    .join('\n')
    .trim()

  if (result.status !== 0) {
    console.error(output || 'drizzle-kit generate failed')
    process.exit(result.status ?? 1)
  }

  const generatedSql = readdirSync(tempDir).filter((file) =>
    file.endsWith('.sql'),
  )

  if (generatedSql.length > 0) {
    console.error(
      'Schema drift detected: checked-in migrations do not match schema.ts.',
    )
    console.error(`Generated migration preview: ${generatedSql.join(', ')}`)
    console.error(
      'Run `pnpm db:generate` and commit the resulting migration files.',
    )
    process.exit(1)
  }

  console.log('Database schema and checked-in migrations are in sync.')
} finally {
  rmSync(tempDir, { recursive: true, force: true })
}
