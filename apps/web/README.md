# Saluna public web

`@repo/web` serves the Persian marketing site, public Salon pages, and customer
AppointmentRequests. It uses Astro with React booking components and the Node
standalone adapter.

## Development

Run commands from the repo root. Configure `.env.local` as described in the
[root README](../../README.md).

```bash
pnpm dev:web
pnpm --filter @repo/web build
pnpm --filter @repo/web start
pnpm --filter @repo/web test
pnpm --filter @repo/web typecheck
```

`pnpm dev:web` starts web on port 3001 and the API on port 3002.

## Code layout

- `src/pages/` defines public pages, Salon pages, request status, sitemaps, and
  Open Graph images.
- `src/components/landing/prototype/` contains the current landing page.
- `src/components/react/` contains interactive public booking components.
- `src/lib/public-api.ts` loads public Salon data through the generated API SDK.
- `src/assets/fonts/` contains local fonts.
- `public/` contains static images and icons.

## Environment and deployment

`PUBLIC_APP_URL` is the public site origin. `PUBLIC_API_URL` is the API origin.
`PUBLIC_MANAGER_APP_URL` is the manager app origin for login and signup links.
These values are used during the build.

See [web deployment](DEPLOY.md) for local Node startup and validation, and
[production deployments](../../docs/DEPLOYMENTS.md) for the VPS release process.
