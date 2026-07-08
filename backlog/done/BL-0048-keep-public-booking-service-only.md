---
id: BL-0048
title: Keep public booking service-only
status: done
type: feature
priority: high
size: medium
created: 2026-06-30
updated: 2026-07-08
---

## Parent

[BL-0041 Service catalog big-bang migration](../ready/BL-0041-service-catalog-big-bang-migration.md)

## What to build

Keep public booking and AppointmentRequest creation focused on visible active ServiceVariants during the cutover, with no public package exposure in v1 and no regression to service snapshots.

## Acceptance Criteria

- [x] Public salon pages list active, public-visible ServiceVariants only.
- [x] Public package definitions are not exposed through public page settings or public booking APIs.
- [x] Public AppointmentRequest creation still snapshots the selected ServiceVariant name, duration, and price.
- [x] AppointmentRequest approval remains compatible with the service-only public request path.
- [x] Existing appointment create/update with add-ons still works after the add-on scope rewrite.
- [x] Regression tests cover public service listing, request creation, approval, and snapshot stability.

## Blocked by

- [BL-0043 Replace service catalog API contracts](BL-0043-replace-service-catalog-api-contracts.md)
- [BL-0044 Simplify ServiceVariant create and update flows](BL-0044-simplify-servicevariant-flows.md)
- [BL-0045 Rebuild add-on scope management](BL-0045-rebuild-addon-scope-management.md)

## Notes

- Type: AFK.
- Source slice from `SERVICE_CATALOG_MIGRATION_PLAN.md`.
- Implemented by keeping the public API/service lookup on active visible standard services only; Service Package definitions are manager-side only and public request snapshots still bind the selected service.
