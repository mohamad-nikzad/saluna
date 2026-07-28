---
id: BL-0075
title: Prove the complete local-search journey
status: ready
type: task
triage: ready-for-agent
priority: high
size: medium
parent: BL-0069
blocked_by: [BL-0071, BL-0072, BL-0073, BL-0074]
created: 2026-07-26
updated: 2026-07-26
---

## Parent

[BL-0069 Improve public Salon pages for local organic search](BL-0069-improve-public-salon-local-seo.md)

## What to Build

Prove the complete BL-0069 outcome through the existing public-web smoke seam
and authenticated manager browser seam, closing only integration gaps exposed
by those journeys.

## Acceptance Criteria

- [ ] One active, enabled Salon with complete Salon Presence appears at its canonical URL in the runtime sitemap and renders its locality and working hours.
- [ ] That page's canonical URL has no query string or fragment, and its `BeautySalon` JSON-LD contains the expected `PostalAddress` and `openingHoursSpecification`.
- [ ] A disabled or inactive Salon is absent from the sitemap and remains unavailable publicly.
- [ ] Enabling an eligible Salon makes it appear on the next uncached sitemap response without rebuilding the web application.
- [ ] The sitemap is valid XML, carries the required cache policy, and `robots.txt` advertises both static and runtime Salon sitemaps.
- [ ] A token-bearing AppointmentRequest status page emits `noindex, nofollow`.
- [ ] The authenticated manager journey proves completeness guidance plus canonical share, copy, open, unpublished-state, cancellation, and fallback behavior.
- [ ] Tests assert externally visible HTML, HTTP responses, and API contracts without introducing an SEO-specific framework.

## Blocked By

- BL-0071 Publish local Salon details and structured data.
- BL-0072 Discover published Salons through a runtime sitemap.
- BL-0073 Keep AppointmentRequest status pages out of search.
- BL-0074 Help managers complete and share their public page.
