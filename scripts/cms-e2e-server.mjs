import { spawn, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

// A fresh database and upload directory for every browser run. Never loads the
// root .env files or connects to the Salon database.
const name = `saluna-cms-e2e-${process.pid}`
const password = randomBytes(24).toString('hex')
const uploads = await mkdtemp(resolve(tmpdir(), 'saluna-cms-e2e-'))
let web
let build
let cleanupPromise
function cleanup() {
  cleanupPromise ??= (async () => {
    build?.kill('SIGTERM')
    web?.kill('SIGTERM')
    spawnSync('docker', ['rm', '-f', name], { stdio: 'ignore' })
    await rm(uploads, { recursive: true, force: true })
  })()
  return cleanupPromise
}
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await cleanup()
    process.exit(0)
  })
}
try {
  const database = spawnSync(
    'docker',
    [
      'run',
      '--rm',
      '-d',
      '--name',
      name,
      '--label',
      'saluna.cms-e2e-port=3303',
      '-p',
      '127.0.0.1::5432',
      '-e',
      'POSTGRES_DB=saluna_cms',
      '-e',
      'POSTGRES_USER=saluna_cms',
      '-e',
      `POSTGRES_PASSWORD=${password}`,
      'postgres:16-alpine',
    ],
    { encoding: 'utf8' },
  )
  if (database.status !== 0)
    throw new Error('CMS browser tests require Docker and postgres:16-alpine')
  const port = spawnSync('docker', ['port', name, '5432'], { encoding: 'utf8' })
    .stdout.trim()
    .split(':')
    .at(-1)
  for (let attempt = 0; attempt < 60; attempt++) {
    const ready = spawnSync(
      'docker',
      ['exec', name, 'pg_isready', '-U', 'saluna_cms', '-d', 'saluna_cms'],
      { stdio: 'ignore' },
    )
    if (ready.status === 0) break
    if (attempt === 59)
      throw new Error('Disposable CMS Postgres did not become ready')
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  const environment = {
    ...process.env,
    CMS_DATABASE_URL: `postgres://saluna_cms:${password}@127.0.0.1:${port}/saluna_cms`,
    CMS_MEDIA_DIRECTORY: uploads,
    EMDASH_ENCRYPTION_KEY: `emdash_enc_v1_${randomBytes(32).toString('base64url')}`,
    EMDASH_SITE_URL: 'http://localhost:3303',
    PUBLIC_APP_URL: 'http://localhost:3303',
  }
  const production = process.env.CMS_E2E_PRODUCTION === '1'
  if (production) {
    // Static Node redirects differ from dev's dynamic prerendering. Build
    // without CMS credentials, then exercise the resulting server against
    // the same isolated Postgres and media fixture as the default target.
    build = spawn(
      process.execPath,
      ['../../node_modules/astro/bin/astro.mjs', 'build'],
      {
        cwd: resolve('apps/web'),
        stdio: 'inherit',
        env: {
          ...environment,
          CMS_DATABASE_URL: undefined,
          EMDASH_ENCRYPTION_KEY: undefined,
        },
      },
    )
    const deadline = setTimeout(() => build?.kill('SIGTERM'), 60_000)
    try {
      const code = await new Promise((resolve, reject) => {
        build.once('exit', resolve)
        build.once('error', reject)
      })
      if (code !== 0) throw new Error('CMS browser production build failed')
    } finally {
      clearTimeout(deadline)
      build = undefined
    }
  }
  web = spawn(
    process.execPath,
    production
      ? ['./server.mjs']
      : [
          '../../node_modules/astro/bin/astro.mjs',
          'dev',
          '--host',
          '127.0.0.1',
          '--port',
          '3303',
        ],
    {
      cwd: resolve('apps/web'),
      stdio: 'inherit',
      env: { ...environment, HOST: '127.0.0.1', PORT: '3303' },
    },
  )
  const code = await new Promise((resolve) => web.on('exit', resolve))
  await cleanup()
  process.exit(code ?? 1)
} catch (error) {
  await cleanup()
  console.error(error.message)
  process.exit(1)
}
