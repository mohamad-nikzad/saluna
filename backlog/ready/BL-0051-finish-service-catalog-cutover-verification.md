---
id: BL-0051
title: Finish service catalog cutover verification
status: ready
type: chore
priority: high
size: medium
created: 2026-06-30
updated: 2026-06-30
---

## Parent

[BL-0041 Service catalog big-bang migration](BL-0041-service-catalog-big-bang-migration.md)

## What to build

Finish the big-bang cutover by regenerating artifacts, updating domain documentation, recording the package scheduling ADR, refreshing seeds, and running the full regression verification suite.

## Acceptance Criteria

- [ ] Drizzle migration metadata is regenerated and committed with schema changes.
- [ ] OpenAPI contract and HeyAPI client are regenerated and committed.
- [ ] `CONTEXT.md` marks ServiceFamily/combo as legacy storage only and Service Package scheduling as manager-only implemented scope.
- [ ] A new ADR supersedes the previous decision to defer Service Package scheduling and records the manager-only same-day package scope.
- [ ] Seeds and starter catalog data match the category/service target model.
- [ ] Verification passes: `pnpm db:check`, `pnpm generate:api-contract`, `pnpm generate:api-client`, `pnpm typecheck`, and `pnpm test`.
- [ ] Targeted PWA/admin visual checks cover services, staff capabilities, appointment calendar, and setup catalog.

## Blocked by

- [BL-0042 Migrate legacy combos and add-on scopes into package-ready storage](BL-0042-migrate-legacy-combos-and-addon-scopes.md)
- [BL-0043 Replace service catalog API contracts](BL-0043-replace-service-catalog-api-contracts.md)
- [BL-0044 Simplify ServiceVariant create and update flows](BL-0044-simplify-servicevariant-flows.md)
- [BL-0045 Rebuild add-on scope management](BL-0045-rebuild-addon-scope-management.md)
- [BL-0046 Add Service Package setup and staff capabilities](BL-0046-add-service-package-setup.md)
- [BL-0047 Add manager-only package scheduling](BL-0047-add-manager-package-scheduling.md)
- [BL-0048 Keep public booking service-only](BL-0048-keep-public-booking-service-only.md)
- [BL-0049 Flatten CatalogPresets to categories and services](BL-0049-flatten-catalog-presets.md)
- [BL-0050 Update catalog and calendar surfaces for the new model](BL-0050-update-catalog-and-calendar-surfaces.md)

## Notes

- Type: AFK.
- Source slice from `SERVICE_CATALOG_MIGRATION_PLAN.md`.
