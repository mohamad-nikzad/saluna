import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

type DatabaseUrlOptions = {
  preferDirect?: boolean
}

let envLoaded = false

function getWorkspaceRoot(): string | null {
  try {
    if (!import.meta.url) return null
    const packageDir = path.dirname(fileURLToPath(import.meta.url))
    return path.resolve(packageDir, '../../..')
  } catch {
    return null
  }
}

function loadLocalEnvFile(fileName: string) {
  const workspaceRoot = getWorkspaceRoot()
  if (!workspaceRoot) return
  const filePath = path.join(
    /* turbopackIgnore: true */ workspaceRoot,
    fileName,
  )
  if (!existsSync(filePath)) return

  const contents = readFileSync(filePath, 'utf8')
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

export function loadDatabaseEnvFiles() {
  if (envLoaded) return
  envLoaded = true

  // Skip filesystem env-file loading when no workspace root is resolvable.
  if (!getWorkspaceRoot()) return

  loadLocalEnvFile('.env')
  loadLocalEnvFile('.env.local')

  const extraFiles = process.env.DATABASE_ENV_FILE?.split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  for (const fileName of extraFiles ?? []) {
    loadLocalEnvFile(fileName)
  }
}

function readEnv(name: 'DATABASE_URL' | 'DATABASE_URL_DIRECT') {
  loadDatabaseEnvFiles()
  const value = process.env[name]?.trim()
  return value ? value : undefined
}

/**
 * Keep the app portable by depending on standard Postgres URLs only.
 * `DATABASE_URL` is the default runtime connection.
 * `DATABASE_URL_DIRECT` is optional and useful for migrations/seeds.
 */
export function getDatabaseUrl(options: DatabaseUrlOptions = {}): string {
  const runtimeUrl = readEnv('DATABASE_URL')
  const directUrl = readEnv('DATABASE_URL_DIRECT')

  const url = options.preferDirect
    ? (directUrl ?? runtimeUrl)
    : (runtimeUrl ?? directUrl)

  if (!url) {
    throw new Error(
      'Set DATABASE_URL (and optionally DATABASE_URL_DIRECT for migrations/seeds).',
    )
  }

  return url
}
