# Deploy `@repo/web`

Public marketing + salon booking surface (Astro). SSR via `@astrojs/node` (`mode: 'standalone'`).

## Requirements

- **Node.js** `>= 22.12.0` (Astro 6)
- **Port** `3001` (matches existing reverse-proxy upstream for the public site)
- Env loaded from repo root (see `scripts/with-root-env.mjs`)

## Environment variables

| Variable | Purpose |
|----------|---------|
| `PUBLIC_APP_URL` | Canonical site origin (sitemap, OG URLs, robots). Example: `https://salon.example` |
| `PUBLIC_API_URL` | Public Hono API origin for client fetches. Example: `https://api.example` |
| `HOST` | Bind address (default `0.0.0.0` in Docker / PM2) |
| `PORT` | Listen port (default `3001`) |

`with-root-env.mjs` maps `NEXT_PUBLIC_*` -> `PUBLIC_*` when the Astro names are unset.

## Build & run (bare Node)

From repo root:

```bash
pnpm install
pnpm --filter @repo/web build
cd apps/web
HOST=0.0.0.0 PORT=3001 node ../../scripts/with-root-env.mjs node dist/server/entry.mjs
```

Or:

```bash
pnpm --filter @repo/web start
```

Artifacts:

- `apps/web/dist/client/` — static assets
- `apps/web/dist/server/entry.mjs` — Node server entry

## PM2

```bash
pnpm --filter @repo/web build
cd apps/web
# Ensure PUBLIC_* and DB-related env are in the shell or pm2 env block
pm2 start ecosystem.config.cjs
pm2 save
```

## systemd (example)

Adjust paths and `User=` for your VPS:

```ini
[Unit]
Description=Saluna public web (Astro)
After=network.target

[Service]
Type=simple
User=saloon
WorkingDirectory=/opt/saloon/pwas/web
Environment=NODE_ENV=production
Environment=HOST=0.0.0.0
Environment=PORT=3001
EnvironmentFile=/opt/saloon/.env.production
ExecStart=/usr/bin/node dist/server/entry.mjs
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Run `pnpm --filter @repo/web build` before `systemctl enable --now saloon-web`.

## Docker (air-gapped VPS)

Build on a machine with internet, ship the image tarball. See repo root `docs/VPS_AIRGAPPED_DEPLOYMENT.md`.

```bash
docker build -f apps/web/Dockerfile \
  --build-arg PUBLIC_APP_URL=https://your-public-domain \
  --build-arg PUBLIC_API_URL=https://your-api-domain \
  -t saloon-web:1.0 .
```

Runtime listens on `0.0.0.0:3001`.

## Fonts (Iran / no Google egress)

Fonts are **self-hosted** under `src/assets/fonts/` (Vazirmatn + Lalezar woff2, Vazirmatn Bold TTF for OG cards).

Refresh fonts on a connected machine:

```bash
node scripts/fetch-web-fonts.mjs
```

## Smoke test

With API + web running:

```bash
pnpm --filter @repo/web build
pnpm --filter @repo/web start &
BASE_URL=http://127.0.0.1:3001 SLUG=your-slug node scripts/smoke-web.mjs
```

## Reverse proxy (nginx)

Not configured in this repo. See `CUTOVER.md` for production validation notes.
