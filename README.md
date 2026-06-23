# Saluna

## Local development

Development uses Docker Postgres on `127.0.0.1:5432`. All config lives in `.env.local`.

```bash
cp .env.example .env.local   # then edit secrets as needed
pnpm install
pnpm db:prepare              # start Postgres + apply migrations
pnpm db:seed                 # optional demo data
pnpm dev                     # PWA + public web + API
```

### Individual apps (fixed ports)

| App | Command | Port |
|-----|---------|------|
| Manager PWA | `pnpm dev:pwa` | 3000 |
| Public web (Astro) | `pnpm dev:web` | 3001 |
| API (Hono) | `pnpm dev:api` | 3002 |
| Platform admin | `pnpm dev:admin` | 3003 |

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

The app uses standard PostgreSQL through `drizzle-orm` and `postgres`. Runtime reads `DATABASE_URL`; migrations and seeds prefer `DATABASE_URL_DIRECT` and fall back to `DATABASE_URL`. No provider-specific SDK is required — changing hosts is a matter of updating env vars and running migrations.

## CI schema checks

`pnpm db:check` fails if `packages/database/src/schema.ts` changed without a matching checked-in migration. `.github/workflows/main-db.yml` runs this check on pull requests and pushes to `main`.
