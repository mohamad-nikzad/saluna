---
id: BL-0044
title: Simplify ServiceVariant create and update flows
status: ready
type: feature
priority: high
size: medium
created: 2026-06-30
updated: 2026-06-30
---

## Parent

[BL-0041 Service catalog big-bang migration](BL-0041-service-catalog-big-bang-migration.md)

## What to build

Cut new service mutations over to normal ServiceVariants only, removing family and combo workflows from manager/admin API and generated client surfaces while retaining legacy storage for historical rows.

## Acceptance Criteria

- [ ] Service create/update accepts normal ServiceVariant fields only: name, category, duration, price, color, active, description, and public/sort fields where already supported.
- [ ] New services always persist with `family_id = null` and do not rely on `services.kind` in application code.
- [ ] `/api/v1/service-families` is removed from public/manager contracts.
- [ ] `/api/v1/services/:id/combo-components` is removed from public/manager contracts.
- [ ] Generated clients no longer expose family or combo service mutation helpers for the new service catalog flow.
- [ ] API tests prove `familyId` and `kind` are absent or rejected in service create/update flows.

## Blocked by

- [BL-0043 Replace service catalog API contracts](BL-0043-replace-service-catalog-api-contracts.md)

## Notes

- Type: AFK.
- Source slice from `SERVICE_CATALOG_MIGRATION_PLAN.md`.
