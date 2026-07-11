#!/usr/bin/env node
// Reads the latest JSON per scenario in benchmarks/results/<env>/<stack>/
// and writes benchmarks/results/<env>/<stack>/BASELINE.md
//
// Usage:
//   node benchmarks/summarize.mjs                       # every env × stack found
//   node benchmarks/summarize.mjs prod                  # all stacks under prod
//   node benchmarks/summarize.mjs prod hono-node        # one env × stack
import {
  readdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  statSync,
} from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const ROOT = dirname(fileURLToPath(import.meta.url))
const RESULTS = join(ROOT, 'results')

const SCENARIO_LABELS = {
  '01-cheap-read': 'GET /api/services (cheap read)',
  '02-heavy-read': 'GET /api/appointments (heavy read)',
  '03-dashboard': 'GET /api/dashboard',
  '04-today': 'GET /api/today',
  '05-auth-me': 'GET /api/auth/me',
  '06-mixed-load': '7 endpoints, ramped 0→20 VUs',
}

function fmt(n, suffix = '') {
  if (n == null || Number.isNaN(n)) return '—'
  return `${n.toFixed(n < 10 ? 2 : n < 100 ? 1 : 0)}${suffix}`
}

function pickLatest(dir) {
  if (!existsSync(dir)) return {}
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'))
  const byScenario = {}
  for (const f of files) {
    const m = f.match(/^(\d{2}-[a-z-]+)-(.+)\.json$/)
    if (!m) continue
    const [, scenario, ts] = m
    const prev = byScenario[scenario]
    if (!prev || ts > prev.ts) {
      byScenario[scenario] = { ts, path: join(dir, f) }
    }
  }
  return byScenario
}

export function extract(jsonPath) {
  const data = JSON.parse(readFileSync(jsonPath, 'utf8'))
  const m = data.metrics || {}
  const dur = m.http_req_duration?.values || {}
  const reqs = m.http_reqs?.values || {}
  const failed = m.http_req_failed?.values || {}
  return {
    p50: dur.med,
    p95: dur['p(95)'],
    p99: dur['p(99)'],
    avg: dur.avg,
    max: dur.max,
    rps: reqs.rate,
    errorRate: (failed.rate ?? 0) * 100,
    count: reqs.count,
  }
}

function gitInfo() {
  const safe = (cmd) => {
    try {
      return execSync(cmd, { cwd: ROOT }).toString().trim()
    } catch {
      return 'unknown'
    }
  }
  return {
    commit: safe('git rev-parse --short HEAD'),
    branch: safe('git rev-parse --abbrev-ref HEAD'),
  }
}

function render(env, stack, byScenario) {
  const baseUrl =
    env === 'prod' ? 'https://saluna.vercel.app' : 'http://localhost:3000'
  const { commit, branch } = gitInfo()
  const date = new Date().toISOString().split('T')[0]
  const rows = Object.keys(SCENARIO_LABELS).map((key) => {
    const entry = byScenario[key]
    if (!entry) return `| ${SCENARIO_LABELS[key]} | — | — | — | — | — | — |`
    const r = extract(entry.path)
    return `| ${SCENARIO_LABELS[key]} | ${fmt(r.p50)} | ${fmt(r.p95)} | ${fmt(r.p99)} | ${fmt(r.avg)} | ${fmt(r.rps)} | ${fmt(r.errorRate, '%')} |`
  })

  const sourceList =
    Object.entries(byScenario)
      .map(([k, v]) => `- ${k}: \`${v.path.replace(ROOT + '/', '')}\``)
      .join('\n') || '_no results yet_'

  return `# Baseline — \`${stack}\` on ${env}

_Auto-generated. Re-run: \`STACK=${stack} BASE_URL=${baseUrl} ./benchmarks/run.sh\`_

- Date: ${date}
- Commit: \`${commit}\` on branch \`${branch}\`
- Target: ${baseUrl}
- Stack tag: \`${stack}\`

## Results

| Scenario | p50 (ms) | p95 (ms) | p99 (ms) | avg (ms) | RPS | Errors |
|---|---:|---:|---:|---:|---:|---:|
${rows.join('\n')}

## Source files

${sourceList}

## Compare with another stack

\`\`\`bash
node benchmarks/compare.mjs ${env} ${stack} <other-stack>
\`\`\`
`
}

function listStacks(envDir) {
  if (!existsSync(envDir)) return []
  return readdirSync(envDir).filter((f) =>
    statSync(join(envDir, f)).isDirectory(),
  )
}

function summarize(env, stack) {
  const dir = join(RESULTS, env, stack)
  const byScenario = pickLatest(dir)
  if (Object.keys(byScenario).length === 0) {
    console.warn(`No result JSONs in results/${env}/${stack}/ — skipping`)
    return
  }
  const out = join(dir, 'BASELINE.md')
  writeFileSync(out, render(env, stack, byScenario))
  console.log(
    `Wrote ${out.replace(ROOT + '/', '')} (${Object.keys(byScenario).length} scenarios)`,
  )
}

const [envArg, stackArg] = process.argv.slice(2)

if (envArg && stackArg) {
  summarize(envArg, stackArg)
} else if (envArg) {
  for (const stack of listStacks(join(RESULTS, envArg)))
    summarize(envArg, stack)
} else {
  for (const env of ['local', 'prod']) {
    for (const stack of listStacks(join(RESULTS, env))) summarize(env, stack)
  }
}
