#!/usr/bin/env node
/**
 * Check whether packages from pnpm-lock.yaml resolve on repo.hmirror.ir/npm.
 *
 * Usage:
 *   node scripts/check-hmirror-packages.mjs
 *   node scripts/check-hmirror-packages.mjs --registry https://repo.hmirror.ir/npm
 *   node scripts/check-hmirror-packages.mjs --concurrency 30 --json-out /tmp/report.json
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const registry = process.argv.includes('--registry')
  ? process.argv[process.argv.indexOf('--registry') + 1]
  : 'https://repo.hmirror.ir/npm'

const concurrency = process.argv.includes('--concurrency')
  ? Number(process.argv[process.argv.indexOf('--concurrency') + 1])
  : 25

const jsonOut = process.argv.includes('--json-out')
  ? process.argv[process.argv.indexOf('--json-out') + 1]
  : null

function stripPeerSuffix(key) {
  let cut = key.length
  let depth = 0
  for (let i = key.length - 1; i >= 0; i -= 1) {
    const ch = key[i]
    if (ch === ')') depth += 1
    else if (ch === '(') {
      depth -= 1
      if (depth === 0) cut = i
    }
  }
  return key.slice(0, cut)
}

function parseLockfile(lockText) {
  const packagesSection = lockText.split(/^packages:\s*$/m)[1] ?? lockText
  const pkgs = new Map()
  for (const line of packagesSection.split('\n')) {
    const m = line.match(/^  '?(.+?)'?:$/)
    if (!m) continue
    const key = stripPeerSuffix(m[1])
    const at = key.lastIndexOf('@')
    if (at <= 0) continue
    const name = key.slice(0, at)
    const version = key.slice(at + 1)
    if (!name || !version || version.includes('(')) continue
    pkgs.set(name, version)
  }
  return [...pkgs.entries()]
    .filter(([name]) => !name.startsWith('@repo/'))
    .map(([name, version]) => ({ name, version }))
}

function encodePackage(name) {
  return name.startsWith('@') ? `@${encodeURIComponent(name.slice(1))}` : name
}

async function fetchPackageMeta(name) {
  const url = `${registry.replace(/\/$/, '')}/${encodePackage(name)}`
  const res = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  })
  if (res.status === 404) return { status: 404, versions: null }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status} for ${name}: ${body.slice(0, 120)}`)
  }
  const data = await res.json()
  return { status: 200, versions: data.versions ?? null }
}

async function checkOne(pkg) {
  try {
    const meta = await fetchPackageMeta(pkg.name)
    if (meta.status === 404) {
      return { ...pkg, status: 'missing_package' }
    }
    if (!meta.versions || !meta.versions[pkg.version]) {
      const available = meta.versions ? Object.keys(meta.versions) : []
      const latest = available.at(-1) ?? null
      return {
        ...pkg,
        status: 'missing_version',
        latest,
        versionCount: available.length,
      }
    }
    return { ...pkg, status: 'ok' }
  } catch (err) {
    return {
      ...pkg,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

async function runPool(items, worker, size) {
  const results = new Array(items.length)
  let index = 0

  async function loop() {
    while (true) {
      const i = index++
      if (i >= items.length) return
      results[i] = await worker(items[i], i)
      if ((i + 1) % 200 === 0 || i + 1 === items.length) {
        process.stderr.write(`checked ${i + 1}/${items.length}\n`)
      }
    }
  }

  await Promise.all(Array.from({ length: size }, () => loop()))
  return results
}

const lockText = fs.readFileSync(path.join(root, 'pnpm-lock.yaml'), 'utf8')
const packages = parseLockfile(lockText)

process.stderr.write(
  `Checking ${packages.length} lockfile packages against ${registry}\n`,
)

const results = await runPool(packages, checkOne, concurrency)

const summary = {
  registry,
  total: results.length,
  ok: results.filter((r) => r.status === 'ok').length,
  missing_package: results.filter((r) => r.status === 'missing_package'),
  missing_version: results.filter((r) => r.status === 'missing_version'),
  error: results.filter((r) => r.status === 'error'),
}

const report = {
  summary: {
    registry: summary.registry,
    total: summary.total,
    ok: summary.ok,
    missing_package: summary.missing_package.length,
    missing_version: summary.missing_version.length,
    error: summary.error.length,
  },
  missing_package: summary.missing_package,
  missing_version: summary.missing_version.sort((a, b) =>
    a.name.localeCompare(b.name),
  ),
  error: summary.error,
}

if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(report, null, 2))

console.log(JSON.stringify(report.summary, null, 2))

const notable = new Set([
  'astro',
  '@astrojs/node',
  '@astrojs/react',
  'hono',
  '@hono/node-server',
  'drizzle-orm',
  'drizzle-kit',
  'better-auth',
  'vite',
  '@vitejs/plugin-react',
  '@tanstack/react-router',
  'tailwindcss',
  'sharp',
  'esbuild',
  '@esbuild/linux-x64',
  'lightningcss',
  'typescript',
  'turbo',
  'pnpm',
  'zod',
  'postgres',
  'grammy',
  'react',
  'react-dom',
  '@playwright/test',
  'vitest',
  'nginx',
])

console.log('\nNotable packages:')
for (const r of results
  .filter((x) => notable.has(x.name))
  .sort((a, b) => a.name.localeCompare(b.name))) {
  console.log(
    `  ${r.name}@${r.version}: ${r.status}${r.latest ? ` (mirror latest: ${r.latest})` : ''}${r.error ? ` — ${r.error}` : ''}`,
  )
}

if (summary.missing_version.length) {
  console.log('\nFirst 40 missing versions:')
  for (const r of summary.missing_version.slice(0, 40)) {
    console.log(
      `  ${r.name}@${r.version}${r.latest ? ` (mirror latest: ${r.latest})` : ''}`,
    )
  }
}

if (summary.missing_package.length) {
  console.log('\nMissing packages:')
  for (const r of summary.missing_package.slice(0, 40)) {
    console.log(`  ${r.name}@${r.version}`)
  }
}

if (summary.error.length) {
  console.log('\nErrors:')
  for (const r of summary.error.slice(0, 20)) {
    console.log(`  ${r.name}@${r.version}: ${r.error}`)
  }
}

process.exit(
  summary.missing_package.length ||
    summary.missing_version.length ||
    summary.error.length
    ? 1
    : 0,
)
