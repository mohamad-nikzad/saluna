# VPS Deployment (ParsPack / limited-internet Iran servers)

This workflow deploys Saluna to one VPS even if the VPS has no useful outbound
internet. Build images on a connected machine, copy sealed tarballs to the VPS,
load them there, and run Docker Compose.

`retired public Next app` and `retired manager app` are deprecated and are not deployed here.

## Production stack

| Host | Service | Container | Notes |
| --- | --- | --- | --- |
| `saluna.ir`, `www.saluna.ir` | Astro public/booking site | `web` | `@repo/web`, port 3001 |
| `app.saluna.ir` | Manager PWA | `pwa` | `@repo/pwa`, Vite static build |
| `api.saluna.ir` | Hono API | `api` | bundled Node server, port 3002 |
| internal only | PostgreSQL | `postgres` | Postgres 16 volume |
| port 80 | Gateway | `gateway` | Nginx host router |

The Compose file exposes only HTTP on the VPS. For production PWA installs and
secure auth cookies, put this behind ArvanCloud or another TLS terminator, or
add a VPS-side TLS config before going live.

## One-time VPS prep

The VPS needs:

- Docker Engine
- Docker Compose plugin
- SSH access
- `/opt/saluna` directory owned by the deploy user

If the VPS has no internet, install Docker from an offline package bundle or ask
ParsPack for an image that already includes Docker. Everything after Docker is
installed can be done with copied tarballs.

## DNS

Point these records to the VPS public IP:

- `A saluna.ir`
- `A www.saluna.ir`
- `A app.saluna.ir`
- `A api.saluna.ir`

When ArvanCloud is added later, keep the same hostnames and set the VPS as the
origin.

## Production env

Create the real env file from the template:

```bash
cp .env.production.example .env.production
```

Fill in at minimum:

- `SALUNA_IMAGE_TAG`
- `DOCKER_PLATFORM` (`linux/amd64` for the current VPS)
- `SALUNA_IMAGE_REGISTRY` only when using the optional VPS-local registry
- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `DATABASE_URL_DIRECT`
- `JWT_SECRET`
- `BETTER_AUTH_SECRET`
- Optional provider secrets for VAPID, SMS, and Telegram

Generate the long auth secrets with:

```bash
openssl rand -base64 32
```

Keep `.env.production` out of git. The file is intentionally gitignored.

## Build release images on a connected machine

The VPS should not build the app. Build sealed Docker bundles on a machine that
has internet and Docker.

For the first deployment, or whenever infra image versions change, include the
infra bundle:

```bash
INCLUDE_INFRA=1 INCLUDE_REGISTRY=1 ./scripts/build-airgap-release.sh
```

For normal app-only releases:

```bash
./scripts/build-airgap-release.sh
```

The script writes:

- `deploy/releases/saluna-apps-${SALUNA_IMAGE_TAG}.tar.gz`
- `deploy/releases/saluna-infra-postgres16-nginx127.tar.gz` when
  `INCLUDE_INFRA=1`
- `.sha256` checksum files
- `deploy/releases/saluna-release-${SALUNA_IMAGE_TAG}.env`

## Transfer to the VPS

```bash
VPS_HOST=YOUR_VPS_ORIGIN_IP UPLOAD_INFRA=1 ./scripts/upload-airgap-release.sh
```

After the infra bundle has been loaded once, use the same command without
`UPLOAD_INFRA=1`.

If SSH transfer is blocked, copy the same files by any available channel and
place them under `/opt/saluna`, with release bundles in `/opt/saluna/releases`.

## Load, migrate, and run on the VPS

```bash
cd /opt/saluna
LOAD_INFRA=1 START_REGISTRY=1 ./scripts/pwaly-airgap-release.sh
```

After infra has been loaded once:

```bash
cd /opt/saluna
./scripts/pwaly-airgap-release.sh
```

The apply script:

- verifies bundle checksums
- loads app images unless `USE_REGISTRY=1`
- starts Postgres
- writes a pre-migration backup to `/opt/saluna/backups`
- runs checked-in Drizzle migrations through the bundled API migration command
- upserts global catalog presets by default
- starts the stack
- smoke checks `api`, `app`, and public web routes through nginx

Set `SEED_CATALOG_PRESETS=0` to skip the production-safe catalog preset seed.
Set `SKIP_BACKUP=1` only when you have taken a backup another way.

### Optional VPS-local registry

The tarball workflow is simplest. For faster later releases, keep a local Docker
registry on the VPS and push app image layers through an SSH tunnel.

One-time setup:

1. Build the infra bundle with `INCLUDE_REGISTRY=1`.
2. Upload it with `UPLOAD_INFRA=1`.
3. Apply once with `LOAD_INFRA=1 START_REGISTRY=1`.

For future releases:

```bash
./scripts/build-airgap-release.sh
VPS_HOST=YOUR_VPS_ORIGIN_IP ./scripts/push-airgap-registry.sh
ssh deploy@YOUR_VPS_ORIGIN_IP \
  'cd /opt/saluna && SALUNA_IMAGE_TAG=YOUR_TAG USE_REGISTRY=1 ./scripts/pwaly-airgap-release.sh'
```

When using the registry workflow, Compose pulls from
`127.0.0.1:${REGISTRY_PORT:-5000}` on the VPS. You can also set
`SALUNA_IMAGE_REGISTRY=127.0.0.1:5000/` in `.env.production`.

If Docker Desktop cannot push through a host-side SSH tunnel, first load the
images with the tarball flow, then seed the VPS registry from the loaded images:

```bash
VPS_HOST=YOUR_VPS_ORIGIN_IP REMOTE_PUSH_LOADED=1 ./scripts/push-airgap-registry.sh
```

### Seed catalog presets (قالب خدمات)

The apply script runs the production-safe seed by default. To run it manually:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm api \
  node apps/api/dist/seed-catalog-presets.cjs
```

From your laptop (SSH to the **VPS origin IP**, not the Arvan CDN address):

```bash
VPS_HOST=YOUR_VPS_ORIGIN_IP ./scripts/seed-vps-catalog-presets.sh
```

Check containers:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 api
```

## Smoke checks

From the VPS:

```bash
curl -i -H 'Host: api.saluna.ir' http://127.0.0.1/health
curl -i -H 'Host: app.saluna.ir' http://127.0.0.1/healthz
curl -i -H 'Host: saluna.ir' http://127.0.0.1/
```

From outside the VPS, after DNS or ArvanCloud is routed:

```bash
curl -i https://api.saluna.ir/health
curl -i https://pwa.saluna.ir/healthz
curl -i https://saluna.ir/
```

## Backups

Create a backup directory on the VPS:

```bash
mkdir -p /opt/saluna/backups
```

Run a Postgres dump:

```bash
docker exec saluna-postgres sh -c \
  'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  | gzip > /opt/saluna/backups/saluna-$(date +%Y%m%d-%H%M%S).sql.gz
```

Copy backups off the VPS whenever possible.

## Updating

For a new release:

1. Set `SALUNA_IMAGE_TAG` to a new immutable value, preferably the git SHA or a
   dated version.
2. Run `./scripts/build-airgap-release.sh`.
3. Run `VPS_HOST=YOUR_VPS_ORIGIN_IP ./scripts/upload-airgap-release.sh`.
4. SSH to the VPS and run `cd /opt/saluna && ./scripts/pwaly-airgap-release.sh`.

Keep at least one previous image tag loaded so rollback is just changing
`SALUNA_IMAGE_TAG` back and running Compose again.

## If the VPS has partial internet

After receiving credentials, probe from the VPS before choosing online vs
air-gapped deployment:

```bash
curl -I https://registry.npmjs.org
curl -I https://registry-1.docker.io
curl -I https://github.com
curl -I https://api.telegram.org
```

If these fail or are too slow, use the tarball workflow above.
