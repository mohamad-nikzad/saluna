# EmDash deployment

EmDash 1.1.0 runs inside `apps/web` on `saluna.ir`. Its npm metadata requires
Node 22.16 or later and Astro 6. The web image, shared build scripts, and CI now
use Node 22.16.0. Astro remains at 6.4.2. The manager PWA stays at `app.saluna.ir`.

The [existing-project guide](https://docs.emdashcms.com/existing-project/) and
[Node deployment guide](https://docs.emdashcms.com/deployment/nodejs/) describe
the integration. The pinned package's database descriptor serializes its config
into the server bundle. `apps/web/cms/database.mjs` therefore reads
`CMS_DATABASE_URL` when the server starts. Builds need no CMS credentials or
database connection. `DATABASE_URL` remains the operational application's URL.

## Provision once

Set these private values in `.env.production`, readable only by the deployment
operator. Compose passes only the CMS URL and encryption key to the web service.
It does not pass the API's environment file or operational database password.

- `CMS_POSTGRES_PASSWORD`, a new random password for the `saluna_cms` login.
- `CMS_DATABASE_URL`, `postgresql://saluna_cms:<URL-encoded-password>@postgres:5432/saluna_cms`.
- `EMDASH_ENCRYPTION_KEY`, generated with the pinned CLI below. Retain it across deployments.

```sh
pnpm --filter @repo/web exec emdash secrets generate
chmod 600 .env.production
docker compose --env-file .env.production -f docker-compose.prod.yml up -d postgres
./scripts/provision-cms.sh
```

Copy the generated `emdash_enc_v1_...` value into the private environment file.
Do not put it in build arguments, public variables, logs, or tickets. Keep a
protected backup with the CMS database and media backups. Losing this key makes
encrypted plugin settings unreadable. Key rotation must follow the pinned
EmDash CLI's secrets workflow, rather than generating a replacement on startup.

Provisioning creates a dedicated database and login role. The role owns only the
CMS database, has no superuser, role creation, database creation, replication, or
RLS-bypass permission, and has no role memberships. The script removes PUBLIC's
CONNECT permission on the operational database and explicitly grants CONNECT to
`POSTGRES_USER`. If another operational login exists, explicitly grant it CONNECT
before this change. Existing operational connections remain active.

The script is repeatable, including a CMS password change. Keep the URL password
aligned with `CMS_POSTGRES_PASSWORD`, then restart web to use the changed password.
Do not use the CMS login as `POSTGRES_USER` or point `POSTGRES_DB` at `saluna_cms`.

## Deploy and initialize

Build and deploy with the existing web image workflow. Custom `SALUNA_NODE_IMAGE`
overrides must also provide Node 22.16 or later.

```sh
docker compose --env-file .env.production -f docker-compose.prod.yml up -d web
```

On the first CMS request, EmDash applies its core migrations under its Postgres
migration lock, then applies its built-in seed to a fresh database. Existing
content is preserved. The web health check requests both the landing page and
`/_emdash/api/setup/status`, so database or migration failures prevent a healthy
deployment. Core migrations run as the CMS role, which owns its tables. This
ticket uses EmDash's default `auto` migration policy. Subsequent model changes
belong to the content-model tickets.

The built-in seed requests full-text search for Posts and Pages. EmDash 1.1.0
supports that feature only on SQLite, so Postgres logs a nonfatal warning while
applying this seed. Content editing and media storage still work.

Before opening the initial setup wizard to public traffic, restrict access to
`/_emdash/` at the edge to the operator's IP. Visit
`https://saluna.ir/_emdash/admin`, enter site details, create the first administrator,
and register a passkey. Setup is closed once the first administrator completes it.
Remove the temporary edge restriction after setup. Passkeys require HTTPS in
production and the exact public origin. Compose sets `EMDASH_SITE_URL` from
`PUBLIC_APP_URL`, so login works behind the existing TLS proxy.

CMS login is separate from Salon and platform-admin authentication. Do not enable
EmDash's development auth bypass in production. The built-in Posts collection is
available for the persistence fixture; BL-0093 defines Blog Article fields and
editor access.

Astro stores login sessions in the writable `node_modules/.astro/sessions`
directory. Sessions are ephemeral, so editors sign in again after replacement.
Their passkeys, drafts, and media remain in persistent storage. The CSP includes
the hash of EmDash 1.1.0's inline theme initializer. Recheck this hash and the
browser console when upgrading EmDash.

## Durable media

The `cms_media` named volume mounts at `/app/apps/web/.emdash/uploads`. EmDash
serves media through `/_emdash/api/media/file`. The image prepares this directory
with ownership for its non-root `node` user; Docker copies that ownership when it
initializes a new named volume. A preexisting or restored volume must also be
writable by UID 1000. The gateway permits 5 MiB bodies; EmDash limits uploads to
4 MiB. Large guide videos belong on an external video host.

Ordinary `up`, image upgrades, and `--force-recreate web` keep both the Postgres
and media volumes. `down --volumes` deletes them. Back up `saluna_cms` with
`pg_dump`, archive `cms_media`, and retain the private encryption key. A volume
survives container replacement on this VPS; it does not survive loss of the VPS.
Upgrade and restore rehearsals are BL-0097.

## Local development

Use a separate CMS database. To provision the local Compose Postgres, put a new
`CMS_POSTGRES_PASSWORD` in a private `.env.cms.local` file and run:

```sh
COMPOSE_FILE=docker-compose.yml ENV_FILE=.env.cms.local ./scripts/provision-cms.sh
```

Set `CMS_DATABASE_URL` to the local `saluna_cms` database through port 5432, generate
an encryption key, and set `EMDASH_SITE_URL=http://localhost:3001` in that same file.
Then run `ROOT_ENV_FILES=.env.cms.local pnpm --filter @repo/web dev`. Local media
lives in the ignored `apps/web/.emdash/uploads` directory. Never use production
CMS credentials for development, preview builds, or rehearsals.

## Production-image persistence rehearsal

Use `deploy/cms/rehearsal.compose.yml` with a disposable private environment file.
Generate fresh passwords and an EmDash key. Set `CMS_DATABASE_URL` to the
`saluna_cms` login and database on host `postgres`. The rehearsal's operational
login is `operator` and its operational database is `salon`.

```sh
docker build --platform linux/amd64 -f apps/web/Dockerfile -t saluna-web:bl-0092 \
  --build-arg PUBLIC_APP_URL=http://localhost:3301 \
  --build-arg PUBLIC_API_URL=http://host.docker.internal:3002 .
docker compose --env-file .env.cms.local -f deploy/cms/rehearsal.compose.yml up -d postgres
COMPOSE_FILE=deploy/cms/rehearsal.compose.yml ENV_FILE=.env.cms.local ./scripts/provision-cms.sh
docker compose --env-file .env.cms.local -f deploy/cms/rehearsal.compose.yml up -d web
```

Open `http://localhost:3301/_emdash/admin` in a Playwright CLI Chromium session.
Run `deploy/cms/persistence.browser.js` with `run-code --filename`. It registers
a virtual passkey through real production setup, authenticates an operator, saves
a Persian draft, uploads a PNG through the real media API, and checks both. It
also checks that the authenticated admin renders Posts navigation. Keep this
browser session open; it retains the virtual passkey and fixture identifiers.

```sh
playwright-cli -s=cms run-code --filename deploy/cms/persistence.browser.js
docker compose --env-file .env.cms.local -f deploy/cms/rehearsal.compose.yml up -d --force-recreate web
playwright-cli -s=cms run-code --filename deploy/cms/persistence.browser.js
BASE_URL=http://localhost:3301 pnpm smoke:web
```

The second browser run logs in again with the same passkey, reads the draft and
media metadata, and compares downloaded image bytes with the uploaded bytes.
Run existing public Salon smoke checks with a published `SLUG` and a reachable
operational API. Also check that a CMS connection to the operational database
fails, and that an anonymous request to `/_emdash/api/content/posts` returns 401.
Never run this setup script against a live site.

After the rehearsal, close its browser and remove only the disposable stack and
volumes with the rehearsal Compose file. Leave production and development volumes
alone.

## Verification on 2026-10-06

BL-0092 passed against the Linux amd64 production image built from
`apps/web/Dockerfile`, using Node 22.16.0, EmDash 1.1.0, and Postgres 16.
The verified local image ID was
`sha256:35e373847f1adf901becf6959ba3c1726d6022c7e130869363a35ec03e3df661`.

- Core startup applied 90 migrations to a fresh CMS database.
- A real passkey setup and login saved the Persian draft and uploaded a PNG.
  Replacing the container preserved the draft and media IDs, metadata, and exact
  image bytes. The operator logged in again and viewed the draft in the admin UI.
- CMS connections to both the empty operational database and the seeded Salon
  test database failed with `permission denied for database`. The CMS role had
  no elevated privileges. Provisioning also passed on a second run.
- Anonymous content access returned 401. Scanning both client and server build
  output found neither runtime CMS secret value.
- All 25 web tests, web typecheck, and lint passed. Existing landing-page SEO,
  assets, public Salon pages, sitemap, Open Graph, withdrawal, and re-enabling
  checks passed before and after container replacement against a separate seeded
  API database.

This was a local production-image rehearsal. Live deployment still requires
private credentials, provisioning, and the operator's initial passkey setup.
