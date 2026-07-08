---
id: BL-0044
title: Simplify ServiceVariant create and update flows
status: done
type: feature
priority: high
size: medium
created: 2026-06-30
updated: 2026-07-08
---

## Parent

[BL-0041 Service catalog big-bang migration](BL-0041-service-catalog-big-bang-migration.md)

## What to build

Cut new service mutations over to normal ServiceVariants only, removing family and combo workflows from manager/admin API and generated client surfaces while retaining legacy storage for historical rows.

## Acceptance Criteria

- [x] Service create/update accepts normal ServiceVariant fields only: name, category, duration, price, color, active, description, and public/sort fields where already supported.
- [x] New services always persist with `family_id = null` and do not rely on `services.kind` in application code.
- [x] `/api/v1/service-families` is removed from public/manager contracts.
- [x] `/api/v1/services/:id/combo-components` is removed from public/manager contracts.
- [x] Generated clients no longer expose family or combo service mutation helpers for the new service catalog flow.
- [x] API tests prove `familyId` and `kind` are absent or rejected in service create/update flows.

## Blocked by

- [BL-0043 Replace service catalog API contracts](../done/BL-0043-replace-service-catalog-api-contracts.md)

## Notes

- Type: AFK.
- Source slice from `SERVICE_CATALOG_MIGRATION_PLAN.md`.
- Completed on 2026-07-08. Service create/update inputs now exclude legacy family/kind fields, new variant writes rely on DB defaults for legacy storage columns, removed routes stay unmounted/unregistered, and focused API/database tests plus typechecks pass.
