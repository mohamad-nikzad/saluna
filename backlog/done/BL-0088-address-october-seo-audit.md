---
id: BL-0088
title: Address the October public-site SEO audit
status: done
type: improvement
triage: ready-for-agent
priority: high
size: large
created: 2026-10-02
updated: 2026-10-02
---

## Problem

The [2 October SEO audit](../../docs/audits/seo-2026-10-02/README.md) identified broken sharing imagery, incorrect currency metadata, weak public navigation, duplicate Salon HTML, unnecessary asset transfers and missing focused product pages.

## Acceptance criteria

- [x] Three focused product pages explain actual AppointmentRequest, Client and Staff Commission workflows, with unique metadata, sitemap entries and relevant links.
- [x] Existing public content is reachable from the homepage and `/services` uses the current catalog language.
- [x] A valid, visually inspected static homepage sharing image removes the runtime font dependency.
- [x] IRR metadata converts stored tomans without changing prices in the product.
- [x] The small header mark is below 10 KB and the homepage declares the existing 180px primary icon.
- [x] Both public Salon layouts render the complete readable content once with intake enabled or disabled.
- [x] FAQ metadata matches visible copy; font and image priorities are deliberate.
- [x] Built-server slash redirects, links, metadata, sitemaps and image responses have repeatable smoke checks.
- [x] Outstanding production and owner checks are recorded separately.

## Notes

Implementation is complete in the working tree, with deployment pending. See [implementation evidence and follow-up](../../docs/audits/seo-2026-10-02/implementation.md). The www Nginx redirect is configured but could not be executed locally. The owner confirmed three test Salons and their indexing exclusions are implemented in BL-0089; editorial publishing remains BL-0087.
