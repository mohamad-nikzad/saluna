# Baseline — `nextjs-api-routes` on prod

_Auto-generated. Re-run: `STACK=nextjs-api-routes BASE_URL=https://aravira-saloon.vercel.app ./benchmarks/run.sh`_

- Date: 2026-05-18
- Commit: `2210097` on branch `main`
- Target: https://aravira-saloon.vercel.app
- Stack tag: `nextjs-api-routes`

## Results

| Scenario                           | p50 (ms) | p95 (ms) | p99 (ms) | avg (ms) |  RPS | Errors |
| ---------------------------------- | -------: | -------: | -------: | -------: | ---: | -----: |
| GET /api/services (cheap read)     |     1060 |     2129 |        — |     1229 | 7.19 |  0.00% |
| GET /api/appointments (heavy read) |      562 |     1124 |        — |      611 | 15.5 |  99.8% |
| GET /api/dashboard                 |     1527 |     2027 |        — |     1453 | 6.41 |  0.00% |
| GET /api/today                     |     1754 |     2747 |        — |     1798 | 5.19 |  0.00% |
| GET /api/auth/me                   |      512 |     1125 |        — |      588 | 30.6 |  0.00% |
| 7 endpoints, ramped 0→20 VUs       |     1219 |     5452 |        — |     1921 | 26.9 |  14.3% |

## Source files

- 01-cheap-read: `results/prod/nextjs-api-routes/01-cheap-read-2026-05-18T09-07-42-724Z.json`
- 02-heavy-read: `results/prod/nextjs-api-routes/02-heavy-read-2026-05-18T09-08-15-981Z.json`
- 03-dashboard: `results/prod/nextjs-api-routes/03-dashboard-2026-05-18T09-08-50-617Z.json`
- 04-today: `results/prod/nextjs-api-routes/04-today-2026-05-18T09-09-28-807Z.json`
- 05-auth-me: `results/prod/nextjs-api-routes/05-auth-me-2026-05-18T09-10-05-049Z.json`
- 06-mixed-load: `results/prod/nextjs-api-routes/06-mixed-load-2026-05-18T09-11-41-614Z.json`

## Compare with another stack

```bash
node benchmarks/compare.mjs prod nextjs-api-routes <other-stack>
```
