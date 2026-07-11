# Air-Gapped VPS Deployment

This runbook deploys Saluna to a single ParsPack-style VPS when the server has
limited or unreliable outbound internet.

Normal production deployments are registry-first CI/CD: CI builds only changed
app images, pushes them to an Iranian-reachable registry, and asks the VPS to
pull and restart only the affected services. The tarball workflow in this
document is the bootstrap and emergency fallback path, not the long-term happy
path.

The fallback air-gapped path is:

1. Build Docker images on a connected builder.
2. Save the images as checksummed tarballs.
3. Copy the tarballs, compose file, Nginx template, env file, and apply script
   to `/opt/saluna`.
4. Load images on the VPS and run Docker Compose.

For the deployment workflow used today, see
[`DEPLOYMENTS.md`](./DEPLOYMENTS.md).

The retired public Next app and retired manager app are deprecated and are not
deployed here.

## Truth Check

Current repo status, checked against the scripts and compose files:

- The deploy script is
  [`scripts/apply-airgap-release.sh`](../scripts/apply-airgap-release.sh).
  Do not use `pwaly-airgap-release.sh`; that script does not exist.
- [`docker-compose.prod.yml`](../docker-compose.prod.yml) starts `gateway`,
  `api`, `web`, `pwa`, `postgres`, and optionally `registry`.
- The gateway maps both `${HTTP_PORT:-80}:80` and `${HTTPS_PORT:-443}:443`.
  The Nginx template contains TLS server blocks, so
  `/opt/saluna/deploy/nginx/certs/saluna-origin.crt` and
  `/opt/saluna/deploy/nginx/certs/saluna-origin.key` must exist unless the
  compose/template is changed to be HTTP-only.
- The manager host is `app.saluna.ir`, not `pwa.saluna.ir`.
- App images are tagged `saluna-api:${SALUNA_IMAGE_TAG}`,
  `saluna-web:${SALUNA_IMAGE_TAG}`, and `saluna-pwa:${SALUNA_IMAGE_TAG}`.
- The PWA build bakes `VITE_*` values into static files. The public Astro app
  also uses `PUBLIC_*` values during build. Change public origins only with a
  new image tag and rebuild.
- `PUBLIC_APP_URL` is currently overloaded in the web app: Astro uses it as the
  public site origin for sitemap/robots, while the landing page also uses it for
  `/login` and `/signup` links. Verify those links before launch; a follow-up
  code cleanup should split "public web origin" from "manager app origin".
- The release manifest
  `deploy/releases/saluna-release-${SALUNA_IMAGE_TAG}.env` is created on the
  builder, but the current upload script does not copy it to the VPS. The
  bundles and `.sha256` files are the apply-script inputs.

## Current And Target Versioning

Saluna does not currently use meaningful per-app semver for deployments. Runtime
versioning is image-tag based.

Source package versions now declared in the repo:

| Package       | Current `package.json` version | Deployment meaning              |
| ------------- | ------------------------------ | ------------------------------- |
| root `saluna` | `0.1.0`                        | workspace/package metadata only |
| `@repo/api`   | `0.10.0`                       | current API app version         |
| `@repo/web`   | `0.6.0`                        | current public web app version  |
| `@repo/pwa`   | `0.11.0`                       | current manager PWA app version |

These are bootstrap SemVer baselines assigned on `2026-06-06` from the current
feature maturity. They are not a reconstruction of historical release numbers;
they start the app-version history from this point forward.

Current deploy/image versioning:

| App         | Current image name | Current local configured tag | Last audited VPS tag |
| ----------- | ------------------ | ---------------------------- | -------------------- |
| API         | `saluna-api`       | `2026-06-05-1`               | `2026-06-04-1304`    |
| Public web  | `saluna-web`       | `2026-06-05-1`               | `2026-06-04-1304`    |
| Manager PWA | `saluna-pwa`       | `2026-06-05-1`               | `2026-06-04-1304`    |

Where those values come from:

- `.env.production` currently sets `SALUNA_IMAGE_TAG=2026-06-05-1`.
- `.env.production` currently sets `VITE_PWA_ASSET_VERSION=2026-06-05-1`, so the
  PWA asset/cache version follows the same release tag.
- `deploy/releases/saluna-release-2026-06-05-1.env` was built at
  `2026-06-05T18:51:28Z` from git SHA
  `e6fa2b7ca95c60af446b2956d27a56fc65d8124b`.
- [`DEPLOYMENTS.md`](./DEPLOYMENTS.md) records the current registry-first
  deployment workflow.

Current artifact reality:

| Artifact                                                  | Current size |
| --------------------------------------------------------- | -----------: |
| `deploy/releases/saluna-apps-2026-06-05-1.tar.gz`         |       `497M` |
| `deploy/releases/saluna-apps-2026-06-04-1304.tar.gz`      |       `498M` |
| `deploy/releases/saluna-infra-postgres16-nginx127.tar.gz` |       `134M` |

This is why the target CI/CD plan should move away from app tarballs as the
normal path. A single changed app currently creates and ships a roughly 500 MB
combined app bundle because all three images share one release tag.

Target app versioning:

Use independent SemVer-style app versions for each deployable app, and use image
tags as build identifiers derived from those versions.

| App         | Version source          | Current version | Example next patch | Example next feature |
| ----------- | ----------------------- | --------------: | -----------------: | -------------------: |
| API         | `apps/api/package.json` |        `0.10.0` |           `0.10.1` |             `0.11.0` |
| Public web  | `apps/web/package.json` |         `0.6.0` |            `0.6.1` |              `0.7.0` |
| Manager PWA | `apps/pwa/package.json` |        `0.11.0` |           `0.11.1` |             `0.12.0` |

The root `package.json` can stay as workspace metadata, or become a product
release version later. It should not block independent app releases.

Version bump rules before `1.0.0`:

- Patch, for example API `0.7.0` -> `0.7.1`: bug fix, copy/style tweak, safe
  refactor, dependency patch, or operational fix with no intentional product
  behavior change.
- Minor, for example API `0.7.1` -> `0.8.0`: new user-visible capability, changed
  workflow, additive API endpoint, additive database migration, or any breaking
  change while the product is still pre-`1.0.0`.
- Major, for example `1.0.0` -> `2.0.0`: reserve until after Saluna declares a
  stable `1.0.0` contract; use for breaking API/auth/data/operator contracts.

After `1.0.0`, use standard SemVer:

- Patch for backward-compatible fixes.
- Minor for backward-compatible features.
- Major for breaking changes.

Image tag format should be version plus git SHA, because Docker tags are the
deployable artifact while SemVer is the human release version:

```text
registry.hamdocker.ir/<namespace>/saluna-api:0.7.1-e6fa2b7
registry.hamdocker.ir/<namespace>/saluna-web:0.4.1-e6fa2b7
registry.hamdocker.ir/<namespace>/saluna-pwa:0.7.1-e6fa2b7
```

Also add OCI image labels during Docker builds so the running container can
report both the app version and source revision:

```text
org.opencontainers.image.version=0.7.1
org.opencontainers.image.revision=e6fa2b7ca95c60af446b2956d27a56fc65d8124b
org.opencontainers.image.source=<repo-url>
```

Release process target:

1. Decide which app changed: `api`, `web`, or `pwa`.
2. Choose the version bump for that app from the rules above.
3. Update only that app's `package.json` version.
4. Build and push only that app image tagged as `<version>-<short-sha>`.
5. Update the VPS deployment state for only that app.
6. Deploy and smoke-check only that app path.
7. Record the release in a small changelog or release manifest.

For PWA releases, set `VITE_PWA_ASSET_VERSION` from `SALUNA_PWA_VERSION` or
`SALUNA_PWA_IMAGE_TAG`. Do not leave it tied to a global date release once
per-app versions are adopted. Any icon change must ship with a new PWA version
or image tag so browsers fetch the versioned manifest and icon URLs instead of
their year-long cached copies. Some platforms snapshot the home-screen icon at
install time, so existing users may still need to remove and reinstall the PWA
to see an updated icon.

## Better Options

Use this tarball workflow as the short-term, least-surprising bootstrap path. It
avoids npm, apk, GitHub, and Docker Hub access from the VPS.

For repeated production releases, use HamGit/Hamravesh CI: build on a reachable
runner using HamDocker, hmirror npm, and Arvan apk; push only the changed app
image to `registry.hamdocker.ir`; then SSH to the VPS and pull/restart only that
service. That removes manual tarball transfer, avoids large release artifacts on
the developer machine, and gives each app an independent deployed version.

Do not build on the VPS as the default. The Dockerfiles and CI jobs are
configured to use Iranian mirrors, but VPS-local builds still spend production
CPU/RAM on builds.

When a HamGit runner or emergency VPS build needs Iranian mirrors, set:

```bash
SALUNA_NODE_IMAGE=hub.hamdocker.ir/library/node:22.12.0-alpine
SALUNA_NGINX_IMAGE=hub.hamdocker.ir/library/nginx:1.27-alpine
SALUNA_ALPINE_MIRROR=https://mirror.arvancloud.ir/alpine
SALUNA_NPM_REGISTRY=https://repo.hmirror.ir/npm/
SALUNA_PNPM_VERSION=9.15.9
```

The optional VPS-local registry is useful for faster later releases, but keep it
bound to `127.0.0.1` and push through SSH. A public unauthenticated registry is
not acceptable.

## Target CI/CD Workflow

This is the normal workflow:

```text
push to HamGit
  -> CI detects affected app: api | web | pwa
  -> CI builds only that Docker image with Iranian mirrors
  -> CI tags image as version-sha, for example saluna-api:0.7.1-e6fa2b7
  -> CI pushes to registry.hamdocker.ir/<namespace>/
  -> CI SSHs to the VPS origin IP
  -> VPS updates only that app tag and runs docker compose pull/up for that service
  -> VPS runs migrations only for API deployments
  -> VPS smoke-checks the changed service through Nginx
```

Target behavior by app:

| Changed app | Build        | VPS action                                       | Extra step                            |
| ----------- | ------------ | ------------------------------------------------ | ------------------------------------- |
| `api`       | `saluna-api` | pull and restart `api`, then `gateway` if needed | backup + migrations + API smoke check |
| `web`       | `saluna-web` | pull and restart `web`                           | public site smoke check               |
| `pwa`       | `saluna-pwa` | pull and restart `pwa`                           | manager PWA smoke check               |

The resumable implementation slice for that target now exists:

```bash
# Build machine or CI runner, after docker login:
SALUNA_IMAGE_REGISTRY=registry.hamdocker.ir/<namespace>/ \
  ./scripts/build-push-registry-app.sh api

# VPS, from /opt/saluna:
SALUNA_IMAGE_REGISTRY=registry.hamdocker.ir/<namespace>/ \
  ./scripts/deploy-registry-app.sh api 0.7.1-e6fa2b7
```

Use `api`, `web`, or `pwa` as the first argument. The build script reads the
selected app version from its `package.json`, defaults the tag to
`<version>-<short-sha>`, adds OCI version/revision/source labels, and pushes only
that app image. The VPS deploy script pulls only that service, restarts only that
service, runs backup/migrations only for API deploys, and writes the new app tag
to `.env.production` after the smoke check succeeds.

Keep a tiny deployment state file on the VPS, not large bundles on a laptop:

```env
SALUNA_API_VERSION=0.7.0
SALUNA_API_IMAGE_TAG=0.7.0-e6fa2b7
SALUNA_WEB_VERSION=0.4.0
SALUNA_WEB_IMAGE_TAG=0.4.0-e6fa2b7
SALUNA_PWA_VERSION=0.7.0
SALUNA_PWA_IMAGE_TAG=0.7.0-e6fa2b7
```

Implemented compatibility step: [`docker-compose.prod.yml`](../docker-compose.prod.yml)
now accepts per-app image tag variables while preserving `SALUNA_IMAGE_TAG` as a
shared fallback. True independent app versions should use per-app version and
tag variables, for example
`SALUNA_API_VERSION` / `SALUNA_API_IMAGE_TAG`,
`SALUNA_WEB_VERSION` / `SALUNA_WEB_IMAGE_TAG`, and
`SALUNA_PWA_VERSION` / `SALUNA_PWA_IMAGE_TAG`.

Keep artifact retention boring:

- Developer machines should not keep `deploy/releases/*.tar.gz` during normal
  CI/CD.
- CI should keep image layers in registry cache, not tarballs.
- The VPS should keep the current and previous image for each app.
- Registry retention should keep the last N tags per app plus explicitly pinned
  rollback tags.
- Tarball bundles should be produced only for bootstrap, disaster recovery, or
  when the registry path is down.

## Production Stack

| Host                         | Service                                   | Container  | Notes                                |
| ---------------------------- | ----------------------------------------- | ---------- | ------------------------------------ |
| `saluna.ir`, `www.saluna.ir` | Astro public and appointment-request site | `web`      | `@repo/web`, port `3001`             |
| `app.saluna.ir`              | Manager PWA                               | `pwa`      | `@repo/pwa`, Nginx static build      |
| `api.saluna.ir`              | Hono API                                  | `api`      | bundled Node server, port `3002`     |
| internal only                | PostgreSQL                                | `postgres` | Postgres 16 named volume             |
| `80`, `443`                  | Gateway                                   | `gateway`  | Nginx host router                    |
| `127.0.0.1:5000`             | Optional local registry                   | `registry` | only with Compose profile `registry` |

The app must be client-facing HTTPS in production. ArvanCloud TLS termination is
enough for browsers if public users access `https://...`; the origin may be HTTP
or HTTPS depending on Arvan settings. The current Compose/Nginx files still
require local certificate files because TLS blocks are present.

## Agent Quick Path

For the ParsPack VPS, the origin IP is documented in
[`DEPLOYMENTS.md`](./DEPLOYMENTS.md). Do not SSH to Arvan CDN IPs or
CDN-resolved hostnames.

Set these on the connected builder:

```bash
export VPS_HOST=YOUR_VPS_ORIGIN_IP
export SSH_USER=deploy
export SALUNA_IMAGE_TAG="$(git rev-parse --short=12 HEAD)"
export DOCKER_PLATFORM=linux/amd64
```

For a first tarball-only deploy:

```bash
INCLUDE_INFRA=1 ./scripts/build-airgap-release.sh
UPLOAD_INFRA=1 ./scripts/upload-airgap-release.sh
ssh "${SSH_USER}@${VPS_HOST}" \
  "cd /opt/saluna && SALUNA_IMAGE_TAG=${SALUNA_IMAGE_TAG} LOAD_INFRA=1 ./scripts/apply-airgap-release.sh"
```

For later app-only deploys:

```bash
./scripts/build-airgap-release.sh
./scripts/upload-airgap-release.sh
ssh "${SSH_USER}@${VPS_HOST}" \
  "cd /opt/saluna && SALUNA_IMAGE_TAG=${SALUNA_IMAGE_TAG} ./scripts/apply-airgap-release.sh"
```

The `deploy` user is the normal SSH user for production operations.

If you updated `SALUNA_IMAGE_TAG` inside `.env.production` before upload, the
explicit remote override is redundant but harmless.

## One-Time VPS Prep

The scripts assume Docker already works on the VPS. They do not install Docker.

Required:

- Docker Engine
- Docker Compose plugin
- SSH access to a user that can run Docker
- `/opt/saluna` owned by that deploy user
- `/opt/saluna/deploy/nginx/certs` containing the origin TLS files required by
  the current Nginx template
- Firewall/security-group rules for SSH, HTTP, and HTTPS as intended

Create the directory layout:

```bash
sudo mkdir -p /opt/saluna/{releases,scripts,backups}
sudo mkdir -p /opt/saluna/deploy/nginx/{templates,certs}
sudo chown -R deploy:deploy /opt/saluna
```

Install origin certs:

```bash
install -m 0644 saluna-origin.crt /opt/saluna/deploy/nginx/certs/saluna-origin.crt
install -m 0600 saluna-origin.key /opt/saluna/deploy/nginx/certs/saluna-origin.key
```

If Arvan is configured to use HTTP to the origin and the VPS 443 port will not be
used, the current Nginx template still needs cert files to start. A temporary
self-signed cert can satisfy Nginx, but the cleaner follow-up is to split the
gateway config into explicit HTTP-origin and HTTPS-origin modes.

## DNS And TLS

Point these records to the VPS origin IP or to ArvanCloud, depending on the
current cutover stage:

- `A saluna.ir`
- `A www.saluna.ir`
- `A app.saluna.ir`
- `A api.saluna.ir`

When ArvanCloud is active, keep the same hostnames and set the VPS public IP as
the origin. SSH should still target the VPS origin IP directly.

Production browser features need HTTPS at the public URL. Service workers and
PWA install flows require secure contexts, and production auth cookies should be
sent only over HTTPS.

## Environment Contract

Create the real env file from the template:

```bash
cp .env.production.example .env.production
```

Fill in at minimum:

| Variable                   | Required       | Notes                                                                                                                |
| -------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------- |
| `SALUNA_IMAGE_TAG`         | yes            | immutable tag; git SHA or dated release                                                                              |
| `DOCKER_PLATFORM`          | yes            | `linux/amd64` for the current VPS                                                                                    |
| `POSTGRES_PASSWORD`        | yes            | keep aligned with `DATABASE_URL` values                                                                              |
| `DATABASE_URL`             | yes            | runtime URL, usually `postgres:5432` inside Compose                                                                  |
| `DATABASE_URL_DIRECT`      | recommended    | migrations/seeds prefer this, can match `DATABASE_URL`                                                               |
| `JWT_SECRET`               | yes            | at least 32 random characters in production                                                                          |
| `BETTER_AUTH_SECRET`       | yes            | long random secret                                                                                                   |
| `BETTER_AUTH_URL`          | yes            | `https://api.saluna.ir`                                                                                              |
| `PWA_ORIGIN`               | yes            | `https://app.saluna.ir` for Better Auth trusted origin                                                               |
| `CORS_ORIGINS`             | yes            | include `https://app.saluna.ir` and public origins                                                                   |
| `SALUNA_IMAGE_REGISTRY`    | optional       | set to `127.0.0.1:5000/` for local registry flow, or `registry.hamdocker.ir/<namespace>/` for registry-first deploys |
| `VITE_*`, `PUBLIC_*`       | yes for builds | public origins baked into app images                                                                                 |
| VAPID/SMS/Telegram secrets | optional       | required only when enabling those providers                                                                          |

Generate long secrets with:

```bash
openssl rand -base64 32
```

Keep `.env.production` out of git. It is intentionally gitignored. If an agent
does not need to inspect secrets, it should read `.env.production.example`
instead.

The upload script copies `.env.production` by default. If the production env is
managed only on the VPS, use:

```bash
UPLOAD_ENV=0 ./scripts/upload-airgap-release.sh
```

## Build Release Images

Build on a connected machine with Docker. The VPS should not run `pnpm install`,
`apk add`, or `docker pull` from international registries during the tarball
workflow.

First deployment, or any time infra images change:

```bash
INCLUDE_INFRA=1 ./scripts/build-airgap-release.sh
```

If you also want to seed the optional VPS-local registry image:

```bash
INCLUDE_INFRA=1 INCLUDE_REGISTRY=1 ./scripts/build-airgap-release.sh
```

Normal app-only release:

```bash
./scripts/build-airgap-release.sh
```

The script writes:

- `deploy/releases/saluna-apps-${SALUNA_IMAGE_TAG}.tar.gz`
- `deploy/releases/saluna-apps-${SALUNA_IMAGE_TAG}.tar.gz.sha256`
- `deploy/releases/saluna-infra-postgres16-nginx127.tar.gz` when
  `INCLUDE_INFRA=1`
- `deploy/releases/saluna-infra-postgres16-nginx127.tar.gz.sha256` when
  `INCLUDE_INFRA=1`
- `deploy/releases/saluna-release-${SALUNA_IMAGE_TAG}.env`

Preflight before upload:

```bash
bash -n scripts/build-airgap-release.sh scripts/upload-airgap-release.sh \
  scripts/apply-airgap-release.sh scripts/push-airgap-registry.sh \
  scripts/build-push-registry-app.sh scripts/deploy-registry-app.sh
docker compose --env-file .env.production.example -f docker-compose.prod.yml config >/dev/null
ls -lh deploy/releases/*"${SALUNA_IMAGE_TAG}"*
```

## Transfer To The VPS

Upload app bundle, optional infra bundle, compose file, Nginx templates, apply
script, and env file:

```bash
VPS_HOST=YOUR_VPS_ORIGIN_IP UPLOAD_INFRA=1 ./scripts/upload-airgap-release.sh
```

After infra has already been loaded once:

```bash
VPS_HOST=YOUR_VPS_ORIGIN_IP ./scripts/upload-airgap-release.sh
```

Useful upload knobs:

| Variable       | Default       | Meaning                         |
| -------------- | ------------- | ------------------------------- |
| `SSH_USER`     | `deploy`      | remote SSH user                 |
| `SSH_KEY`      | empty         | optional SSH key path           |
| `REMOTE_DIR`   | `/opt/saluna` | remote app directory            |
| `UPLOAD_INFRA` | `0`           | copy infra tarball and checksum |
| `UPLOAD_ENV`   | `1`           | copy `.env.production`          |

If SSH transfer is blocked, copy the same files by any available channel and put
release bundles under `/opt/saluna/releases`.

## Apply On The VPS

Run all apply commands from `/opt/saluna`.

First deploy with infra bundle:

```bash
cd /opt/saluna
LOAD_INFRA=1 ./scripts/apply-airgap-release.sh
```

Normal app-only deploy:

```bash
cd /opt/saluna
./scripts/apply-airgap-release.sh
```

If starting the optional local registry during first deploy:

```bash
cd /opt/saluna
LOAD_INFRA=1 START_REGISTRY=1 ./scripts/apply-airgap-release.sh
```

The apply script:

- verifies bundle checksums when `.sha256` files are present
- loads infra images when `LOAD_INFRA=1`
- loads app images unless `USE_REGISTRY=1`
- starts Postgres and waits for readiness
- writes a pre-migration backup to `/opt/saluna/backups`
- runs checked-in Drizzle migrations through the bundled API migration command
- upserts global catalog presets by default
- starts the full stack
- smoke checks API, manager PWA, and public web through the gateway

Set `SEED_CATALOG_PRESETS=0` to skip the production-safe catalog preset seed.
Set `SKIP_BACKUP=1` only when a backup has already been taken another way.

## Smoke Checks

From the VPS:

```bash
curl -i -H 'Host: api.saluna.ir' http://127.0.0.1/health
curl -i -H 'Host: app.saluna.ir' http://127.0.0.1/healthz
curl -i -H 'Host: saluna.ir' http://127.0.0.1/
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

From outside the VPS, after DNS or ArvanCloud is routed:

```bash
curl -i https://api.saluna.ir/health
curl -i https://app.saluna.ir/healthz
curl -i https://saluna.ir/
```

Check logs:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 api
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 gateway
```

## Backups And Restore

The apply script takes a pre-migration backup unless `SKIP_BACKUP=1`.

Manual backup:

```bash
mkdir -p /opt/saluna/backups
docker exec saluna-postgres sh -c \
  'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  | gzip > /opt/saluna/backups/saluna-$(date +%Y%m%d-%H%M%S).sql.gz
```

Copy backups off the VPS whenever possible.

Restore should be deliberate because it overwrites production data. Example
shape:

```bash
gzip -dc /opt/saluna/backups/BACKUP_FILE.sql.gz | docker exec -i saluna-postgres sh -c \
  'psql -U "$POSTGRES_USER" "$POSTGRES_DB"'
```

## Updating

For the registry-first target workflow, update only the changed app's SemVer
version, push an image tagged `<version>-<short-sha>`, update that app's VPS
state variables, and restart only that service.

For the tarball fallback workflow:

1. Choose a new immutable `SALUNA_IMAGE_TAG`.
2. Build a new app bundle with `./scripts/build-airgap-release.sh`.
3. Upload with `VPS_HOST=YOUR_VPS_ORIGIN_IP ./scripts/upload-airgap-release.sh`.
4. Apply with `cd /opt/saluna && ./scripts/apply-airgap-release.sh`.
5. Run the smoke checks.

Keep at least one previous app image tag and its backup available.

Rollback is fast only when the database remains backward-compatible:

```bash
cd /opt/saluna
SALUNA_IMAGE_TAG=PREVIOUS_TAG SEED_CATALOG_PRESETS=0 SKIP_BACKUP=1 \
  ./scripts/apply-airgap-release.sh
```

If migrations are not backward-compatible, restore a database backup before or
as part of rollback.

## Optional VPS-Local Registry

The tarball workflow is simplest. Use the VPS-local registry only when repeated
image uploads are slow enough to justify the extra moving part.

One-time setup:

```bash
INCLUDE_INFRA=1 INCLUDE_REGISTRY=1 ./scripts/build-airgap-release.sh
VPS_HOST=YOUR_VPS_ORIGIN_IP UPLOAD_INFRA=1 ./scripts/upload-airgap-release.sh
ssh deploy@YOUR_VPS_ORIGIN_IP \
  'cd /opt/saluna && LOAD_INFRA=1 START_REGISTRY=1 ./scripts/apply-airgap-release.sh'
```

Later registry release:

```bash
./scripts/build-airgap-release.sh
VPS_HOST=YOUR_VPS_ORIGIN_IP ./scripts/push-airgap-registry.sh
ssh deploy@YOUR_VPS_ORIGIN_IP \
  'cd /opt/saluna && SALUNA_IMAGE_TAG=YOUR_TAG USE_REGISTRY=1 ./scripts/apply-airgap-release.sh'
```

When `USE_REGISTRY=1`, the apply script defaults
`SALUNA_IMAGE_REGISTRY` to `127.0.0.1:${REGISTRY_PORT:-5000}/`.

If Docker Desktop cannot push through a host-side SSH tunnel, first load images
with the tarball flow, then seed the VPS registry from the already-loaded VPS
images:

```bash
VPS_HOST=YOUR_VPS_ORIGIN_IP REMOTE_PUSH_LOADED=1 ./scripts/push-airgap-registry.sh
```

## Seed Catalog Presets

The apply script runs the production-safe seed by default. To run it manually on
the VPS:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm api \
  node apps/api/dist/seed-catalog-presets.cjs
```

From a connected machine, SSH to the VPS origin IP:

```bash
VPS_HOST=YOUR_VPS_ORIGIN_IP ./scripts/seed-vps-catalog-presets.sh
```

## If The VPS Has Partial Internet

Probe from the VPS before choosing online versus air-gapped deployment:

```bash
curl -I https://registry.npmjs.org
curl -I https://registry-1.docker.io
curl -I https://github.com
curl -I https://api.telegram.org
curl -I https://tapi.bale.ai
curl -I https://safir.bale.ai
```

If these fail or are too slow, use the tarball workflow above. Normal HamGit
builds already use HamDocker, hmirror npm, and Arvan apk as described in
[`DEPLOYMENTS.md`](./DEPLOYMENTS.md).

For messaging features, allow outbound HTTPS from the API service to
`api.telegram.org`, `tapi.bale.ai`, and `safir.bale.ai`. Bale bot webhooks also
require the public API URL to use HTTPS on port `443` or `88` before running:

```bash
pnpm --filter @repo/api cli:messaging-set-webhook -- --provider=bale
```

## Troubleshooting

| Symptom                                           | Likely cause                                                   | Fix                                                                                 |
| ------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `./scripts/pwaly-airgap-release.sh: No such file` | stale docs or command                                          | use `./scripts/apply-airgap-release.sh`                                             |
| `saluna-gateway` exits immediately                | missing origin cert files                                      | install `saluna-origin.crt` and `saluna-origin.key`, or change gateway to HTTP-only |
| external `pwa.saluna.ir` fails                    | wrong hostname                                                 | use `app.saluna.ir`                                                                 |
| API CORS/auth fails from manager app              | `PWA_ORIGIN` or `CORS_ORIGINS` missing `https://app.saluna.ir` | update env, restart API                                                             |
| PWA points at old API/app URL                     | `VITE_*` values were baked into old image                      | bump `SALUNA_IMAGE_TAG`, rebuild, redeploy                                          |
| `docker pull` times out on VPS                    | international registry blocked                                 | use infra tarball or HamDocker mirror                                               |
| rollback starts but data looks wrong              | migration was not backward-compatible                          | restore the matching predeploy backup                                               |

## Recommended Follow-Ups

- Done: change Compose from one shared `SALUNA_IMAGE_TAG` to per-app tag
  variables with backward-compatible fallback to `SALUNA_IMAGE_TAG`.
- Done: wire tarball build/deploy helpers to accept per-app image tags while
  preserving `SALUNA_IMAGE_TAG` fallback compatibility.
- Done: wire registry-first build/deploy scripts to read per-app SemVer from
  `apps/api/package.json`, `apps/web/package.json`, and `apps/pwa/package.json`.
- Done: add a registry-first deploy script that updates one app tag on the VPS, pulls
  only that service, runs API migrations only for `api`, and smoke-checks only
  the affected host.
- Done: add CI affected-app detection so `api`, `web`, and `pwa` can deploy
  independently.
- Split `PUBLIC_APP_URL` into explicit public web and manager app variables, then
  update the landing login/signup links.
- Add an HTTP-origin gateway mode so Arvan TLS termination does not require
  dummy local certs.
- Keep `upload-airgap-release.sh` as fallback; teach it to upload the release
  manifest only if agents need remote tarball metadata.
- Done: configure a non-root deploy user and SSH key for normal operations.
- Done: move normal releases to HamGit/Hamravesh CI with registry-first deploys.

## External Facts Checked

- Docker supports saving images to tar archives and loading them later:
  <https://docs.docker.com/reference/cli/docker/image/save/>
- Compose profiles are the intended way to start optional services such as the
  local registry profile:
  <https://docs.docker.com/compose/how-tos/profiles/>
- Local registry workflows require registry-qualified image names when pushing
  to a registry:
  <https://docs.docker.com/engine/reference/commandline/tag/>
- Service workers and PWA install behavior require secure contexts outside
  localhost:
  <https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API>
