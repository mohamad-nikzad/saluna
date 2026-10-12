/** Isolated, seeded PWA + API development for an already provisioned cloud worker. */
import { spawn, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'dotenv'
import postgres from 'postgres'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const stateDir = path.join(root, '.codex/cloud-dev')
const envFile = path.join(stateDir, 'test.env.local')
const databaseName = process.env.SALUNA_CLOUD_DEV_DB || 'saluna_cloud_dev'
const [action, ...args] = process.argv.slice(2)
const supported = ['prepare', 'seed', 'start', 'test', 'exec']
if (!supported.includes(action) || (action === 'exec' && !args.length)) {
  console.error(
    'Usage: node scripts/cloud-dev.mjs prepare|seed|start|test|exec <command> [args]',
  )
  process.exit(1)
}
if (!/^[a-z][a-z0-9_]{0,62}$/.test(databaseName))
  throw new Error('Invalid test database name')

const base = parse(readFileSync(path.join(root, '.env.local')))
const localUrl = new URL(base.DATABASE_URL_DIRECT || base.DATABASE_URL)
if (!['localhost', '127.0.0.1', '::1'].includes(localUrl.hostname)) {
  throw new Error(
    'Cloud development requires a local PostgreSQL connection in .env.local',
  )
}
localUrl.pathname = `/${databaseName}`

const pnpm =
  process.env.SALUNA_CLOUD_PNPM_BIN ||
  (existsSync('/workspace/.saluna-tools/node_modules/.bin/pnpm')
    ? '/workspace/.saluna-tools/node_modules/.bin/pnpm'
    : 'pnpm')
const version = spawnSync(pnpm, ['--version'], { encoding: 'utf8' })
if (version.status !== 0 || version.stdout.trim() !== '9.15.9') {
  throw new Error(
    'pnpm 9.15.9 is required; set SALUNA_CLOUD_PNPM_BIN to its installed binary',
  )
}

let freshDatabase = false
if (action === 'prepare') {
  const admin = postgres(base.DATABASE_URL_DIRECT || base.DATABASE_URL, {
    max: 1,
    connect_timeout: 5,
  })
  try {
    const existing =
      await admin`select datname from pg_database where datname = ${databaseName}`
    if (!existing.length) {
      await admin.unsafe(`CREATE DATABASE "${databaseName}"`)
      freshDatabase = true
    }
  } finally {
    await admin.end()
  }
  mkdirSync(stateDir, { recursive: true, mode: 0o700 })
  if (!existsSync(envFile)) {
    const values = {
      DATABASE_URL: localUrl.toString(),
      DATABASE_URL_DIRECT: localUrl.toString(),
      DATABASE_ENV_FILE: '',
      ROOT_ENV_FILES: '',
      NODE_ENV: 'development',
      BETTER_AUTH_SECRET: randomBytes(32).toString('hex'),
      JWT_SECRET: randomBytes(32).toString('hex'),
      BETTER_AUTH_URL: 'http://localhost:3002',
      PWA_ORIGIN: 'http://localhost:3000',
      ADMIN_ORIGIN: 'http://localhost:3003',
      PUBLIC_APP_URL: 'http://localhost:3001',
      PUBLIC_API_URL: 'http://localhost:3002',
      PUBLIC_MANAGER_APP_URL: 'http://localhost:3000',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3001',
      NEXT_PUBLIC_API_URL: 'http://localhost:3002',
      PUBLIC_APP_BASE_URL: 'http://localhost:3000',
      CORS_ORIGINS:
        'http://localhost:3000,http://localhost:3001,http://localhost:3003',
      VITE_API_BASE_URL: '/',
      VITE_APP_URL: 'http://localhost:3000',
      VITE_WEB_URL: 'http://localhost:3001',
      SMS_ENABLED: 'false',
      TELEGRAM_ENABLED: 'false',
      BALE_ENABLED: 'false',
      BALE_SAFIR_ENABLED: 'false',
      AUTH_OTP_BYPASS_ENABLED: 'false',
      AUTH_OTP_LOGIN_ENABLED: 'false',
      SEED_PASSWORD: 'admin123',
    }
    writeFileSync(
      envFile,
      Object.entries(values)
        .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
        .join('\n') + '\n',
      { mode: 0o600 },
    )
  }
}
if (!existsSync(envFile)) throw new Error('Run cloud-dev.mjs prepare first')
const testEnv = parse(readFileSync(envFile))
if (
  testEnv.DATABASE_URL !== localUrl.toString() ||
  testEnv.DATABASE_URL_DIRECT !== localUrl.toString()
) {
  throw new Error(
    'Saved test configuration differs from the selected local database; choose a separate checkout or update the ignored configuration',
  )
}
const env = {
  ...process.env,
  ...base,
  ...testEnv,
  SALUNA_MIGRATIONS_DIR: path.join(root, 'packages/database/src/migrations'),
  PATH: [
    path.dirname(pnpm),
    path.join(root, 'node_modules/.bin'),
    process.env.PATH,
  ].join(path.delimiter),
}

function run(command, commandArgs, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: root,
      env: { ...env, ...extraEnv },
      stdio: 'inherit',
    })
    let interruptCode
    const interrupt = () => {
      interruptCode = 130
      child.kill('SIGINT')
    }
    const terminate = () => {
      interruptCode = 143
      child.kill('SIGTERM')
    }
    process.on('SIGINT', interrupt)
    process.on('SIGTERM', terminate)
    child.on('error', reject)
    child.on('exit', (code, signal) => {
      process.off('SIGINT', interrupt)
      process.off('SIGTERM', terminate)
      if (interruptCode) process.exit(interruptCode)
      if (signal === 'SIGINT') process.exit(130)
      if (signal === 'SIGTERM') process.exit(143)
      if (code === 0) resolve()
      else reject(new Error(`${command} exited with ${signal || code}`))
    })
  })
}

if (action === 'prepare') {
  await run(pnpm, ['exec', 'tsx', 'apps/api/src/cli/migrate.ts'])
  if (freshDatabase || !existsSync(path.join(stateDir, 'seeded'))) {
    await run(pnpm, ['exec', 'tsx', 'scripts/db-seed.ts'])
    writeFileSync(path.join(stateDir, 'seeded'), `${databaseName}\n`)
  }
  console.log(
    `Cloud development prepared: isolated database ${databaseName}; provider delivery disabled.`,
  )
} else if (action === 'seed') {
  await run(pnpm, ['exec', 'tsx', 'scripts/db-seed.ts'])
} else if (action === 'start') {
  await run(pnpm, [
    'exec',
    'turbo',
    'run',
    'dev',
    '--filter=@repo/pwa',
    '--filter=@repo/api',
    '--env-mode=loose',
  ])
} else if (action === 'test') {
  await run(
    pnpm,
    [
      'exec',
      'playwright',
      'test',
      ...(args.length ? args : ['e2e/staff-services.spec.ts']),
    ],
    {
      E2E_SKIP_SERVER: '1',
      PLAYWRIGHT_BASE_URL: 'http://localhost:3000',
      PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium',
    },
  )
} else {
  await run(args[0], args.slice(1))
}
