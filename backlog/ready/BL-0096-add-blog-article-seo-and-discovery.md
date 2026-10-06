---
id: BL-0096
title: Add Blog Article SEO and discovery
status: ready
type: task
triage: ready-for-agent
priority: medium
size: medium
parent: BL-0087
blocked_by: [BL-0095]
created: 2026-10-06
updated: 2026-10-06
---

## Problem

Readable articles also need correct search and sharing output. Discovery must follow publication state rather than the date of the last web build.

## Smallest Useful Version

Extend the site's shared metadata rendering and runtime sitemap discovery for Blog Articles, including a Saluna-branded social preview when no cover image exists.

## Acceptance Criteria

- [ ] Published articles have one canonical URL, page-specific title and description, article structured data, and social metadata through the existing shared metadata path.
- [ ] Cover images supply article social previews when present; articles without covers return a working Saluna-branded social image.
- [ ] A runtime public sitemap exposes current published article canonical URLs and is advertised to crawlers. Existing static and public Salon sitemaps remain discoverable and correct.
- [ ] Publication, republishing, renaming, withdrawal, and deletion update discovery on the next request without a build. Former URLs, drafts, and withdrawn articles never remain in the sitemap.
- [ ] Private previews remain unindexable and absent from public discovery.
- [ ] Focused rendered-layout and sitemap response tests cover metadata, default and named bylines, optional images, and published-only discovery. Extend HTTP smoke checks for structured data, social-image responses, sitemap discovery, and the real publication lifecycle.

## Notes

- Follow [BL-0087](../now/BL-0087-publish-blog-and-product-guides-with-emdash.md) and [ADR-0040](../../docs/adr/0040-emdash-for-public-content.md).
- Reuse the existing public-web metadata, sitemap, and smoke coverage. Article-to-signup attribution remains separate work.
