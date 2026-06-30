---
id: BL-0042
title: Migrate legacy combos and add-on scopes into package-ready storage
status: ready
type: feature
priority: high
size: large
created: 2026-06-30
updated: 2026-06-30
---

## Parent

[BL-0041 Service catalog big-bang migration](BL-0041-service-catalog-big-bang-migration.md)

## What to build

Add the package-ready catalog storage and migration path so existing salons keep their historical ServiceVariants, appointments, appointment requests, staff capabilities, snapshots, complete combos, and add-on availability after the big-bang cutover.

## Acceptance Criteria

- [ ] Package tables exist for Service Packages, package components, staff package capabilities, package booking headers, and package task rows.
- [ ] Complete legacy combo services migrate into Service Package records with copied components, price override behavior, and explicit staff package capabilities.
- [ ] Legacy combo service rows are marked inactive and retained for historical appointments and snapshots.
- [ ] Incomplete legacy combos are marked inactive and recorded in a migration issue list for admin/manual review.
- [ ] Existing category, family, service, and empty add-on scopes migrate into the simplified `all`, `category`, or `service` scope model without losing availability.
- [ ] Migration/preflight tests prove existing services, staff capabilities, appointments, appointment requests, public visibility, and booked snapshots survive.

## Blocked by

None - can start immediately.

## Notes

- Type: AFK.
- Source slice from `SERVICE_CATALOG_MIGRATION_PLAN.md`.
