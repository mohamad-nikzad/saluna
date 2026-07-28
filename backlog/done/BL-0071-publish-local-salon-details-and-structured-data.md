---
id: BL-0071
title: Publish local Salon details and structured data
status: done
type: task
triage: ready-for-agent
priority: high
size: large
parent: BL-0069
blocked_by: [BL-0070]
created: 2026-07-26
updated: 2026-07-28
---

## Parent

[BL-0069 Improve public Salon pages for local organic search](../ready/BL-0069-improve-public-salon-local-seo.md)

## What to Build

Make an active, enabled public Salon page visibly describe its real locality,
street address, Salon Working Days, working hours, and visible services. Derive
the page's search metadata and `BeautySalon` structured data from that same
public Salon read model, while preserving useful output when optional data is
missing.

## Acceptance Criteria

- [x] The public Salon read model exposes structured location plus existing Salon Working Days and working hours only for active, enabled Salons.
- [x] Customers can see available province, city, neighborhood, street address, and working hours as ordinary page content.
- [x] Page title and description use Salon name, locality, bio, and visible services according to BL-0069 without adding editable SEO fields.
- [x] The canonical URL is built from the public origin and Salon slug only, with query strings and fragments excluded.
- [x] `BeautySalon` JSON-LD includes a `PostalAddress`, telephone, canonical URL, social profiles, visible service offers, and `openingHoursSpecification` when their source values exist.
- [x] Optional structured-data properties are omitted when absent; the page does not invent location, coordinates, ratings, or hours.
- [x] Public API and rendered-page tests cover complete and incomplete Salon Presence while preserving the active-and-enabled publication gate.

## Blocked By

- BL-0070 Capture structured Salon Presence location.
