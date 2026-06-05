# Saluna

## Database setup

This project is intentionally configured to stay portable across Neon, Supabase, Railway, Render, or your own VPS.

- The app uses standard PostgreSQL through `drizzle-orm` and `postgres`
- Runtime reads `DATABASE_URL`
- Migrations and seeds prefer `DATABASE_URL_DIRECT` and fall back to `DATABASE_URL`
- Moving to another provider is mostly a matter of changing env vars and running migrations

## Neon + Vercel

1. Create a Postgres database in Neon.
2. Copy the pooled connection string into Vercel as `DATABASE_URL`.
3. Copy the direct connection string into Vercel as `DATABASE_URL_DIRECT`.
4. For local work, add the same database variables to `.env.database.main` (and a dev branch file if you use split env; see **Local development** below). Put `JWT_SECRET` in `.env.local`.
5. Set `JWT_SECRET` in both Vercel and `.env.local`.

Example:

```env
DATABASE_URL=postgresql://user:password@ep-xxxx-pooler.region.aws.neon.tech/dbname?sslmode=require
DATABASE_URL_DIRECT=postgresql://user:password@ep-xxxx.region.aws.neon.tech/dbname?sslmode=require
JWT_SECRET=replace-with-a-long-random-secret
```

## Local development

Use a **split env** so you can switch Neon branches without editing secrets:

- `.env.local` — `JWT_SECRET`, VAPID keys, and anything else that is not branch-specific
- `.env.database.dev` — `DATABASE_URL` + `DATABASE_URL_DIRECT` for your **dev** Neon branch
- `.env.database.main` — same for your **production** Neon branch

Scripts load `.env.local` first, then the database file, so the database URLs always match the command you run:

```bash
pnpm install
pnpm db:check         # verify schema.ts matches checked-in migrations
pnpm db:push          # schema -> dev branch (default)
pnpm db:seed          # seed dev branch
pnpm dev              # PWA + public web + API

pnpm --filter @repo/pwa dev # manager PWA on port 3000
pnpm dev:web          # marketing + booking (Astro) on port 3001
pnpm dev:web-stack    # Astro + API with .env.database.local
pnpm smoke:web        # smoke checks (set BASE_URL, optional SLUG)

### Local Postgres (Docker)

For fully offline work, copy `.env.database.local` (see repo; points at `127.0.0.1:5432/salon`), start Postgres, and apply checked-in migrations:

```bash
docker compose up -d postgres
pnpm db:prepare:local   # starts Postgres if needed, reconciles push drift, migrates
# or, if Postgres is already running:
pnpm db:reconcile:local && pnpm db:migrate:local
```

Use `pnpm db:migrate:local` (not bare `pnpm db:migrate`) so Drizzle targets the local database file, not Neon dev.
pnpm db:push:main     # schema -> production (use with care)
```

## Main branch database automation

The repo can protect `main` in two ways:

- `pnpm db:check` fails if `packages/database/src/schema.ts` changed without a matching checked-in migration.
- `.github/workflows/main-db.yml` runs that check on pull requests and, on pushes to `main`, applies checked-in migrations to the main database with `pnpm --filter @repo/database db:migrate`.

To enable the deploy step in GitHub Actions, set these repository secrets:

- `DATABASE_URL_MAIN` — required
- `DATABASE_URL_DIRECT_MAIN` — optional but recommended for migrations

## Switching providers later

If you move to another provider or a VPS:

1. Create a new PostgreSQL database.
2. Update `DATABASE_URL`.
3. Update `DATABASE_URL_DIRECT` if you want migrations/seeds to use a direct connection.
4. Run `pnpm db:push` or your preferred Drizzle migration flow.
5. Seed if needed with `pnpm db:seed`.

No Neon-specific SDK is required by the app, so the code does not need to change just because the host changes.
