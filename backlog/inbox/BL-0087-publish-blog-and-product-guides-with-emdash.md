---
id: BL-0087
title: Publish Blog Articles and Product Guides with EmDash
status: inbox
type: feature
triage: needs-triage
priority: medium
size: large
created: 2026-09-29
updated: 2026-09-29
---

## Problem

Saluna has no self-service publishing path for a nontechnical content editor. Blog Articles should answer questions from salon owners and make the public site more discoverable. Product Guides should help managers complete Saluna tasks with written steps, screenshots, and optional video, without hiding the instructions behind product login.

## Smallest Useful Version

Integrate EmDash into the existing `apps/web` Astro site on `saluna.ir`. Give a nontechnical editor a restricted account and publish a small Blog Article and Product Guide section at `/blog/` and `/guides/`. Link one Product Guide from the relevant manager PWA screen. Follow [ADR-0040](../../docs/adr/0040-emdash-for-public-content.md) and the [implementation findings](../../docs/research/2026-09-29-public-content-cms.md).

## Acceptance Criteria

- [ ] An authorized nontechnical editor can draft, preview, publish, revise, and unpublish a Persian Blog Article and Product Guide without a code change or Saluna deployment.
- [ ] Contributor/Author/Editor permissions allow content work without granting CMS administration or access to Salon operational data.
- [ ] Blog Articles and Product Guides use distinct content types and public templates; guides support ordered steps, screenshots, an optional externally hosted video and transcript, related guides, and a last-reviewed date or reviewer.
- [ ] Public `/blog/` and `/guides/` indexes and individual pages use Saluna's Persian RTL design and are reachable through site navigation; at least one manager PWA screen links to its relevant Product Guide.
- [ ] Published pages return crawlable HTML with one canonical URL, page-specific title/description, relevant article or video metadata when applicable, and inclusion in a public sitemap. Drafts and unpublished pages are not indexed; existing public Salon sitemap behavior remains intact.
- [ ] Publication is visible without rebuilding the web image, and a removed or renamed page has intentional 404/redirect behavior.
- [ ] CMS data uses a dedicated Postgres database or schema and role; media persists across container replacement. Runtime secrets, migrations, backups, and recovery are documented and rehearsed on staging.
- [ ] The web runtime uses an EmDash-supported Node version. Production smoke checks exercise CMS content and editing dependencies, not only the static landing page.
- [ ] The intended editor completes an end-to-end Persian RTL trial, including screenshot upload and video placement; any unacceptable untranslated UI or formatting behavior is resolved before launch.

## Notes

- Decision: use EmDash on the existing Node/VPS deployment, not Cloudflare Workers. Keep `app.saluna.ir` separate.
- Host large videos outside the CMS and web container. Store video references and supporting text with Product Guides.
- EmDash is new relative to Sanity. Keep the first content model narrow and rehearse an upgrade and restore before production.
- Product staff own accuracy of Product Guides after UI changes; the content editor owns drafting and publication.
- Split this large feature into independently deployable tasks during triage, beginning with infrastructure/editor trial, then Blog Articles, then Product Guides and in-app links.
