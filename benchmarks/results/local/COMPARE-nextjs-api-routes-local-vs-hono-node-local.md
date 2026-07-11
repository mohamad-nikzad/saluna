# Compare — `nextjs-api-routes-local` → `hono-node-local` on local

_Lower is better. Delta = hono-node-local − nextjs-api-routes-local._

| Scenario              | nextjs-api-routes-local p50 | hono-node-local p50 | Δ p50            | nextjs-api-routes-local p95 | hono-node-local p95 | Δ p95             | nextjs-api-routes-local RPS | hono-node-local RPS |
| --------------------- | --------------------------: | ------------------: | ---------------- | --------------------------: | ------------------: | ----------------- | --------------------------: | ------------------: |
| GET /api/services     |                        6.76 |                4.91 | 🔻 -2ms (-27.4%) |                        9.68 |                7.10 | 🔻 -3ms (-26.6%)  |                        1411 |                1937 |
| GET /api/appointments |                        8.06 |                7.31 | 🔻 -1ms (-9.3%)  |                        11.1 |                9.90 | 🔻 -1ms (-10.9%)  |                        1181 |                1325 |
| GET /api/dashboard    |                        13.7 |                14.2 | 🔺 +1ms (+3.9%)  |                        18.1 |                18.0 | 🔻 -0ms (-1.0%)   |                         699 |                 685 |
| GET /api/today        |                        24.7 |                25.7 | 🔺 +1ms (+4.2%)  |                        30.6 |                38.3 | 🔺 +8ms (+25.1%)  |                         396 |                 354 |
| GET /api/auth/me      |                        5.91 |                3.70 | 🔻 -2ms (-37.5%) |                        8.75 |                7.16 | 🔻 -2ms (-18.2%)  |                        3134 |                4643 |
| Mixed (7 endpoints)   |                        51.2 |                41.9 | 🔻 -9ms (-18.1%) |                         146 |                 115 | 🔻 -32ms (-21.6%) |                         870 |                1096 |
