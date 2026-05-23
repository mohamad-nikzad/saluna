# Baseline — `nextjs-api-routes-local` on local

_Auto-generated. Re-run: `STACK=nextjs-api-routes-local BASE_URL=http://localhost:3000 ./benchmarks/run.sh`_

- Date: 2026-05-23
- Commit: `e2bbf8d` on branch `perf/next-vs-hono-loadtest`
- Target: http://localhost:3000
- Stack tag: `nextjs-api-routes-local`

## Results

| Scenario | p50 (ms) | p95 (ms) | p99 (ms) | avg (ms) | RPS | Errors |
|---|---:|---:|---:|---:|---:|---:|
| GET /api/services (cheap read) | 6.76 | 9.68 | — | 7.02 | 1411 | 0.00% |
| GET /api/appointments (heavy read) | 8.06 | 11.1 | — | 8.40 | 1181 | 0.00% |
| GET /api/dashboard | 13.7 | 18.1 | — | 14.2 | 699 | 0.00% |
| GET /api/today | 24.7 | 30.6 | — | 25.2 | 396 | 0.00% |
| GET /api/auth/me | 5.91 | 8.75 | — | 6.33 | 3134 | 0.00% |
| 7 endpoints, ramped 0→20 VUs | 51.2 | 146 | — | 57.1 | 870 | 0.00% |

## Source files

- 01-cheap-read: `results/local/nextjs-api-routes-local/01-cheap-read-2026-05-23T10-20-01-875Z.json`
- 02-heavy-read: `results/local/nextjs-api-routes-local/02-heavy-read-2026-05-23T10-20-33-898Z.json`
- 03-dashboard: `results/local/nextjs-api-routes-local/03-dashboard-2026-05-23T10-21-05-497Z.json`
- 04-today: `results/local/nextjs-api-routes-local/04-today-2026-05-23T10-21-38-226Z.json`
- 05-auth-me: `results/local/nextjs-api-routes-local/05-auth-me-2026-05-23T10-22-09-921Z.json`
- 06-mixed-load: `results/local/nextjs-api-routes-local/06-mixed-load-2026-05-23T10-23-41-963Z.json`

## Compare with another stack

```bash
node benchmarks/compare.mjs local nextjs-api-routes-local <other-stack>
```
