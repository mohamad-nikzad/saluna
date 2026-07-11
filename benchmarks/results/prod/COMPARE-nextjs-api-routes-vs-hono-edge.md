# Compare — `nextjs-api-routes` → `hono-edge` on prod

_Lower is better. Delta = hono-edge − nextjs-api-routes._

| Scenario              | nextjs-api-routes p50 | hono-edge p50 | Δ p50               | nextjs-api-routes p95 | hono-edge p95 | Δ p95               | nextjs-api-routes RPS | hono-edge RPS |
| --------------------- | --------------------: | ------------: | ------------------- | --------------------: | ------------: | ------------------- | --------------------: | ------------: |
| GET /api/services     |                  1060 |           695 | 🔻 -365ms (-34.4%)  |                  2129 |          1097 | 🔻 -1032ms (-48.5%) |                  7.19 |          17.3 |
| GET /api/appointments |                   562 |           234 | 🔻 -328ms (-58.3%)  |                  1124 |           234 | 🔻 -890ms (-79.1%)  |                  15.5 |          2.34 |
| GET /api/dashboard    |                  1527 |           110 | 🔻 -1418ms (-92.8%) |                  2027 |          1139 | 🔻 -889ms (-43.8%)  |                  6.41 |          15.3 |
| GET /api/today        |                  1754 |           111 | 🔻 -1643ms (-93.7%) |                  2747 |           111 | 🔻 -2636ms (-96.0%) |                  5.19 |          3.34 |
| GET /api/auth/me      |                   512 |           180 | 🔻 -332ms (-64.8%)  |                  1125 |           180 | 🔻 -944ms (-84.0%)  |                  30.6 |          2.75 |
| Mixed (7 endpoints)   |                  1219 |           136 | 🔻 -1084ms (-88.9%) |                  5452 |           665 | 🔻 -4787ms (-87.8%) |                  26.9 |          43.6 |
