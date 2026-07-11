# Public web cut-over

**Done:** `apps/web-astro` is now `apps/web` (`@repo/web`, Astro). The retired public Next.js app has been removed from the workspace.

## Dev

| App             | Package     | Port | Role                       |
| --------------- | ----------- | ---- | -------------------------- |
| Astro (current) | `@repo/web` | 3001 | Public marketing + booking |

```bash
pnpm dev:web              # Astro (default in `pnpm dev`)
pnpm dev:web-stack        # Astro + API
```

## Validation

```bash
pnpm --filter @repo/web build
pnpm --filter @repo/web start &
BASE_URL=http://127.0.0.1:3001 SLUG=<existing-slug> \
  REQUEST_TOKEN=<optional-token> \
  node scripts/smoke-web.mjs
```

Manual checklist:

- [ ] Landing `<title>`, `lang="fa"`, `dir="rtl"`
- [ ] Salon page: salon name in JSON-LD; `Cache-Control: public, s-maxage=300...`
- [ ] Booking island hydrates; availability loads (browser, no CSP errors)
- [ ] Request status page: `Cache-Control: private, no-store`
- [ ] `/og/<slug>.png` returns PNG
- [ ] `/sitemap-index.xml` and `/robots.txt` valid

Deploy details: `DEPLOY.md`.

## Follow-ups (separate tickets)

- nginx cache layer for `/salons/*`, `/og/*`, `/_astro/*` (see migration plan; config lives on VPS)
- `GET /api/v1/public/salons` for dynamic sitemap URLs if not yet in API
- Server Islands for non-SEO logged-in fragments only
- Background revalidate if `s-maxage=300` is too coarse
