import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres, { type Sql } from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const runIntegration = process.env.RUN_DATABASE_INTEGRATION === '1'
const databaseName = `saluna_handoff_test_${process.pid}_${Date.now()}`
const adminUrl = 'postgres://postgres:postgres@127.0.0.1:5432/postgres'
const databaseUrl = `postgres://postgres:postgres@127.0.0.1:5432/${databaseName}`
const migrationsFolder = fileURLToPath(new URL('./migrations', import.meta.url))

type HandoffQueries = typeof import('./salon-handoff')

let adminSql: Sql | undefined
let testSql: Sql | undefined
let queries: HandoffQueries
let databaseCreated = false

const ids = {
  admin: randomUUID(),
  eligibleOwner: randomUUID(),
  publishedOwner: randomUUID(),
  conflictingOwner: randomUUID(),
  existingSalon: randomUUID(),
  retrySalon: randomUUID(),
  publishedSalon: randomUUID(),
  conflictSalon: randomUUID(),
  supersededSalon: randomUUID(),
}

const phones = {
  eligibleOwner: '09120000001',
  publishedOwner: '09120000002',
  conflictingOwner: '09120000003',
}

function assertDisposableDatabase(url: string) {
  const parsed = new URL(url)
  if (
    parsed.hostname !== '127.0.0.1' ||
    !parsed.pathname.slice(1).startsWith('saluna_handoff_test_')
  ) {
    throw new Error(`Refusing to use non-disposable database: ${url}`)
  }
}

async function seed(sql: Sql) {
  await sql`
    insert into "user" (
      id, name, email, email_verified, username, phone_number,
      phone_number_verified, created_at, updated_at
    )
    values
      (${ids.admin}, 'Admin', 'handoff-admin@example.test', true, null, null, false, now(), now()),
      (${ids.eligibleOwner}, 'Eligible', 'eligible@example.test', true, ${phones.eligibleOwner}, ${phones.eligibleOwner}, true, now(), now()),
      (${ids.publishedOwner}, 'Published', 'published@example.test', true, ${phones.publishedOwner}, ${phones.publishedOwner}, true, now(), now()),
      (${ids.conflictingOwner}, 'Conflict', 'conflict@example.test', true, ${phones.conflictingOwner}, ${phones.conflictingOwner}, true, now(), now())
  `
  await sql`
    insert into account (account_id, provider_id, user_id, password)
    values
      (${phones.eligibleOwner}, 'credential', ${ids.eligibleOwner}, 'existing-hash'),
      (${phones.publishedOwner}, 'credential', ${ids.publishedOwner}, 'existing-hash'),
      (${phones.conflictingOwner}, 'credential', ${ids.conflictingOwner}, 'existing-hash')
  `
  await sql`
    insert into organization (id, name, slug)
    values
      (${ids.existingSalon}, 'Existing Salon', 'existing-salon'),
      (${ids.retrySalon}, 'Retry Salon', 'retry-salon'),
      (${ids.publishedSalon}, 'Published Salon', 'published-salon'),
      (${ids.conflictSalon}, 'Conflict Salon', 'conflict-salon'),
      (${ids.supersededSalon}, 'Superseded Salon', 'superseded-salon')
  `
  await sql`
    insert into salon_profile (organization_id, status, intended_owner_phone)
    values
      (${ids.existingSalon}, 'active', null),
      (${ids.retrySalon}, 'setup', ${phones.eligibleOwner}),
      (${ids.publishedSalon}, 'setup', ${phones.publishedOwner}),
      (${ids.conflictSalon}, 'setup', ${phones.conflictingOwner}),
      (${ids.supersededSalon}, 'setup', ${phones.eligibleOwner})
  `
  await sql`
    insert into salon_public_settings (
      salon_id, enabled, appointment_requests_enabled
    )
    values
      (${ids.existingSalon}, true, true),
      (${ids.retrySalon}, false, false),
      (${ids.publishedSalon}, false, false),
      (${ids.conflictSalon}, false, false),
      (${ids.supersededSalon}, false, false)
  `
  await sql`
    insert into salon_onboarding (salon_id)
    values
      (${ids.retrySalon}),
      (${ids.publishedSalon}),
      (${ids.conflictSalon}),
      (${ids.supersededSalon})
  `
  await sql`
    insert into member (organization_id, user_id, role)
    values (${ids.existingSalon}, ${ids.conflictingOwner}, 'owner')
  `
}

describe.skipIf(!runIntegration)('Salon Handoff Postgres integration', () => {
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
    queries = await import('./salon-handoff')
  }, 30_000)

  afterAll(async () => {
    const globals = globalThis as typeof globalThis & {
      __salon_postgres?: Sql
      __salon_drizzle?: unknown
    }
    if (globals.__salon_postgres) {
      await globals.__salon_postgres.end({ timeout: 5 })
    }
    delete globals.__salon_postgres
    delete globals.__salon_drizzle
    if (testSql) await testSql.end({ timeout: 5 })

    if (adminSql && databaseCreated) {
      assertDisposableDatabase(databaseUrl)
      await adminSql`drop database if exists ${adminSql(databaseName)} with (force)`
    }
    if (adminSql) await adminSql.end({ timeout: 5 })
  }, 30_000)

  it('returns the same ownership state on retry without duplicate rows', async () => {
    const handoff = await queries.createSalonHandoff({
      salonId: ids.retrySalon,
      createdByUserId: ids.admin,
      enablePublicPage: false,
    })
    const input = {
      token: handoff.token,
      userId: ids.eligibleOwner,
      displayName: 'Eligible Owner',
    }

    expect(await queries.completeSalonHandoff(input)).toEqual({
      status: 'completed',
      salonId: ids.retrySalon,
      publicEnabled: false,
    })
    expect(await queries.completeSalonHandoff(input)).toEqual({
      status: 'completed',
      salonId: ids.retrySalon,
      publicEnabled: false,
    })

    const [counts] = await testSql!`
      select
        (select count(*)::int from member where organization_id = ${ids.retrySalon}) as members,
        (select count(*)::int from salon_member where organization_id = ${ids.retrySalon}) as sidecars
    `
    expect(counts).toEqual({ members: 1, sidecars: 1 })
  })

  it('publishes only after a successful handoff when explicitly selected', async () => {
    const handoff = await queries.createSalonHandoff({
      salonId: ids.publishedSalon,
      createdByUserId: ids.admin,
      enablePublicPage: true,
    })

    expect(
      await queries.completeSalonHandoff({
        token: handoff.token,
        userId: ids.publishedOwner,
        displayName: 'Published Owner',
      }),
    ).toEqual({
      status: 'completed',
      salonId: ids.publishedSalon,
      publicEnabled: true,
    })

    const [state] = await testSql!`
      select sp.status, sps.enabled
      from salon_profile sp
      join salon_public_settings sps on sps.salon_id = sp.organization_id
      where sp.organization_id = ${ids.publishedSalon}
    `
    expect(state).toEqual({ status: 'active', enabled: true })
  })

  it('rejects conflicting identities and superseded links', async () => {
    const conflict = await queries.createSalonHandoff({
      salonId: ids.conflictSalon,
      createdByUserId: ids.admin,
      enablePublicPage: true,
    })
    const stale = await queries.createSalonHandoff({
      salonId: ids.supersededSalon,
      createdByUserId: ids.admin,
      enablePublicPage: false,
    })
    await queries.createSalonHandoff({
      salonId: ids.supersededSalon,
      createdByUserId: ids.admin,
      enablePublicPage: false,
    })

    expect(
      await queries.completeSalonHandoff({
        token: conflict.token,
        userId: ids.conflictingOwner,
        displayName: 'Conflict Owner',
      }),
    ).toMatchObject({
      status: 'identity_conflict',
      conflict: { salonName: 'Existing Salon', salonStatus: 'active' },
    })
    expect(
      await queries.completeSalonHandoff({
        token: stale.token,
        userId: ids.eligibleOwner,
        displayName: 'Eligible Owner',
      }),
    ).toEqual({ status: 'invalid' })

    const [state] = await testSql!`
      select sp.status, sps.enabled
      from salon_profile sp
      join salon_public_settings sps on sps.salon_id = sp.organization_id
      where sp.organization_id = ${ids.conflictSalon}
    `
    expect(state).toEqual({ status: 'setup', enabled: false })
  })
})
