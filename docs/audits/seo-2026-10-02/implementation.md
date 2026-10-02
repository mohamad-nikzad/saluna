# SEO implementation and remaining work

Implemented in the working tree on 2 October 2026. These changes have not been deployed. The [original audit](./README.md) and its production snapshots remain the before-state evidence.

## Changes

| Audit finding                 | Implementation                                                                                                                                                                                                                         | Verification                                                                                                                                           |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Focused product content       | Added `/features/online-appointment-requests`, `/features/salon-clients`, and `/features/staff-commission` with workflow steps, examples, limits, screenshots with sample-data captions, FAQs, breadcrumbs, and signup/contact actions | Built pages return 200, have unique titles and one H1, are indexable, and appear at their canonical URLs in the sitemap                                |
| Homepage discovery            | Added the existing public footer, feature links in relevant homepage sections, links between product pages, and expanded `/services` with current catalog terms                                                                        | Smoke check follows the eight public page paths and verifies homepage links and sitemap entries                                                        |
| Broken homepage sharing image | Replaced the runtime endpoint with a checked-in 1200×630 PNG. `pnpm og:web` regenerates it with the bundled font and Pango Persian shaping                                                                                             | Built server returns a valid PNG; image inspected for readable Persian, direction, clipping and spacing                                                |
| Search icon                   | Declared the existing square 180×180 icon as the primary favicon                                                                                                                                                                       | Built homepage declares it and its URL returns a valid PNG. Google's eventual search display remains unverified                                        |
| Currency mismatch             | Converted stored/displayed tomans to rials only at the IRR schema boundary                                                                                                                                                             | Regression check proves 550,000 tomans produces 5,500,000 IRR and leaves the source value unchanged                                                    |
| Oversized header mark         | Added an 88×88 WebP used by homepage, public header and footer                                                                                                                                                                         | 4,502 bytes instead of 648,352 bytes, a 99.3% reduction; explicit dimensions retained; the tall mark is fitted inside the square with transparent padding to preserve the entire image                                                                  |
| URL variants                  | Configured Astro `trailingSlash: 'never'` with directory output, matching existing links/canonicals. Added HTTP/HTTPS www-to-apex 308 blocks in the Nginx template                                                                     | Built Node server redirects all eight public slash variants to their canonical paths while preserving queries. Nginx runtime validation is outstanding |
| FAQ drift                     | Moved the visible homepage questions and answers into the shared dataset used by the homepage schema                                                                                                                                   | Smoke check compares every schema question and answer with the readable HTML                                                                           |
| Duplicate Salon HTML          | Removed the hidden `SalonShell`; both server-rendered React layouts display the name, location, service descriptions and prices once. Added a visible Saluna attribution                                                               | Regression checks cover both layouts with intake enabled and disabled, including one H1 and one occurrence of the service                              |
| Loading priorities            | Used one responsive hero picture; kept the calendar capture eager, made offscreen captures/CTA image lazy, and restricted font preloads to Vazirmatn 400/700 plus Lalezar                                                              | Browser inspection confirms mobile hero selection, three font preloads, correct image loading attributes and no horizontal overflow                    |
| Disabled-intake copy          | Fallback Salon metadata describes contact information when AppointmentRequest intake is disabled                                                                                                                                       | Regression check verifies the description does not advertise online requests                                                                           |
| Confirmed test Salons | Shared indexing policy excludes `salon-a027zt`, `salon-vubbcn` and `salon-gzwp7u`, confirmed by the owner, from the runtime sitemap and emits noindex on their public pages | Built-server HTTP checks with an isolated fixture API verify all six audited slugs. Test pages remain accessible; the three real Salons remain indexable, including one with intake disabled |

The new pages explain current workflows without introducing accounting, automatic booking, fabricated ratings, a pricing offer, or a second editorial publishing system. Client imagery shows only the top of the existing demo screenshot, excluding the test contact rows. The commission page labels its existing screenshot as the financial dashboard, rather than claiming it shows the detailed commission report.

## Re-run checks

Final local checks passed: 22 tests across three files, web and script lint, web type checking with no diagnostics, production build, and the expanded built-server smoke check. Mobile checks used a 390px viewport and the desktop check used 1280px; inspected pages had no horizontal overflow. The default browser viewport was restored afterward.

```powershell
pnpm --filter @repo/web test
pnpm --filter @repo/web lint
pnpm --filter @repo/web typecheck
pnpm --filter @repo/web build

# In another terminal, run the built server with the local API available.
$env:HOST = '127.0.0.1'
$env:PORT = '4322'
node apps/web/dist/server/entry.mjs

# In the checking terminal:
$env:BASE_URL = 'http://127.0.0.1:4322'
node scripts/smoke-web.mjs
```

The smoke check is read-only unless its existing optional manager credentials are supplied. With `SLUG` set to a published local Salon, it also checks the public Salon and its sharing image. The current local API returned an empty published-Salon list. To verify indexing exclusions through actual routes, an isolated fixture API supplied all six audited slugs to a separate production build. All six pages returned 200 with one H1; only the three confirmed test pages emitted noindex and were absent from the runtime sitemap. Both layouts and a real Salon with intake disabled were covered. Local proof scripts and results are in the ignored `output/seo/` folder; no operational data changed. Both public React layouts and currency metadata were also exercised directly through regression tests.

Directory output is intentional. Although Astro exposes [build-format and trailing-slash options](https://docs.astro.build/en/reference/configuration-reference/#trailingslash), the installed Node adapter did not resolve extensionless prerendered routes from file output. Actual HTTP requests caught the 404s; directory output passed the same checks.

No production Core Web Vitals improvement is claimed. Local browser checks cover layout and asset selection; compare mobile field data after deployment.

## Deployment and owner follow-up

1. Build and deploy the web image and Nginx template. Run `nginx -t` on the deployment host before reload. Nginx is unavailable locally; DNS failures prevented downloading a temporary test binary.
2. Verify `https://www.saluna.ir/about/?campaign=seo` redirects to the apex, preserving its path and query, then resolves to `https://saluna.ir/about?campaign=seo`. Test the HTTP variant too. The www block preserves the original request URI; Astro handles the slash redirect.
3. Re-run the production audit into a separate snapshot so the saved before-state evidence is retained. Check OG, icon, sitemap, visible Salon HTML and a known toman price against deployed JSON-LD.
4. Submit/inspect the sitemap and important URLs in Search Console after publication. Confirm Google's chosen canonicals and request recrawls after these material changes. Favicon appearance and search rankings need later observation.
5. Deploy the confirmed test Salon exclusions from [BL-0089](../../../backlog/done/BL-0089-classify-internal-salons-for-search.md), refresh cached Salon HTML and the runtime sitemap, and inspect their noindex metadata in Search Console. The owner confirmed `salon-a027zt`, `salon-vubbcn` and `salon-gzwp7u`; public links remain available. No other Salon is excluded based on its name, sparse details, or Unlimited Access.
6. Keep Blog Articles and Product Guides in the agreed EmDash work, [BL-0087](../../../backlog/inbox/BL-0087-publish-blog-and-product-guides-with-emdash.md). The new feature pages link to their own workflow sections and working contact pages; they do not link to unshipped guide URLs.
7. Add reviewed product demonstrations, consented case studies, editorial mentions and regional uptime checks when the needed access/content exists. Measure branded versus non-brand impressions and signup outcomes after deployment.

## Header correction

The first compressed mark used the default square cover resize, which cropped the original 1024×1335 logo. Regenerated it with `fit: contain` and transparent padding as `saluna-mark-88.webp`, and updated the homepage, public header, footer and smoke check. The new filename avoids reuse of the cropped cached asset. Verified the full mark in the rendered desktop and mobile headers.
