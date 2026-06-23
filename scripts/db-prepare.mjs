#!/usr/bin/env node
/**
 * Start local Postgres (docker-compose) and apply checked-in Drizzle migrations.
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function ensureDocker() {
  const check = spawnSync('docker', ['info'], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 8_000,
  })
  if (check.status === 0) return
  console.error('Docker is not available (is Docker Desktop running?).')
  console.error('If Postgres is already up on :5432, run:')
  console.error('  pnpm db:reconcile && pnpm db:migrate')
  process.exit(1)
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    ...options,
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function dockerCompose(args) {
  run('docker', ['compose', '-f', 'docker-compose.yml', ...args])
}

function waitForPostgres(maxAttempts = 30) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const probe = spawnSync(
      'docker',
      [
        'compose',
        '-f',
        'docker-compose.yml',
        'exec',
        '-T',
        'postgres',
        'pg_isready',
        '-U',
        'postgres',
        '-d',
        'salon',
      ],
      { cwd: repoRoot, encoding: 'utf8' }
    )
    if (probe.status === 0) return
    spawnSync('sleep', ['1'], { cwd: repoRoot })
  }
  console.error('Postgres did not become ready in time.')
  process.exit(1)
}

ensureDocker()

console.log('Starting local Postgres…')
dockerCompose(['up', '-d', 'postgres'])
waitForPostgres()

console.log('Reconciling schema drift from db:push / manual patches…')
run('node', ['scripts/reconcile-migrations.mjs'])

console.log('Applying migrations…')
run('pnpm', ['db:migrate'])

console.log('Local migrations applied.')
