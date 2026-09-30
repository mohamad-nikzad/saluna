# Public content CMS findings

Decision date: 2026-09-29. [ADR-0040](../adr/0040-emdash-for-public-content.md) selects EmDash; [BL-0087](../../backlog/inbox/BL-0087-publish-blog-and-product-guides-with-emdash.md) tracks implementation. This note records the facts and checks that matter when work starts. Recheck upstream versions, pricing, and translation coverage then.

## Saluna's current shape

- `saluna.ir` is `apps/web`, an Astro 6 server application using the Node standalone adapter. The site already has Persian RTL layouts, metadata and JSON-LD rendering, a generated sitemap, `robots.txt`, and a separate runtime sitemap for public Salon pages.
- `app.saluna.ir` is the manager PWA; `api.saluna.ir` is the API. Nginx routes these hosts separately. The web container currently has no database connection or persistent media volume. Postgres 16 already runs as a separate Compose service for product data.
- The web Dockerfile defaults to Node 22.12.0. The [EmDash existing-project guide](https://docs.emdashcms.com/existing-project/) currently requires Node 22.16 or newer and Astro 6 or newer. Confirm the requirement for the selected EmDash release before changing the image.
- Production image deployments are manual after CI builds. The release path includes fallbacks for interrupted international connectivity. See [Saluna deployments](../DEPLOYMENTS.md), [web configuration](../../apps/web/astro.config.mjs), [Compose](../../docker-compose.prod.yml), and [web Dockerfile](../../apps/web/Dockerfile).

## Why EmDash fits now

EmDash runs inside Astro and supports Node.js with PostgreSQL plus local or S3-compatible media storage. A nontechnical editor can draft and publish without a Saluna deployment; server-rendered public pages can read the published revision on the next request. It provides media management, revisions, preview, scheduled publishing, contributor/author/editor roles, SEO fields, and collection sitemaps. Use `saluna.ir/blog/` for Blog Articles and `saluna.ir/guides/` for Product Guides. Keep the manager app separate and link from relevant product screens to public guides. See [EmDash architecture](https://docs.emdashcms.com/why-emdash/), [database adapters](https://docs.emdashcms.com/deployment/database/), [roles](https://docs.emdashcms.com/guides/authentication/), and [querying content and SEO](https://docs.emdashcms.com/guides/querying-content/).

EmDash 1.0 was [released on 2026-09-28](https://blog.cloudflare.com/emdash-cms-plugin-registry/). Its relative newness makes a staging upgrade and recovery rehearsal important. Installing it in `apps/web` also makes the editor and public site share a process: a CMS database or integration failure can affect content routes. Keep a separate CMS database or schema and database role, and extend the health/smoke checks beyond the existing `/` check.

## Why Sanity was not selected

Sanity has a mature structured content service, visual editing, and an [official Astro integration](https://www.sanity.io/docs/astro). It is the stronger option if multiple independent sites or apps must query the same content. It also keeps CMS database operations off the Saluna VPS. Its Studio and content API remain hosted services even if the Studio frontend is self-hosted. [Sanity hosting guide](https://www.sanity.io/docs/studio/deployment/)

For Saluna's current manual deployment flow, Sanity has two publication paths: server-rendered pages query a foreign API at request time, or static pages require a build/deploy after edits. Either path needs design work to provide both immediate publication and resilience to international connectivity problems. This is an operational concern, not a verified claim that Sanity is unavailable in Iran. Before reconsidering it, test the actual writer's Studio access and requests from the production network. [Sanity's Astro rendering guide](https://www.sanity.io/docs/astro/static-and-server-rendering)

At the time of review, Sanity's Free plan allowed Administrator and Viewer roles but no Editor role. Growth listed Editor/Contributor roles at $15 per seat per month; verify current terms before budgeting. Both products can export content and assets, though migration to a different CMS still requires transforming the content model. [Sanity pricing](https://www.sanity.io/pricing), [Sanity export](https://www.sanity.io/docs/content-lake/exporting-data), [EmDash site transfer](https://docs.emdashcms.com/guides/site-transfer/)

## Persian editing and video

EmDash's [locale configuration](https://github.com/emdash-cms/emdash/blob/main/packages/admin/src/locales/locales.ts) enables `fa` with RTL direction. On 2026-09-29, `msgfmt --statistics` on its [Persian catalog](https://github.com/emdash-cms/emdash/blob/main/packages/admin/src/locales/fa/messages.po) reported 1,094 translated and 1,984 untranslated messages. The writer must trial the real editor with a Persian article and guide; enabled RTL alone does not prove the interface is comfortable. Sanity supports Studio localization, but Persian was absent from its maintained locale directory when checked; it would require a custom or third-party translation. [Sanity localization guide](https://www.sanity.io/docs/studio/localizing-studio-ui)

Keep videos in a video service/CDN and store their URL, title, thumbnail, and optional transcript/captions in the guide. This avoids using the web container or CMS media storage for large streaming files. EmDash accepts video uploads but its default per-file limit is 50 MB. For public video discovery, use an accessible watch/guide page and appropriate `VideoObject` metadata where it applies. [EmDash media guide](https://docs.emdashcms.com/guides/media-library/), [Google video guidance](https://developers.google.com/search/docs/appearance/video)

## Implementation checks

1. Trial the actual editor's workflow in Persian: create draft, upload screenshot, add video URL, preview, publish, revise, and unpublish. Check permissions with Contributor or Author, not Admin.
2. Add EmDash to `apps/web` on a supported Node version. Provision a separate Postgres database or schema and role; add runtime secrets and durable media storage. Avoid coupling CMS tables to Salon operational tables.
3. Model Blog Articles and Product Guides separately. Guides need task-based titles, ordered steps, product area, screenshots, optional video/transcript, related guides, and a review date or owner. Product staff must review a guide when its underlying workflow changes.
4. Build public `/blog` and `/guides` routes in Astro. Use one metadata path so Saluna's existing `Head.astro` and EmDash SEO fields do not emit conflicting canonicals or robots directives. Include published, indexable CMS pages in discoverable sitemaps while preserving the existing Salon sitemap.
5. Prove publication without deploying, accurate previews, private drafts, canonical URLs, 404/unpublish behavior, and links from the manager PWA.
6. Back up and restore the database, media, and EmDash encryption keys. EmDash's JSON download is not a full restorable backup. Verify scheduled publishing and health checks under the production Compose setup. [EmDash backup guide](https://docs.emdashcms.com/guides/backups/)

Do not treat a CMS choice as an SEO improvement by itself. The public pages still need useful content, stable URLs, internal links, metadata, and search accessibility. Google has [no ranking preference between subdirectories and subdomains](https://developers.google.com/search/help/crawling-index-faq); keeping Blog Articles and Product Guides on `saluna.ir` simplifies the visitor journey and current deployment.
