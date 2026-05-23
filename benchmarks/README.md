# API Benchmarks

Tagged baselines of the API so we can compare stacks before/after migration:
`nextjs-api-routes` (current) → `hono-node` → `hono-bun` → `hono-edge` …

## Scenarios

| File | Endpoint | Purpose |
|---|---|---|
| `01-cheap-read.js` | `GET /api/services` | Simple list read |
| `02-heavy-read.js` | `GET /api/appointments` | Joined query, hot path |
| `03-dashboard.js` | `GET /api/dashboard` | Aggregated dashboard data |
| `04-today.js` | `GET /api/today` | Today view, common entry point |
| `05-auth-me.js` | `GET /api/auth/me` | Auth middleware + JWT verify cost |
| `06-mixed-load.js` | 7 endpoints in parallel | Realistic ramped load (0→20 VUs) |

Reads only. Safe to run against production.

## Setup

```bash
brew install k6
```

Seeded credentials (`packages/database/src/seed.ts`) are the defaults:
- phone `09120000000`, password `admin123`. Override via `BENCH_PHONE` / `BENCH_PASSWORD`.

## How tagging works

Every run takes a `STACK` env var (default: `nextjs-api-routes`). Reports land under:
```
benchmarks/results/<env>/<stack>/<scenario>-<timestamp>.{html,json}
benchmarks/results/<env>/<stack>/BASELINE.md   # auto-generated summary
```

You keep one tagged baseline per stack per env, forever.

## Running

```bash
# Current stack (default tag): localhost
pnpm bench:local

# Current stack: production
pnpm bench:prod

# After Hono migration on Node — tag it
STACK=hono-node BASE_URL=https://aravira-saloon.vercel.app ./benchmarks/run.sh

# After moving Hono to Bun
STACK=hono-bun BASE_URL=https://your-bun-host ./benchmarks/run.sh

# Single scenario
STACK=hono-node BASE_URL=... ./benchmarks/run.sh 03-dashboard
```

## Local Next vs Hono comparison (one command)

Boots both stacks in **production mode** against the local Postgres, runs all
scenarios against each, and writes a side-by-side compare.

```bash
# 1. Local DB up, schema pushed, seeded
docker compose up -d postgres
pnpm db:push:local && pnpm db:seed:local

# 2. Build the Next app for prod
pnpm --filter @repo/app build:local

# 3. Run the compare (boots both servers, runs k6, tears down)
pnpm bench:local:compare
# → results/local/nextjs-api-routes-local/
# → results/local/hono-node-local/
# → results/local/COMPARE-nextjs-api-routes-local-vs-hono-node-local.md
```

Notes:
- Next runs on `:3000` with prefix `/api`; Hono on `:3002` with prefix `/api/v1`.
- Both run with `NODE_ENV=production`. `next start` uses the prod bundle;
  Hono uses `tsx` (interpreted but no dev-only middleware). For an
  apples-to-apples runtime, this is fine since framework overhead dominates.
- Comparison is meaningful *relatively*. Absolute numbers don't reflect VPS prod.
- To run a single scenario both ways: `./benchmarks/run-compare.sh 01-cheap-read`.

## Comparing two stacks

```bash
# After both runs exist:
node benchmarks/compare.mjs prod nextjs-api-routes hono-node
# → prints a delta table and writes benchmarks/results/prod/COMPARE-nextjs-api-routes-vs-hono-node.md
```

The comparison shows `stackB − stackA` (negative = improvement) with both absolute ms and %.

## GitHub Actions (recommended for prod)

Trigger manually: `Actions → API Benchmark → Run workflow`. Inputs:
- **stack** — `nextjs-api-routes`, `hono-node`, etc.
- **scenario** — `all` or a single scenario name

The job runs from GitHub's datacenter (stable network), uploads `benchmarks/results/`
as an artifact (named with the stack tag), and prints the BASELINE table in the
workflow summary view.

## ⚠️ Network latency

Running from a weak/variable wifi adds 50–500ms jitter that hides server-side
deltas. Three ways around it:

1. **GitHub Actions** — same as above, stable network. Use this for the canonical
   numbers you'll commit / compare.
2. **Local mode** — `pnpm bench:local` has zero network. Reliable on any wifi.
3. **Same network, same hour** — if running both baselines from your laptop,
   do them back-to-back so jitter affects both equally.

## Commands

| Command | What it does |
|---|---|
| `pnpm bench:local` | Run all scenarios against `localhost:3000`, default tag |
| `pnpm bench:prod` | Run all scenarios against prod, default tag |
| `pnpm bench:summary` | Re-build all `BASELINE.md` files from existing JSON |
| `pnpm bench:compare <env> <stackA> <stackB>` | Diff two stacks |
| `STACK=<tag> ./benchmarks/run.sh [scenario]` | Custom tag, one or all scenarios |
