# Baseline — `hono-edge` on prod

_Auto-generated. Re-run: `STACK=hono-edge BASE_URL=https://aravira-saloon.vercel.app ./benchmarks/run.sh`_

- Date: 2026-05-18
- Commit: `2210097` on branch `main`
- Target: https://aravira-saloon.vercel.app
- Stack tag: `hono-edge`

## Results

| Scenario                           | p50 (ms) | p95 (ms) | p99 (ms) | avg (ms) |  RPS | Errors |
| ---------------------------------- | -------: | -------: | -------: | -------: | ---: | -----: |
| GET /api/services (cheap read)     |      695 |     1097 |        — |      548 | 17.3 |  50.2% |
| GET /api/appointments (heavy read) |      234 |      234 |        — |      234 | 2.34 |   100% |
| GET /api/dashboard                 |      110 |     1139 |        — |      257 | 15.3 |  89.3% |
| GET /api/today                     |      111 |      111 |        — |      111 | 3.34 |   100% |
| GET /api/auth/me                   |      180 |      180 |        — |      180 | 2.75 |   100% |
| 7 endpoints, ramped 0→20 VUs       |      136 |      665 |        — |      412 | 43.6 |  98.2% |

## Source files

- 01-cheap-read: `results/prod/hono-edge/01-cheap-read-2026-05-18T19-30-42-411Z.json`
- 02-heavy-read: `results/prod/hono-edge/02-heavy-read-2026-05-18T19-30-44-555Z.json`
- 03-dashboard: `results/prod/hono-edge/03-dashboard-2026-05-18T19-31-46-678Z.json`
- 04-today: `results/prod/hono-edge/04-today-2026-05-18T19-31-48-983Z.json`
- 05-auth-me: `results/prod/hono-edge/05-auth-me-2026-05-18T19-31-50-474Z.json`
- 06-mixed-load: `results/prod/hono-edge/06-mixed-load-2026-05-18T19-33-51-979Z.json`

## Compare with another stack

```bash
node benchmarks/compare.mjs prod hono-edge <other-stack>
```
