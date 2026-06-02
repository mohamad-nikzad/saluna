#!/usr/bin/env node
/**
 * Repair local DBs where onboarding schema was applied via `db:push` or manual SQL
 * but `drizzle.__drizzle_migrations` is behind. Then pending SQL can run cleanly.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const migrationsDir = path.join(repoRoot, 'packages/database/src/migrations')

function loadEnvFile(fileName) {
  const filePath = path.join(repoRoot, fileName)
  let contents
  try {
    contents = readFileSync(filePath, 'utf8')
  } catch {
    return
  }
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex <= 0) continue
    const key = trimmed.slice(0, separatorIndex).trim()
    if (!key || process.env[key] !== undefined) continue
    let value = trimmed.slice(separatorIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

loadEnvFile('.env')
loadEnvFile('.env.local')
loadEnvFile('.env.database.local')

const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL
if (!url) {
  console.error('Missing DATABASE_URL — create .env.database.local first.')
  process.exit(1)
}

const journal = JSON.parse(readFileSync(path.join(migrationsDir, 'meta/_journal.json'), 'utf8'))

/** @type {{ tag: string, ready: (sql: import('postgres').Sql) => Promise<boolean> }[]} */
const featureMigrations = [
  {
    tag: '0003_sad_centennial',
    ready: async (sql) => {
      const rows = await sql`
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'business_settings' AND column_name = 'working_days'
        LIMIT 1
      `
      return rows.length > 0
    },
  },
  {
    tag: '0004_fast_terror',
    ready: async (sql) => {
      const rows = await sql`
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'salon_onboarding' AND column_name = 'manager_is_staff'
        LIMIT 1
      `
      return rows.length > 0
    },
  },
  {
    tag: '0005_business_hours_confirmed',
    ready: async (sql) => {
      const rows = await sql`
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'salon_onboarding' AND column_name = 'business_hours_confirmed_at'
        LIMIT 1
      `
      return rows.length > 0
    },
  },
]

function journalWhen(tag) {
  const entry = journal.entries.find((e) => e.tag === tag)
  if (!entry) throw new Error(`Missing journal entry for ${tag}`)
  return entry.when
}

const sql = postgres(url, { max: 1 })

try {
  await sql`CREATE SCHEMA IF NOT EXISTS drizzle`
  await sql`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `

  const [lastApplied] = await sql`
    SELECT created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1
  `
  const lastWhen = lastApplied ? Number(lastApplied.created_at) : 0

  let highestReady = null
  for (const migration of featureMigrations) {
    if (await migration.ready(sql)) highestReady = migration
  }

  if (!highestReady) {
    console.log('Feature columns not present yet — nothing to reconcile.')
    process.exit(0)
  }

  const markWhen = journalWhen(highestReady.tag)
  if (markWhen <= lastWhen) {
    console.log('Drizzle journal is already up to date for feature migrations.')
    process.exit(0)
  }

  await sql`
    INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
    VALUES (${highestReady.tag}, ${markWhen})
  `
  console.log(`Marked ${highestReady.tag} as applied (created_at=${markWhen}).`)
} finally {
  await sql.end()
}
