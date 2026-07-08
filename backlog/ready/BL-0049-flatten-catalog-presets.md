---
id: BL-0049
title: Flatten CatalogPresets to categories and services
status: ready
type: feature
priority: high
size: medium
created: 2026-06-30
updated: 2026-07-08
---

## Parent

[BL-0041 Service catalog big-bang migration](BL-0041-service-catalog-big-bang-migration.md)

## What to build

Update CatalogPreset definitions and import behavior so starter catalogs create ServiceCategories and ServiceVariants only, without importing families, combo services, or Service Packages in this pass.

## Acceptance Criteria

- [ ] CatalogPreset read models expose preset categories and preset services without requiring PresetFamily in new client flows.
- [ ] Applying a CatalogPreset creates categories and ServiceVariants only.
- [ ] Preset import does not create Service Packages.
- [ ] Starter service templates no longer create combo services for new salons.
- [ ] Setup Salon catalog preset application remains idempotent and duplicate-safe.
- [ ] Tests cover preset listing, preset apply, duplicate protection, and absence of family/combo/package imports.

## Blocked by

- [BL-0043 Replace service catalog API contracts](../done/BL-0043-replace-service-catalog-api-contracts.md)
- [BL-0044 Simplify ServiceVariant create and update flows](../done/BL-0044-simplify-servicevariant-flows.md)

## Notes

- Type: AFK.
- Source slice from `SERVICE_CATALOG_MIGRATION_PLAN.md`.
- Partial implementation note: read/import code normalizes presets to categories and services and applies categories plus ServiceVariants only. The seed source still uses the legacy `families`/`variants` shape before normalization, so keep this open until seeds are stored/authored in the flat target shape and absence of family/combo/package imports is covered end to end.
