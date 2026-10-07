---
id: BL-0096
title: Add Blog Article SEO and discovery
status: done
type: task
triage: ready-for-agent
priority: medium
size: medium
parent: BL-0087
blocked_by: [BL-0095]
created: 2026-10-06
updated: 2026-10-07
---

## Problem

Readable articles also need correct search and sharing output. Discovery must follow publication state rather than the date of the last web build.

## Smallest Useful Version

Extend the site's shared metadata rendering and runtime sitemap discovery for Blog Articles, including a Saluna-branded social preview when no cover image exists.

## Acceptance Criteria

- [x] Published articles have one canonical URL, page-specific title and description, article structured data, and social metadata through the existing shared metadata path.
- [x] Cover images supply article social previews when present; articles without covers return a working Saluna-branded social image.
- [x] A runtime public sitemap exposes current published article canonical URLs and is advertised to crawlers. Existing static and public Salon sitemaps remain discoverable and correct.
- [x] Publication, republishing, renaming, withdrawal, and deletion update discovery on the next request without a build. Former URLs, drafts, and withdrawn articles never remain in the sitemap.
- [x] Private previews remain unindexable and absent from public discovery.
- [x] Focused rendered-layout and sitemap response tests cover metadata, default and named bylines, optional images, and published-only discovery. Extend HTTP smoke checks for structured data, social-image responses, sitemap discovery, and the real publication lifecycle.

## Notes

- Follow [BL-0087](../now/BL-0087-publish-blog-and-product-guides-with-emdash.md) and [ADR-0040](../../docs/adr/0040-emdash-for-public-content.md).
- Reuse the existing public-web metadata, sitemap, and smoke coverage. Article-to-signup attribution remains separate work.

## Completion evidence, 2026-10-07

Implementation `e787d4276e9b25390972074ca3e0ce1d3c61a8eb` merged into
`codex/bl-0087-emdash-blog-and-guides` at
`13649a3b3fcd56f50a37eb9ca981295fc80b4a35`.

The shared metadata path now renders article canonicals, search and social
metadata, ISO publication/live-revision dates, and safely serialized Article
JSON-LD. Cover images resolve through supported media-provider APIs and work
for anonymous requests. Articles without covers use the branded landing image.
`/blog-sitemap.xml` reads current published content and revisioned search
settings; robots advertises it alongside existing static and Salon discovery.
Publication, staged edits, renames, withdrawal, Trash, and deletion were checked
through real CMS operations and the next public HTTP request.

Native EmDash 1.1.0 SEO settings and byline selections save independently of
content revisions. Public SEO therefore uses the revisioned `seo_title`,
`seo_description`, and `search_excluded` fields. Public credit uses native
revisioned references to reusable `public_authors` entries, with the team
fallback. Saving author profile changes also preserves their live names.
Legacy native profiles, credits, and SEO data remain intact. The editor guide
records export-before-configuration and explicit publication for migration;
configuration does not promote existing staged drafts. The native Bylines panel
cannot be hidden with supported settings and does not determine public credit.

Independent verification passed all 15 production CMS tests, 29 web tests,
lint, and typecheck, including typecheck without the ignored generated EmDash
declaration. The production fixture built without CMS credentials. The normal
manager suite still lists 31 tests across 9 files and excludes CMS. Anonymous
HTTP checks decoded both cover and fallback images and verified their metadata
dimensions. Discovery returned 500 under a real CMS outage. Disposable resources
were removed. The user's hands-on trial remains pending in BL-0097, as requested
for the end; no production deployment occurred.
