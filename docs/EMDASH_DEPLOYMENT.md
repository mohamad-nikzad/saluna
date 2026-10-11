# EmDash deployment

BL-0087 was completed under revised scope on 2026-10-11. The user removed the remaining human editor trials and scheduled-drafting proof requirements; these checks are not claimed as completed. The archived tasks preserve their technical evidence. Earlier rollout notes below are historical where they describe these checks as blockers. See [the completion record](../backlog/done/BL-0087-publish-blog-and-product-guides-with-emdash.md).

EmDash 1.1.0 is configured inside `apps/web` for `saluna.ir`. Its npm metadata requires
Node 22.16 or later and Astro 6. The web image, shared build scripts, and CI now
use Node 22.16.0. Astro remains at 6.4.2. The manager PWA stays at `app.saluna.ir`.

The [existing-project guide](https://docs.emdashcms.com/existing-project/) and
[Node deployment guide](https://docs.emdashcms.com/deployment/nodejs/) describe
the integration. The pinned package's database descriptor serializes its config
into the server bundle. `apps/web/cms/database.mjs` therefore reads
`CMS_DATABASE_URL` when the server starts. Builds need no CMS credentials or
database connection. `DATABASE_URL` remains the operational application's URL.

## Provision once

For a fresh production CMS, run this from `/opt/saluna` on the VPS:

```sh
bash scripts/prepare-cms-production.sh
```

This creates private CMS credentials and the isolated database using the existing
Postgres service. It backs up the previous environment, retains existing CMS
secrets on retries, and refuses to generate new credentials for an existing CMS
database. The encryption key uses the pinned release's 32-byte random base64url
format. It does not deploy or restart any application. Copy the resulting CMS
credentials to protected off-VPS backup storage.

For manual provisioning, use the following procedure.

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

The checked-in CMS seed defines Blog Articles and reusable public authors.
For an initialized installation, apply `scripts/configure-cms-blog.mjs` through
the administrator API as described in `docs/EMDASH_EDITOR.md`. Seed loading
alone does not evolve an existing content model. This configuration preserves
content; promotion of older SEO and credit fields requires the documented
editor review and publication, never an automatic draft publication.

Before opening the initial setup wizard to public traffic, restrict access to
`/_emdash/` at the edge to the operator's IP. Visit
`https://saluna.ir/_emdash/admin`, enter site details, create the first administrator,
and register a passkey. Setup is closed once the first administrator completes it.
Remove the temporary edge restriction after setup. Passkeys require HTTPS in
production and the exact public origin. Compose sets `EMDASH_SITE_URL` from
`PUBLIC_APP_URL`, so login works behind the existing TLS proxy.

### Arvan CDN preparation

Run the edge script from the repository on the operator's machine. It reads
`ARVAN_API_KEY` from the environment or the ignored `.env.local`, and never prints
it. `plan` reads configuration; `prepare` installs three cache-bypass rules and
locks initial setup writes and OAuth routes. OAuth callbacks can also create the
first administrator, so they share the bootstrap restriction. It saves the original configuration under the ignored
`.codex/deploy/cms-edge` directory. Existing unrelated rules are preserved, and it
refuses to exceed the five included custom page rules.

```sh
python3 scripts/configure-cms-edge.py plan
python3 scripts/configure-cms-edge.py prepare
```

The patterns `saluna.ir/_emdash*`, `saluna.ir/blog*`, and `saluna.ir/guides*`
cover the admin/API/media paths, article and guide indexes/details/previews, and
both content sitemaps. Shared edge caching is disabled so drafts stay private
and publication or withdrawal affects the next public request. Browser cache
policy continues to follow the application's response headers.

Before the first administrator completes setup, run `bootstrap` with the public
IP of the device they will use. The guard then denies setup writes from every
other IP. Setup/status remains accessible for container and deployment checks;
passkey login, invitations and media are unaffected. Google login opens to other
users when the guard is released. The operator IP must stay
the same throughout setup, including any VPN changes.

```sh
python3 scripts/configure-cms-edge.py bootstrap --ip YOUR_PUBLIC_IP
# Complete first-administrator setup at https://saluna.ir/_emdash/admin.
python3 scripts/configure-cms-edge.py release
```

`release` checks that EmDash reports setup complete before disabling the guard.
The Nginx template also denies setup and OAuth requests arriving directly at the
origin, allowing only Arvan's published network ranges for those routes. It checks
the TCP peer rather than forwarded IP headers. Keep that list aligned with
`https://www.arvancloud.ir/en/ips.txt`. Production rollout
must also verify anonymous preview denial and the publishing lifecycle through
Arvan after the CMS image is deployed.

### Additional login methods

The user selected email magic links and Google on 2026-10-11 and confirmed that
neither provider account nor Google OAuth application exists yet. Both methods
remain pending; passkeys remain the configured authentication method.

For email, create a transactional email or SMTP account, choose the sender address,
and verify the sending domain. Add only the SPF/DKIM/DMARC records provided by that
service through Arvan DNS, preserving existing mail records. The native
`emdash-smtp` 0.4.0 plugin declares compatibility with EmDash >=1.0.1 and provides
SMTP and hosted transports. Install and register it after the provider is chosen,
configure its credentials through its protected admin settings, then verify a
test delivery, an invitation and a real sign-in link. The provider must be reachable
from the VPS. Email links, emailed invitations and recovery share that transport.

For Google, create a Web application OAuth client in Google Cloud and register
`https://saluna.ir/_emdash/api/auth/oauth/google/callback` as an authorized redirect
URI. Set `EMDASH_OAUTH_GOOGLE_CLIENT_ID` and `EMDASH_OAUTH_GOOGLE_CLIENT_SECRET` in
the private production environment; Compose now passes these to web. Register
`google()` from `emdash/auth/providers/google` in EmDash's `authProviders` after
the credential-loading issue below is resolved. Do not enable broad email-domain
self-signup; administrators should invite specific users and choose their roles.

The pinned Node OAuth routes were inspected during preparation. They currently
read `import.meta.env` rather than Node's `process.env`; the retained production
bundle contains a build-time environment object. Passing credentials through
Compose alone therefore does not establish working Google login. Before activation,
fix or upgrade that compatibility behavior and prove a credentials-free build
followed by runtime-only credential injection, then test OAuth sign-in and invited
user access. Never work around this by putting provider secrets in build arguments.

See [upstream authentication](https://docs.emdashcms.com/guides/authentication/),
[email setup](https://docs.emdashcms.com/guides/email/), and the
[email plugin's installation guide](https://github.com/masonjames/emdash-smtp).

### Production preparation on 2026-10-11

The Arvan cache rules and initial-setup firewall guard were installed and read
back through the API. Public `/blog`, `/guides`, both content sitemaps, and native
setup/status returned `X-Cache: BYPASS`. Setup/admin returned 403 at the edge.
The existing production image still returns 404 for CMS/content routes because
EmDash has not been deployed there yet; this verifies edge configuration only.

The origin gateway's updated template passed `nginx -t` and was gracefully
reloaded. Direct-origin setup requests returned 403 even with a spoofed forwarded
IP header, while the direct-origin homepage remained 200. No image was replaced.

The production VPS now has a fresh `saluna_cms` database, isolated login role,
and retained CMS runtime secrets in its mode-0600 environment. Provisioning was
repeated successfully. A protected copy of the CMS credentials and the initial
empty database dump is outside Git and off the VPS under
`/Users/mohamad/.codex/private/saluna-cms-bl0087/production-preparation-2026-10-11`.
No CMS users or content were imported, and no production application was restarted
or deployed. Initial administrator registration, content transfer, durable media
mounting and a complete post-deployment backup remain deployment steps.

CMS login is separate from Salon and platform-admin authentication. Do not enable
EmDash's development auth bypass in production. Blog Articles use Author and
Editor accounts; administrative credentials are reserved for site management.

Astro stores login sessions in the writable `node_modules/.astro/sessions`
directory, relative to the runtime app directory. This keeps copied builds from
using the build machine's absolute session path. Sessions are ephemeral, so
editors sign in again after replacement.
Their passkeys, drafts, and media remain in persistent storage. The CSP includes
the hash of EmDash 1.1.0's inline theme initializer. Recheck this hash and the
browser console when upgrading EmDash. The optional public-page toolbar is
disabled through the supported `toolbar:false` setting. Its injected inline
CSS and session script do not fit this CSP. Native dashboard Preview, Save and
Publish remain available; signed previews still require a permitted CMS session.

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
The recovery rehearsal below copies all three together.

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

## Historical BL-0092 persistence rehearsal

This records the earlier rehearsal. Its old image was removed during cache
cleanup. Use the current recovery procedure below for new runs and explicitly
set `CMS_REHEARSAL_IMAGE`; the Compose file no longer supplies an old default.

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

## Current local recovery rehearsal

Use fresh, isolated projects named `saluna-cms-bl0087-*`, private environment
files outside Git, and separate database ports. The retained local copy binds
only `127.0.0.1:3301`; disposable Playwright fixtures use port 3303. Each project
has its own database and media volumes. Do not reuse operational passwords,
remove unrelated volumes, or run these scripts against production.

Build the production image without runtime credentials. It starts through
`apps/web/server.mjs`, which retains the canonical URL policy proved by the
production browser suite. Set `CMS_REHEARSAL_IMAGE`, `COMPOSE_PROJECT_NAME`,
`CMS_REHEARSAL_PORT=3301`, and a distinct `CMS_REHEARSAL_DB_PORT` in the private
environment alongside the fresh database passwords, URL, and persisted key.

```sh
docker build --platform linux/amd64 -f apps/web/Dockerfile -t saluna-web:bl-0097-baseline \
  --build-arg PUBLIC_APP_URL=http://localhost:3301 \
  --build-arg PUBLIC_API_URL=http://host.docker.internal:3302 .
docker compose --env-file "$PRIVATE_ENV" -f deploy/cms/rehearsal.compose.yml up -d --wait postgres
ENV_FILE="$PRIVATE_ENV" COMPOSE_FILE=deploy/cms/rehearsal.compose.yml ./scripts/provision-cms.sh
docker compose --env-file "$PRIVATE_ENV" -f deploy/cms/rehearsal.compose.yml up -d --wait web
node deploy/cms/recovery.browser.mjs bootstrap "$PRIVATE_STATE" baseline
docker compose --env-file "$PRIVATE_ENV" -f deploy/cms/rehearsal.compose.yml up -d --wait --force-recreate web
node deploy/cms/recovery.browser.mjs verify "$PRIVATE_STATE" replacement
deploy/cms/recovery.sh backup "$PRIVATE_ENV" "$PRIVATE_BACKUP"
```

The browser fixture registers separate technical operator and Editor passkeys,
stores their credentials only in the protected state directory, and uses a fresh
browser session to authenticate again on each run. It uploads cover and inline
media in the native admin, saves Persian text, checks both the published article
and its pending private revision, checks session-backed signed previews, denies
anonymous copied preview links, and compares anonymous image bytes. Its screenshots
and evidence files contain no passkey secrets or preview tokens. It also prepares
an unconsumed Editor invitation using a local placeholder address and the native
copy-link fallback; no email provider or outgoing email is involved.

`recovery.sh backup` stops the web writer while it captures a custom-format
Postgres dump, local media archive, encryption key and image identity. It resumes
web even if copying fails. An incomplete directory is not a valid recovery point.
Protect and copy the whole directory to independent backup storage. JSON content
export does not replace the raw database backup: authentication, schema,
references, revisions, migration history and settings also need restoration.
[EmDash backup guidance](https://docs.emdashcms.com/guides/backups/) describes
these requirements.

Test an exact upgrade in a separate source copy and image. Align both `emdash`
and the directly installed `@emdash-cms/auth` version there. Stop the baseline
web service before binding the candidate to port 3301; retain its database and
media volumes. Give the candidate fresh database credentials and volumes but
the backed-up encryption key. Restore the baseline recovery point into that
fresh environment, then run `candidate` mode for native Save, preview, media,
publication and withdrawal checks. The repository remains pinned to the tested
baseline until an intentional upgrade is approved. EmDash applies pending core
migrations on the first request; the old image alone cannot reverse database
migrations. [EmDash update guidance](https://docs.emdashcms.com/deployment/updating/)
requires a recovery point and matching runtime packages.

```sh
deploy/cms/recovery.sh restore "$CANDIDATE_ENV" "$PRIVATE_BACKUP"
node deploy/cms/recovery.browser.mjs candidate "$PRIVATE_STATE" upgrade
# Stop candidate web, then restore into another fresh baseline project.
deploy/cms/recovery.sh restore "$RECOVERY_ENV" "$PRIVATE_BACKUP"
node deploy/cms/recovery.browser.mjs verify "$PRIVATE_STATE" restored
```

Restore refuses an existing CMS table set or any non-directory media entry,
including symlinks and special files. Empty helper-image directories are safe.
It restores
CMS-role ownership, sets media ownership to UID 1000, and requires the matching
backed-up key before starting web. Recovery must prove native editor
reauthentication, private drafts, published output, exact media bytes and another
saved edit. No encrypted external plugin setting is configured in the local
fixture; retaining the key does not claim a tested external plugin connection.

The persistent local copy and its private run-command pointers remain outside
the implementer worktree after handoff. The intended editor's own physical
passkey registration and complete Persian trial remain pending until the end of
the parent spec. Automated technical accounts do not satisfy that trial.

## CMS deployment smoke

Run `BASE_URL=http://localhost:3301 pnpm smoke:web` against the local copy or set
the deployed public origin. It must match the configured passkey relying-party
host. Keep the existing `SLUG` and reachable operational API inputs for the public
Salon checks. A healthy landing page alone does not prove the CMS works.

The CMS checker requests native setup/database status, the public blog, the
native editor's scripts and stylesheets, and native passkey login options. It
fails on incomplete initial setup, failed content reads, unavailable editor
assets or login dependencies, and an incompatible passkey origin. Requests have
a ten-second timeout. Generating login options consumes a native rate-limit
slot, so run this deliberate deployment smoke check rather than a frequent
monitor. The container's frequent health probe remains the setup/status request.

The production browser suite faults its own disposable database and built editor
stylesheet. In both cases the landing page stays 200 while the CMS smoke fails.
The stylesheet is restored in `finally`; the fixture removes only its labelled
Postgres container and generated state. Existing landing-page and Salon smoke
checks remain in the same command.

## BL-0097 technical evidence on 2026-10-07

The local Linux amd64 rehearsal used Node 22.16.0, Postgres 16, and aligned EmDash
core/auth 1.1.0. It passed web-container replacement, quiesced database/media/key
backup, isolated core/auth 1.2.0 upgrade, and fresh-volume 1.1.0 recovery. Each
phase used native operator and Editor passkey reauthentication, Persian editing
and Save/reopen, a published article with a pending private title, an unpublished
draft, session-backed signed preview and anonymous denial, cover and inline
image decoding, exact image bytes, public metadata and runtime discovery.
The candidate also published and withdrew a disposable article without rebuild.

The exact baseline image manifest is
`sha256:8802387873aa7dc75064f386275a582db77ee38b554063eb56a5878a2fd95007`.
The isolated candidate manifest is
`sha256:f26ca87bf978ed49bac2b30a546a5e4619dbc025c8bdff1dae5a63eb72afce35`.
The repository remains pinned to 1.1.0. Reproduce the candidate in a separate
source copy with both direct native packages pinned to 1.2.0 and the candidate
root manifest and lock override `@codemirror/language: 6.12.4`. Preserve unrelated
baseline importer, package and snapshot entries. The initial candidate install
resolved language 6.13.0, whose source imported undeclared
`@codemirror/streamparser` and failed the build. Native admin 1.2.0 accepts
language `^6.12.4`; the tested compatible override is confined to the candidate.

The fresh restored 1.1.0 project remains healthy on loopback port 3301. Protected
environment files, technical credential state, raw recovery points, invitation,
screenshots and exact run pointers live outside Git under
`/Users/mohamad/.codex/private/saluna-cms-bl0087`. Stable milestone notes are in
`/Users/mohamad/.codex/saluna-bl0087-notes/bl0097-evidence.md`. The occupied-media
guard also refused a sentinel upload and FIFO without overwriting either; only
that temporary guard project's volumes were removed.

The production CMS suite passed 16 tests; its default development target passed
14 and skipped two production-only checks. The native editor still has English
navigation and publication controls. Persian article fields and text render
right-aligned, and the stray public toolbar was removed. The intended editor's
own physical passkey registration and full Persian usability trial have not
happened. BL-0097 stays open for that human trial, and production publishing is
still gated by the parent release checks. No production deployment occurred.

## Deployment attempt, 2026-10-11

The user reviewed the blog and guide presentation and authorized deployment.
The Linux production image `saluna-web:0.7.1-cms-20261011` built successfully
with the frozen lockfile and production public URLs. Web tests passed 31/31,
title checks passed 6/6, and type checking reported no errors or warnings.

A fresh quiesced source backup and a separate sanitized transfer package are
retained in protected local storage. The transfer contains four real blog drafts,
one published `create-client` guide, their revisions, and six media files. Local
test entries, login accounts, credentials, invitations, tokens, OAuth clients,
preview secrets, and other transient records are excluded. Publication states
are preserved. The source CMS remains unchanged.

The transfer restored successfully into an isolated Postgres database with the
exact `saluna_cms` role and database name. The new production image passed checks
for public pages, both content sitemaps, all three current guide screenshots,
draft privacy, native setup assets, and first-admin registration options with
`saluna.ir` as the relying-party ID and a Secure setup cookie. No administrator
was enrolled by the rehearsal.

The initial deployment attempt was blocked by SSH and HTTPS timeouts. After the
user disabled the VPN, connectivity returned and the release was applied. The
running web image is `127.0.0.1:5000/saluna-web:0.7.1-cms-20261011`, with config
digest `sha256:4c1726bcda693a029fd5aaad0170bcd2a28eaeee9ccc3b9acd731db6685bd790`.
The local registry manifest digest is
`sha256:306e14bc56510b683076e906480e8b7e4d27ff9621cef4b205c5bd89edb77dd1`.
Only the web container restarted. The gateway reloaded successfully; Postgres,
API, manager PWA, and platform admin retained their existing running containers.

Live checks through Arvan passed for the published guide and its three current
screenshots, blog and guide indexes and sitemaps, native setup assets, draft and
fixture privacy, unauthenticated API rejection, and CDN cache bypass. Direct
origin setup remained 403 even with a spoofed forwarding header. The API and
manager health endpoints passed. The production environment remains mode 0600
and its CMS credentials match the original provisioned values.

A protected off-VPS production snapshot is saved at
`/Users/mohamad/.codex/private/saluna-cms-bl0087/production-postdeploy-2026-10-11`.
It includes database, media, persisted runtime credentials, image reference and
checksums. The release and content manifests and exact source hashes remain in
the protected transfer directory. Live check evidence is `live-checks.json`.

Rollback configuration, the prior image reference, and an empty-CMS recovery
point are saved under `/opt/saluna/cms-releases/20261011`. Only the sanitized
content dump and media archive were restored after checking both targets were
empty. The transfer directory was not copied wholesale; rehearsal environment
files contain local credentials. The original production encryption key was
retained because the transfer excludes encrypted local settings. The existing
web-only deploy script and local registry applied the release.

First-admin setup remains guarded; this machine's public IP is allowed.
The operator must complete their own passkey registration at
`https://saluna.ir/_emdash/admin/setup`; release the bootstrap guard only after
setup status reports `needsSetup: false`. Email and Google authentication remain
pending provider-account setup and the documented Node OAuth integration fix.

### First-admin wizard correction

The 1.1.0 dashboard wizard always starts at its Site form, even when native
setup status reports the Admin step. The transferred `setup_complete` flag
therefore prevented the wizard's site POST while no production users existed.
The flag was removed in a transaction conditioned on an empty users table.
Content counts remained four drafts and one published guide.

Choose **Empty site** in this already populated installation. That choice means
no additional seed content, and existing collections and fields are skipped. An
isolated test of the actual site POST succeeded and the full article and guide
row hashes remained identical. Import is for uploading another `.emdash` package
after setup; the reviewed content has already been transferred.

The original bootstrap IP obtained through an external IP service also differed
from the source IP Arvan observed for the operator's browser. The guard exception
was corrected to the browser's current source IP, confirmed in the origin access
logs. A validation-only setup POST should return the native 400 JSON response,
rather than an edge denial, before the operator retries the wizard. The operator
then enters their account details and registers their own passkey.

### Administrator enrollment and publication confirmed

The operator completed their own production passkey enrollment and published
all four transferred Blog Articles on 2026-10-11. Native setup status returned
`needsSetup: false`, and the database confirmed one enabled Administrator and
one passkey credential. All four public article URLs returned 200 through Arvan
with cache bypass. The existing published guide remained available. The
temporary Arvan bootstrap guard was released only after this verification.

A fresh protected recovery point at
`/Users/mohamad/.codex/private/saluna-cms-bl0087/production-published-2026-10-11`
includes the production database with the human account, publication revisions,
media, persisted encryption credentials, exact image reference, and checksums.

The operator disabled search exclusion and republished all four articles.
Production records now have `search_excluded: false`, all four public pages
omit `noindex`, and the blog sitemap includes their canonical URLs. Arvan
continues to bypass its cache for the article pages and sitemap. This makes
the articles eligible for indexing; search engines decide when to index them.
A fresh recovery point including these revisions is saved at
`/Users/mohamad/.codex/private/saluna-cms-bl0087/production-indexed-2026-10-11`.
Email and Google authentication remain pending provider setup.

### Persian public URLs, 2026-10-11

The operator authorized Persian slugs for the four published Blog Articles and
the published Product Guide. The native EmDash runtime staged each rename as a
draft and published it with revision preconditions. Article fields, publication
dates, media and IDs were preserved. No new CMS credentials were created.

| Section | Previous slug                         | Published Persian slug      |
| ------- | ------------------------------------- | --------------------------- |
| Blog    | `salon-staff-commission-calculation`  | `محاسبه-کمیسیون-پرسنل-سالن` |
| Blog    | `organize-salon-appointment-requests` | `مدیریت-درخواست-نوبت-سالن`  |
| Blog    | `useful-salon-client-records`         | `پرونده-مشتری-سالن`         |
| Blog    | `salon-hours-staff-schedule-closures` | `برنامه-کاری-پرسنل-سالن`    |
| Guides  | `create-client`                       | `افزودن-مشتری-در-سالونا`    |

All five Persian URLs return 200 and their canonical metadata, content indexes
and sitemaps use the new URLs. Each English URL redirects directly with 301,
preserving query parameters. Persian trailing-slash variants redirect to the
canonical address. Both public content sitemaps remain indexable and bypass the
Arvan cache. Existing application links to the English guide URL remain valid
through its redirect. Future writing follows `docs/agents/public-content.md`.

The isolated rename rehearsal exposed two missing singleton rows that the
content-only transfer had removed: `_emdash_redirect_write_lock` and
`_emdash_redirect_state`. Without them, native publication of a renamed entry
returned `RedirectWriteBusyError`. The exact EmDash 1.1.0 migration defaults were
restored, first in the rehearsal and then in production, using `ON CONFLICT (id)
DO NOTHING` to preserve existing state. The content scrub now restores these
defaults before exporting. For an older sanitized dump, restore these records
before attempting a rename:

```sql
BEGIN;
INSERT INTO _emdash_redirect_write_lock (id, token, expires_at, generation)
VALUES (1, '', 0, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO _emdash_redirect_state
  (id, revision, generation, generation_revision, repair_expires_at)
VALUES (1, 0, NULL, -1, 0) ON CONFLICT (id) DO NOTHING;
COMMIT;
```

The pre-rename recovery point is `production-indexed-2026-10-11`. The final
database, media, runtime credentials, image reference, checksums and live URL
verification are saved under
`/Users/mohamad/.codex/private/saluna-cms-bl0087/production-persian-slugs-2026-10-11`.

### Production draft MCP, 2026-10-11

The user requested production MCP access and selected create/edit drafts only.
A dedicated Author 30 identity, `saluna-production-drafts@agents.invalid`, now
has a native 90-day PAT with exactly the four content/media read/write scopes.
Codex's project-scoped `saluna_emdash_prod` connection runs the local stdio
adapter at `scripts/cms-drafts-mcp.mjs`. The ignored project config references
a protected credential file outside Git. It does not expose a new public server
or require a web deployment. Native account and token-hash records remain in
the existing `saluna_cms` database.

The adapter enforces draft-only operations because native Author permissions
include publication of the account's own content. It allows creation and
revision only of its own plain, unscheduled drafts in Blog Articles and Product
Guides. Publishing, scheduling, deletion and administration tools are absent.
Published entries, other writers' drafts and stale revisions are refused.
See [production connection instructions](EMDASH_AGENT.md#production-mcp-connection)
for tools, private credential handling, expiry, renewal and revocation.

Live stdio verification passed for reads, create/edit operations in both
collections, signed previews, anonymous draft privacy and policy rejection.
Both temporary test entries were moved to native Trash after verification.
All 12 draft-title and MCP policy unit checks passed. Codex CLI resolved the
project's enabled MCP config with the expected command and credential path.

A fresh protected recovery point at
`/Users/mohamad/.codex/private/saluna-cms-bl0087/production-mcp-2026-10-11`
contains the CMS database, media, persisted runtime credentials, exact image
reference, MCP credential, verification report, cleanup receipts and checksums.
Treat the whole directory as secret-bearing. Retiring access requires native
PAT revocation even if a local credential or backup is later removed.
