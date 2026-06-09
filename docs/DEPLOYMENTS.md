# Saluna deployments

Last updated: **2026-06-07**

This is the current production deployment model for Saluna. The normal path is
registry-first CI/CD through HamGit/Hamravesh-style GitLab CI jobs. The old
tarball release path remains as a bootstrap and disaster-recovery fallback only.

## Production Shape

Production runs on the ParsPack VPS at the origin IP `195.177.255.24`, behind
Arvan for public HTTP(S).

Do not SSH to `saluna.ir`, `app.saluna.ir`, or `api.saluna.ir`; those names may
resolve to Arvan CDN IPs. SSH to the origin IP as `deploy`.

| Public host | Compose service | Container | App |
| --- | --- | --- | --- |
| `api.saluna.ir` | `api` | `saluna-api` | Hono API on port `3002` |
| `saluna.ir` | `web` | `saluna-web` | Astro public site on port `3001` |
| `app.saluna.ir` | `pwa` | `saluna-pwa` | Manager PWA served by Nginx |
| all public hosts | `gateway` | `saluna-gateway` | Nginx host router |
| internal only | `postgres` | `saluna-postgres` | Postgres 16 |

The VPS directory is `/opt/saluna`, owned by `deploy`. The active Compose file
is `/opt/saluna/docker-compose.prod.yml`, matching
[`docker-compose.prod.yml`](../docker-compose.prod.yml).

## Current Normal Flow

```text
push to HamGit main
  -> GitLab CI detects changed paths
  -> CI builds only the affected app image with Kaniko
  -> CI pushes the image to registry.hamdocker.ir
  -> operator starts the matching manual deploy job
  -> CI SSHs to deploy@195.177.255.24
  -> CI refreshes compose, Nginx template, and the deploy script on the VPS
  -> VPS pulls only that app image
  -> VPS restarts only that app service and waits for Docker health
  -> VPS ensures gateway is running and healthy
  -> VPS smoke-checks the affected public host
  -> VPS records the deployed tag in .env.production
```

Deploy jobs are intentionally manual. The build jobs are automatic on `main`
when their `rules:changes` match.

## CI Jobs

The CI file is [`.gitlab-ci.yml`](../.gitlab-ci.yml).

If HamGit shared runner minutes are exhausted, Saluna can temporarily use the
locked-down VPS runner documented in
[`docs/SELF_HOSTED_GITLAB_RUNNER.md`](SELF_HOSTED_GITLAB_RUNNER.md). Keep that
runner tagged, protected, unprivileged, and limited to one job at a time.

Build jobs:

| Job | Builds | Image tag |
| --- | --- | --- |
| `build-api` | `saluna-api` | `apps/api/package.json` version + `CI_COMMIT_SHORT_SHA` |
| `build-web` | `saluna-web` | `apps/web/package.json` version + `CI_COMMIT_SHORT_SHA` |
| `build-pwa` | `saluna-pwa` | `apps/pwa/package.json` version + `CI_COMMIT_SHORT_SHA` |

Deploy jobs:

| Job | Runs on VPS | Extra behavior |
| --- | --- | --- |
| `deploy-api` | `./scripts/deploy-registry-app.sh api "$IMAGE_TAG"` | backup, migrations, catalog preset seed, `/health` smoke check |
| `deploy-web` | `./scripts/deploy-registry-app.sh web "$IMAGE_TAG"` | public `/` smoke check |
| `deploy-pwa` | `./scripts/deploy-registry-app.sh pwa "$IMAGE_TAG"` | manager `/healthz` smoke check |

Builds use mirrored infrastructure so the pipeline does not depend on blocked
international endpoints:

```env
SALUNA_NODE_IMAGE=hub.hamdocker.ir/library/node:22.12.0-alpine
SALUNA_NGINX_IMAGE=hub.hamdocker.ir/library/nginx:1.27-alpine
SALUNA_ALPINE_MIRROR=https://mirror.arvancloud.ir/alpine
SALUNA_NPM_REGISTRY=https://repo.hmirror.ir/npm/
SALUNA_PNPM_VERSION=9.15.9
```

Kaniko runs from `gcr.hamdocker.ir/kaniko-project/executor:v1.23.2-debug` and
pushes app images to `SALUNA_IMAGE_REGISTRY`.

## Required CI Variables

These are protected HamGit variables:

| Variable | Purpose |
| --- | --- |
| `SALUNA_IMAGE_REGISTRY` | Registry prefix, ending in the namespace path, for example `registry.hamdocker.ir/<namespace>/` |
| `HAMDOCKER_USERNAME` | Registry username |
| `HAMDOCKER_PASSWORD` | Registry password or token |
| `VPS_HOST` | `195.177.255.24` |
| `VPS_SSH_USER` | `deploy` |
| `VPS_SSH_PRIVATE_KEY` | Private key for the `deploy` user |

The deploy user also has Docker auth for `registry.hamdocker.ir` on the VPS, and
`/opt/saluna/.env.production` sets the same `SALUNA_IMAGE_REGISTRY` namespace.

## Versioning And Tags

Each deployable app owns its version:

| App | Version source | Current baseline |
| --- | --- | ---: |
| API | `apps/api/package.json` | `0.8.0` |
| Public web | `apps/web/package.json` | `0.4.0` |
| Manager PWA | `apps/pwa/package.json` | `0.8.0` |

Image tags are:

```text
<app-version>-<short-git-sha>
```

Examples:

```text
registry.hamdocker.ir/<namespace>/saluna-api:0.7.1-e6fa2b7
registry.hamdocker.ir/<namespace>/saluna-web:0.4.1-e6fa2b7
registry.hamdocker.ir/<namespace>/saluna-pwa:0.7.1-e6fa2b7
```

Use a patch bump for fixes and operational changes without intended product
behavior changes. Use a minor bump for new user-visible behavior or breaking
pre-`1.0.0` changes.

The Docker images also get OCI labels for app version, git revision, and source.

## Affected App Rules

CI currently maps changed paths to app builds like this:

| Changed path | Build/deploy |
| --- | --- |
| `apps/api/**` | API |
| `apps/web/**` | Web |
| `apps/pwa/**` | PWA |
| `packages/auth/**`, `packages/notifications/**` | API |
| `packages/database/**` | API and PWA |
| `packages/api-client/**`, `packages/ui/**`, `packages/brand-tokens/**` | PWA |
| `packages/brand/**`, `packages/salon-core/**` | API, web, and PWA |
| `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` | API, web, and PWA |
| `.gitlab-ci.yml`, `docker-compose.prod.yml`, deploy scripts | affected operational job or all apps when needed |

If a change crosses boundaries, deploy every app that consumed the changed
package. For uncertain shared code changes, deploy all three apps.

## How To Release

1. Decide which app or apps changed.
2. Bump only the changed app package version when the change should produce a
   new app release.
3. Push to HamGit `main`.
4. Wait for the matching `build-*` job to push the image.
5. Start the matching manual `deploy-*` job.
6. Confirm the job's smoke check passed.
7. Confirm public endpoints from outside the VPS when the change is user-facing.

Smoke checks:

```bash
curl -i https://api.saluna.ir/health
curl -i https://saluna.ir/
curl -i https://app.saluna.ir/healthz
```

## What The VPS Deploy Script Does

The current deploy script is
[`scripts/deploy-registry-app.sh`](../scripts/deploy-registry-app.sh). It is run
on the VPS from `/opt/saluna`.

For every app deploy it:

- loads `/opt/saluna/.env.production`
- requires `SALUNA_IMAGE_REGISTRY`
- exports only the selected app tag
- runs `docker compose pull <app>`
- restarts only the selected app with `docker compose up -d --no-deps <app>`
- waits for the selected app's Docker healthcheck to pass
- ensures `gateway` is running and healthy
- smoke-checks the affected host through the gateway, with short retries
- writes the selected app tag back to `.env.production` after the smoke check

For API deploys only, before restarting `api`, it also:

- starts and waits for Postgres
- writes a pre-migration backup under `/opt/saluna/backups`
- runs `node apps/api/dist/migrate.cjs`
- runs `node apps/api/dist/seed-catalog-presets.cjs` unless
  `SEED_CATALOG_PRESETS=0`

Use `SKIP_BACKUP=1` only when a backup was already taken another way.

## VPS Deployment State

Production state lives in `/opt/saluna/.env.production`.

Per-app registry deployments write:

```env
SALUNA_API_VERSION=0.7.0
SALUNA_API_IMAGE_TAG=0.7.0-e6fa2b7
SALUNA_WEB_VERSION=0.4.0
SALUNA_WEB_IMAGE_TAG=0.4.0-e6fa2b7
SALUNA_PWA_VERSION=0.7.0
SALUNA_PWA_IMAGE_TAG=0.7.0-e6fa2b7
```

`docker-compose.prod.yml` still supports the legacy shared `SALUNA_IMAGE_TAG`
fallback. That fallback exists so older tarball releases keep working; new
registry deploys should use the per-app `SALUNA_*_IMAGE_TAG` values.

## Rollback

Rollback is normally a redeploy of the previous image tag:

```bash
cd /opt/saluna
SALUNA_WEB_VERSION=0.4.0 ./scripts/deploy-registry-app.sh web 0.4.0-previous
```

Use the matching app name and previous tag.

API rollback is only simple when migrations are backward-compatible. If an API
deploy included a non-backward-compatible migration, restore the matching
pre-deploy database backup before or during rollback.

## Manual Operator Checks

Check running containers:

```bash
ssh deploy@195.177.255.24 'cd /opt/saluna && docker compose --env-file .env.production -f docker-compose.prod.yml ps'
```

Check the active app tags without printing secrets:

```bash
ssh deploy@195.177.255.24 \
  'cd /opt/saluna && grep -E "^SALUNA_(API|WEB|PWA)_(VERSION|IMAGE_TAG)=" .env.production'
```

Check logs:

```bash
ssh deploy@195.177.255.24 \
  'cd /opt/saluna && docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 api'
```

## Tarball Fallback

The air-gapped tarball workflow remains documented in
[`VPS_AIRGAPPED_DEPLOYMENT.md`](./VPS_AIRGAPPED_DEPLOYMENT.md). Use it only
when registry access, HamGit CI, or deploy SSH is unavailable.

The fallback shape is:

```text
connected builder builds all app images
  -> builder saves checksummed tarballs
  -> tarballs are copied to /opt/saluna/releases
  -> VPS loads images
  -> VPS runs docker compose up
```

Normal releases should not create or keep large `deploy/releases/*.tar.gz`
bundles on a developer machine.
