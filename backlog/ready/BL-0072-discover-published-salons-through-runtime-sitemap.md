---
id: BL-0072
title: Discover published Salons through a runtime sitemap
status: ready
type: task
triage: ready-for-agent
priority: high
size: medium
parent: BL-0069
blocked_by: []
created: 2026-07-26
updated: 2026-07-26
---

## Parent

[BL-0069 Improve public Salon pages for local organic search](BL-0069-improve-public-salon-local-seo.md)

## What to Build

Serve a runtime Salon sitemap whose absolute canonical URLs reflect current
database publication state on each cache miss. Advertise it beside the existing
static sitemap so newly enabled public Salon pages can be discovered without a
web application rebuild.

## Acceptance Criteria

- [ ] One unauthenticated read returns only slugs whose Salon status is active and whose public page is enabled.
- [ ] `/salons-sitemap.xml` returns valid XML containing absolute canonical `/salons/{slug}` URLs for every eligible Salon.
- [ ] Setup, suspended, archived, disabled, and missing Salons are excluded regardless of whether optional SEO fields are complete.
- [ ] The response carries `Cache-Control: public, s-maxage=86400, stale-while-revalidate=3600`.
- [ ] Enabling or disabling a Salon changes the next uncached sitemap response without a deployment, scheduled job, queue, or persisted sitemap rows.
- [ ] `robots.txt` references both the existing static sitemap index and the runtime Salon sitemap without changing Astro's generated sitemap.
- [ ] Database, API, and HTTP tests cover the publication gate, XML response, cache policy, and robots declarations.

## Blocked By

None — can start immediately.
