#!/usr/bin/env node
// Real product authentication against a fresh isolated database. No auth mocks.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'

const [directory] = process.argv.slice(2)
assert(
  directory && resolve(directory) === directory,
  'Use an absolute private directory',
)
const privateEnv = Object.fromEntries(
  (await readFile(resolve(directory, 'recovery.env'), 'utf8'))
    .split('\n')
    .filter((line) => line.includes('='))
    .map((line) => [
      line.slice(0, line.indexOf('=')),
      line.slice(line.indexOf('=') + 1),
    ]),
)
assert.equal(privateEnv.COMPOSE_PROJECT_NAME, 'saluna-cms-bl0087-recovery')
assert.equal(privateEnv.CMS_REHEARSAL_DB_PORT, '35434')
const credentials = JSON.parse(
  await readFile(resolve(directory, 'agent-oauth.json'), 'utf8'),
)
const name = `saluna_agent_denial_${process.pid}_${Date.now()}`
const origin = `postgres://operator:${encodeURIComponent(privateEnv.POSTGRES_PASSWORD)}@127.0.0.1:35434`
const admin = postgres(`${origin}/postgres`, { max: 1, onnotice: () => {} })
const sql = postgres(`${origin}/${name}`, { max: 1, onnotice: () => {} })
let created = false
try {
  await admin`create database ${admin(name)}`
  created = true
  await migrate(drizzle(sql), {
    migrationsFolder: fileURLToPath(
      new URL('../../packages/database/src/migrations', import.meta.url),
    ),
  })
  Object.assign(process.env, {
    DATABASE_URL: `${origin}/${name}`,
    DATABASE_URL_DIRECT: `${origin}/${name}`,
    NODE_ENV: 'test',
    DISABLE_REQUEST_LOG: '1',
    BETTER_AUTH_SECRET: randomBytes(32).toString('hex'),
    AUTH_OTP_BYPASS_ENABLED: 'false',
    AUTH_OTP_LOGIN_ENABLED: 'false',
    TELEGRAM_ENABLED: 'false',
    BALE_ENABLED: 'false',
    BALE_SAFIR_ENABLED: 'false',
    SMS_ENABLED: 'false',
  })
  const { app } = await import('../../apps/api/src/app.ts')
  for (const path of [
    '/api/v1/clients',
    '/api/v1/appointments',
    '/api/v1/settings/business',
  ]) {
    const response = await app.request(`http://localhost:3302${path}`, {
      headers: { Authorization: `Bearer ${credentials.access_token}` },
    })
    assert.equal(
      response.status,
      401,
      `CMS bearer must not authenticate product ${path}`,
    )
  }
  console.log(
    'PASS real Salon auth rejects CMS OAuth Bearer before operational reads',
  )
} catch (error) {
  if (error.code === 'MODULE_NOT_FOUND')
    console.error(error.message.split('\n')[0])
  if (error.code === 'ERR_ASSERTION')
    console.error(error.message.split('\n')[0], 'HTTP', error.actual)
  throw new Error(
    `Operational denial proof failed: ${error.code ?? error.name}`,
  )
} finally {
  await globalThis.__salon_postgres?.end({ timeout: 5 })
  await sql.end({ timeout: 5 })
  if (created) await admin`drop database ${admin(name)} with (force)`
  await admin.end({ timeout: 5 })
}
