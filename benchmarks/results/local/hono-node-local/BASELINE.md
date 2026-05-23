# Baseline — `hono-node-local` on local

_Auto-generated. Re-run: `STACK=hono-node-local BASE_URL=http://localhost:3000 ./benchmarks/run.sh`_

- Date: 2026-05-23
- Commit: `e2bbf8d` on branch `perf/next-vs-hono-loadtest`
- Target: http://localhost:3000
- Stack tag: `hono-node-local`

## Results

| Scenario | p50 (ms) | p95 (ms) | p99 (ms) | avg (ms) | RPS | Errors |
|---|---:|---:|---:|---:|---:|---:|
| GET /api/services (cheap read) | 4.91 | 7.10 | — | 5.10 | 1937 | 0.00% |
| GET /api/appointments (heavy read) | 7.31 | 9.90 | — | 7.47 | 1325 | 0.00% |
| GET /api/dashboard | 14.2 | 18.0 | — | 14.5 | 685 | 0.00% |
| GET /api/today | 25.7 | 38.3 | — | 28.1 | 354 | 0.00% |
| GET /api/auth/me | 3.70 | 7.16 | — | 4.24 | 4643 | 0.00% |
| 7 endpoints, ramped 0→20 VUs | 41.9 | 115 | — | 45.4 | 1096 | 0.00% |

## Source files

- 01-cheap-read: `results/local/hono-node-local/01-cheap-read-2026-05-23T10-24-14-409Z.json`
- 02-heavy-read: `results/local/hono-node-local/02-heavy-read-2026-05-23T10-24-46-059Z.json`
- 03-dashboard: `results/local/hono-node-local/03-dashboard-2026-05-23T10-25-17-691Z.json`
- 04-today: `results/local/hono-node-local/04-today-2026-05-23T10-25-49-473Z.json`
- 05-auth-me: `results/local/hono-node-local/05-auth-me-2026-05-23T10-26-21-150Z.json`
- 06-mixed-load: `results/local/hono-node-local/06-mixed-load-2026-05-23T10-27-52-522Z.json`

## Compare with another stack

```bash
node benchmarks/compare.mjs local hono-node-local <other-stack>
```
