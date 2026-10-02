# Deploy the public web app

`@repo/web` uses the Astro Node standalone adapter. It requires Node
`>=22.12.0` and listens on port 3001.

Production releases use the [repo deployment workflow](../../docs/DEPLOYMENTS.md).
For a VPS without registry access, use the
[tarball runbook](../../docs/VPS_AIRGAPPED_DEPLOYMENT.md).

## Environment

| Variable                 | Purpose                                                                |
| ------------------------ | ---------------------------------------------------------------------- |
| `PUBLIC_APP_URL`         | Public site origin for canonical URLs, sitemaps, and Open Graph images |
| `PUBLIC_API_URL`         | Hono API origin for public data and booking requests                   |
| `PUBLIC_MANAGER_APP_URL` | Manager app origin for login and signup links                          |
| `HOST`                   | Listen address, normally `0.0.0.0`                                     |
| `PORT`                   | Listen port, normally `3001`                                           |

Set the public origins before building. [with-root-env.mjs](../../scripts/with-root-env.mjs)
loads repo env files and maps the corresponding `NEXT_PUBLIC_*` variables when
the Astro variables are unset.

## Build and run with Node

From the repo root:

```bash
pnpm --filter @repo/web build
pnpm --filter @repo/web start
```

The build writes static assets to `apps/web/dist/client/` and the server to
`apps/web/dist/server/entry.mjs`.

For a process manager, load the environment and run the entry file from
`apps/web`. A [PM2 config](ecosystem.config.cjs) is included:

```bash
cd apps/web
pm2 start ecosystem.config.cjs
pm2 save
```

## Docker

Build from the repo root:

```bash
docker build -f apps/web/Dockerfile \
  --build-arg PUBLIC_APP_URL=https://saluna.ir \
  --build-arg PUBLIC_API_URL=https://api.saluna.ir \
  --build-arg PUBLIC_MANAGER_APP_URL=https://app.saluna.ir \
  -t saluna-web:YOUR_TAG .
```

The production [Nginx template](../../deploy/nginx/templates/saluna.conf.template)
routes the public host to the web container.

## Fonts

Fonts are local under `src/assets/fonts/`. To refresh them on a connected
machine, run:

```bash
pnpm fonts:web
```

## Validation

With the API and web running:

```bash
BASE_URL=http://127.0.0.1:3001 SLUG=your-slug pnpm smoke:web
```

Set `REQUEST_TOKEN` to include a real AppointmentRequest status page in the
smoke check. Check booking interaction in a browser, including availability
loading and submitting a request.

Public pages should have Persian RTL metadata, canonical URLs, and Salon
structured data. Request status pages must remain private and absent from
search indexes.
