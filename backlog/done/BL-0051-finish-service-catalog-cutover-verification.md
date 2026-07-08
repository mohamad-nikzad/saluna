---
id: BL-0051
title: Finish service catalog cutover verification
status: done
type: chore
priority: high
size: medium
created: 2026-06-30
updated: 2026-07-08
---

## Parent

[BL-0041 Service catalog big-bang migration](BL-0041-service-catalog-big-bang-migration.md)

## What to build

Finish the big-bang cutover by regenerating artifacts, updating domain documentation, recording the package scheduling ADR, refreshing seeds, and running the full regression verification suite.

## Acceptance Criteria

- [x] Drizzle migration metadata is regenerated and committed with schema changes.
- [x] OpenAPI contract and HeyAPI client are regenerated and committed.
- [x] `CONTEXT.md` marks ServiceFamily/combo as legacy storage only and Service Package scheduling as manager-only implemented scope.
- [x] A new ADR supersedes the previous decision to defer Service Package scheduling and records the manager-only same-day package scope.
- [x] Seeds and starter catalog data match the category/service target model.
- [x] Verification passes: `pnpm db:check`, `pnpm generate:api-contract`, `pnpm generate:api-client`, `pnpm typecheck`, and `pnpm test`.
- [x] Targeted PWA/admin visual checks cover services, staff capabilities, appointment calendar, and setup catalog.

## Blocked by

- [BL-0042 Migrate legacy combos and add-on scopes into package-ready storage](../done/BL-0042-migrate-legacy-combos-and-addon-scopes.md)
- [BL-0043 Replace service catalog API contracts](../done/BL-0043-replace-service-catalog-api-contracts.md)
- [BL-0044 Simplify ServiceVariant create and update flows](../done/BL-0044-simplify-servicevariant-flows.md)
- [BL-0045 Rebuild add-on scope management](../done/BL-0045-rebuild-addon-scope-management.md)
- [BL-0046 Add Service Package setup and staff capabilities](../done/BL-0046-add-service-package-setup.md)
- [BL-0047 Add manager-only package scheduling](../done/BL-0047-add-manager-package-scheduling.md)
- [BL-0048 Keep public booking service-only](../done/BL-0048-keep-public-booking-service-only.md)
- [BL-0049 Flatten CatalogPresets to categories and services](../done/BL-0049-flatten-catalog-presets.md)
- [BL-0050 Update catalog and calendar surfaces for the new model](../done/BL-0050-update-catalog-and-calendar-surfaces.md)

## Notes

- Type: AFK.
- Source slice from `SERVICE_CATALOG_MIGRATION_PLAN.md`.
- Partial implementation note: OpenAPI/client artifacts, `CONTEXT.md`, and the manager package scheduling ADR appear to exist, but this item remains open until seeds are fully flat and the listed full verification commands plus targeted visual checks are run and recorded.
- Verification note: `pnpm db:check`, `pnpm generate:api-contract`, `pnpm generate:api-client`, `pnpm typecheck`, and `pnpm test` pass after the flat seed and UI cutover cleanup.
- Visual verification note: authenticated PWA checks covered `/services` (category/service catalog, no family/combo controls, package staff capability checkboxes) and `/calendar` (manager package booking tab plus assigned-staff-only package picker). Authenticated admin checks covered `/salons/d6b08ecf-e697-41dd-b9e8-ed6e003d537e/services` setup catalog (service form without family/combo controls and add-on all/category/service scope controls).
- Fix note: visual verification exposed migrated dev DBs with `staff_package_capabilities.staff_user_id`; added forward migration `0018_staff_package_capabilities_column_rename` to align them with the current `staff_id` schema.
