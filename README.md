# Saluna

## Local development

Development uses Docker Postgres on `127.0.0.1:5432`. All config lives in `.env.local`.

Install Node.js 22.12 or newer, pnpm 9.15.9, and Docker with Compose.
On Windows, start Docker Desktop with its WSL 2 backend before preparing the
database. In PowerShell, use `Copy-Item .env.example .env.local` for the first step.

```bash
cp .env.example .env.local   # then edit secrets as needed
pnpm install
pnpm db:prepare              # start Postgres + apply migrations
pnpm db:seed                 # optional demo data
pnpm dev                     # PWA + public web + platform admin + API
```

### Individual apps (fixed ports)

| App                      | Command          | Port       |
| ------------------------ | ---------------- | ---------- |
| Manager PWA + API        | `pnpm dev:pwa`   | 3000, 3002 |
| Public web (Astro) + API | `pnpm dev:web`   | 3001, 3002 |
| API (Hono)               | `pnpm dev:api`   | 3002       |
| Platform admin + API     | `pnpm dev:admin` | 3003, 3002 |

### Stacks

```bash
pnpm dev:web-stack      # Astro + API
pnpm dev:admin-stack    # admin + API
pnpm dev:pwa-lan        # PWA + API over LAN HTTPS (mobile testing)
pnpm smoke:web          # smoke checks (set BASE_URL, optional SLUG)
```

### Database commands

```bash
pnpm db:check           # verify schema.ts matches checked-in migrations
pnpm db:migrate         # apply checked-in migrations
pnpm db:push            # push schema changes (dev only)
pnpm db:studio          # Drizzle Studio
pnpm db:seed            # seed demo data
pnpm db:reconcile       # repair migration journal after db:push drift
```

If Postgres is already running:

```bash
pnpm db:reconcile && pnpm db:migrate
```

Or start Postgres manually:

```bash
docker compose up -d postgres
```

## Database portability

The app uses PostgreSQL through `drizzle-orm` and `postgres`. Runtime reads `DATABASE_URL`; migrations and seeds prefer `DATABASE_URL_DIRECT` and fall back to `DATABASE_URL`. To change database hosts, update these variables and apply the migrations.

## CI schema checks

`pnpm db:check` fails if `packages/database/src/schema.ts` changed without a matching checked-in migration. `.github/workflows/main-db.yml` runs this check on pull requests and pushes to `main`.

## Documentation

- [Backlog](backlog/INDEX.md) and [workflow](backlog/README.md)
- [Domain language](GLOSSARY.md) and [architecture decisions](docs/adr/)
- [Production deployments](docs/DEPLOYMENTS.md) and [tarball fallback](docs/VPS_AIRGAPPED_DEPLOYMENT.md)
- [Public web development](apps/web/README.md)
- [API client usage](packages/api-client/README.md) and [contract generation](packages/api-contract/README.md)
- [Monetization launch plan](docs/superpowers/plans/2026-08-04-monetization-launch-plan.md)
- [Unscheduled messaging proposals](docs/plans/messaging-follow-ups.md)
