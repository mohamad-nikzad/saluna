# Air-gapped VPS deployment

Use this runbook when both registry deployment paths are unavailable. Normal
production releases use the [deployment workflow](DEPLOYMENTS.md).

Build images on a connected machine, save checksummed tarballs, copy them to
`/opt/saluna/releases`, and load them on the VPS. The VPS needs Docker and the
Compose plugin already installed.

The scripts are [build](../scripts/build-airgap-release.sh),
[upload](../scripts/upload-airgap-release.sh), and
[apply](../scripts/apply-airgap-release.sh).

The tarball builder packages `api`, `web`, and `pwa`. Production Compose also
starts `admin`, so its configured image must already be loaded or reachable.
For local tarball images, clear registry prefixes in the VPS environment or
use image names matching its per-app registry settings.

Public `VITE_*` and `PUBLIC_*` origins are baked into builds. Set
`PUBLIC_APP_URL` for the public site and `PUBLIC_MANAGER_APP_URL` for manager
login and signup links. Rebuild images when these values change.

App versions and image tag rules are documented in
[deployment versioning](DEPLOYMENTS.md#versioning-and-tags).

## Production stack

| Host                         | Service                                   | Container  | Notes                                              |
| ---------------------------- | ----------------------------------------- | ---------- | -------------------------------------------------- |
| `saluna.ir`, `www.saluna.ir` | Astro public and appointment-request site | `web`      | `@repo/web`, port `3001`                           |
| `app.saluna.ir`              | Manager PWA                               | `pwa`      | `@repo/pwa`, Nginx static build                    |
| `api.saluna.ir`              | Hono API                                  | `api`      | bundled Node server, port `3002`                   |
| `admin.saluna.ir`            | Platform admin                            | `admin`    | image supplied separately from the tarball builder |
| internal only                | PostgreSQL                                | `postgres` | Postgres 16 named volume                           |
| `80`, `443`                  | Gateway                                   | `gateway`  | Nginx host router                                  |
| `127.0.0.1:5000`             | Optional local registry                   | `registry` | only with Compose profile `registry`               |

The app must be client-facing HTTPS in production. ArvanCloud TLS termination is
enough for browsers if public users access `https://...`; the origin may be HTTP
or HTTPS depending on Arvan settings. The current Compose/Nginx files still
require local certificate files because TLS blocks are present.

## Quick start

For the ParsPack VPS, the origin IP is documented in
[`DEPLOYMENTS.md`](./DEPLOYMENTS.md). Do not SSH to Arvan CDN IPs or
CDN-resolved hostnames.

Set these on the connected builder:

```bash
export VPS_HOST=YOUR_VPS_ORIGIN_IP
export SSH_USER=deploy
export SALUNA_IMAGE_TAG="$(git rev-parse --short=12 HEAD)"
export SALUNA_API_IMAGE_TAG="$SALUNA_IMAGE_TAG"
export SALUNA_WEB_IMAGE_TAG="$SALUNA_IMAGE_TAG"
export SALUNA_PWA_IMAGE_TAG="$SALUNA_IMAGE_TAG"
export VITE_PWA_ASSET_VERSION="$SALUNA_PWA_IMAGE_TAG"
export DOCKER_PLATFORM=linux/amd64
```

For a first tarball-only deploy:

```bash
INCLUDE_INFRA=1 ./scripts/build-airgap-release.sh
UPLOAD_INFRA=1 ./scripts/upload-airgap-release.sh
ssh "${SSH_USER}@${VPS_HOST}" \
  "cd /opt/saluna && SALUNA_IMAGE_TAG=${SALUNA_IMAGE_TAG} \
  SALUNA_API_IMAGE_TAG=${SALUNA_API_IMAGE_TAG} \
  SALUNA_WEB_IMAGE_TAG=${SALUNA_WEB_IMAGE_TAG} \
  SALUNA_PWA_IMAGE_TAG=${SALUNA_PWA_IMAGE_TAG} \
  LOAD_INFRA=1 ./scripts/apply-airgap-release.sh"
```

For later app-only deploys:

```bash
./scripts/build-airgap-release.sh
./scripts/upload-airgap-release.sh
ssh "${SSH_USER}@${VPS_HOST}" \
  "cd /opt/saluna && SALUNA_IMAGE_TAG=${SALUNA_IMAGE_TAG} \
  SALUNA_API_IMAGE_TAG=${SALUNA_API_IMAGE_TAG} \
  SALUNA_WEB_IMAGE_TAG=${SALUNA_WEB_IMAGE_TAG} \
  SALUNA_PWA_IMAGE_TAG=${SALUNA_PWA_IMAGE_TAG} \
  ./scripts/apply-airgap-release.sh"
```

The `deploy` user is the normal SSH user for production operations.

Set all three app tags explicitly for a new tarball release. Per-app tags in
`.env.production` take precedence over the shared fallback.

## One-time VPS preparation

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

## DNS and TLS

Point these records to the VPS origin IP or to ArvanCloud, depending on the
current cutover stage:

- `A saluna.ir`
- `A www.saluna.ir`
- `A app.saluna.ir`
- `A api.saluna.ir`
- `A admin.saluna.ir`

When ArvanCloud is active, keep the same hostnames and set the VPS public IP as
the origin. SSH should still target the VPS origin IP directly.

Production browser features need HTTPS at the public URL. Service workers and
PWA install flows require secure contexts, and production auth cookies should be
sent only over HTTPS.

## Environment

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
| `BETTER_AUTH_SECRET`       | yes            | long random secret                                                                                                   |
| `BETTER_AUTH_URL`          | yes            | `https://api.saluna.ir`                                                                                              |
| `PWA_ORIGIN`               | yes            | `https://app.saluna.ir` for Better Auth trusted origin                                                               |
| `CORS_ORIGINS`             | yes            | include manager, admin, and public origins                                                                           |
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

## Build release images

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

## Transfer to the VPS

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

## Apply on the VPS

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

## Smoke checks

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

## Backups and restore

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

For registry deployments, follow [the release procedure](DEPLOYMENTS.md#how-to-release).

For the tarball fallback workflow:

1. Choose a new immutable release tag and set all three app tags as shown above.
2. Build a new app bundle with `./scripts/build-airgap-release.sh`.
3. Upload with `VPS_HOST=YOUR_VPS_ORIGIN_IP ./scripts/upload-airgap-release.sh`.
4. Apply with `cd /opt/saluna && ./scripts/apply-airgap-release.sh`.
5. Run the smoke checks.

Keep at least one previous app image tag and its backup available.

Rollback is fast only when the database remains backward-compatible:

```bash
cd /opt/saluna
SALUNA_IMAGE_TAG=PREVIOUS_TAG \
  SALUNA_API_IMAGE_TAG=PREVIOUS_API_TAG \
  SALUNA_WEB_IMAGE_TAG=PREVIOUS_WEB_TAG \
  SALUNA_PWA_IMAGE_TAG=PREVIOUS_PWA_TAG \
  SEED_CATALOG_PRESETS=0 SKIP_BACKUP=1 \
  ./scripts/apply-airgap-release.sh
```

If migrations are not backward-compatible, restore a database backup before or
as part of rollback.

## Optional VPS registry

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

## Seed catalog presets

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

## Outbound connectivity

Probe from the VPS before choosing online versus air-gapped deployment:

```bash
curl -I https://registry.npmjs.org
curl -I https://registry-1.docker.io
curl -I https://github.com
curl -I https://api.telegram.org
curl -I https://tapi.bale.ai
curl -I https://safir.bale.ai
```

If these fail or are too slow, use the tarball workflow above. HamGit fallback
builds use HamDocker, hmirror npm, and Arvan apk as described in
[`DEPLOYMENTS.md`](./DEPLOYMENTS.md).

For messaging features, allow outbound HTTPS from the API service to
`api.telegram.org`, `tapi.bale.ai`, and `safir.bale.ai`. Bale bot webhooks also
require the public API URL to use HTTPS on port `443` or `88` before running:

```bash
pnpm --filter @repo/api cli:messaging-set-webhook -- --provider=bale
```

## Troubleshooting

| Symptom                              | Likely cause                                                   | Fix                                                                                 |
| ------------------------------------ | -------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `saluna-gateway` exits immediately   | missing origin cert files                                      | install `saluna-origin.crt` and `saluna-origin.key`, or change gateway to HTTP-only |
| external `pwa.saluna.ir` fails       | wrong hostname                                                 | use `app.saluna.ir`                                                                 |
| API CORS/auth fails from manager app | `PWA_ORIGIN` or `CORS_ORIGINS` missing `https://app.saluna.ir` | update env, restart API                                                             |
| PWA points at old API/app URL        | `VITE_*` values were baked into old image                      | bump `SALUNA_IMAGE_TAG`, rebuild, redeploy                                          |
| `docker pull` times out on VPS       | international registry blocked                                 | use infra tarball or HamDocker mirror                                               |
| rollback starts but data looks wrong | migration was not backward-compatible                          | restore the matching predeploy backup                                               |
