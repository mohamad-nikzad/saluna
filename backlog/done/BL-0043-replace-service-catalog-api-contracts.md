---
id: BL-0043
title: Replace service catalog API contracts
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

Replace manager/admin service catalog contracts with category, service, add-on, and package-shaped responses so clients can load the new catalog model without ServiceFamily or combo-service API concepts.

## Acceptance Criteria

- [x] Manager catalog responses return `{ categories, services, addons, packages }`.
- [x] Setup Salon catalog responses use the same target catalog language where applicable.
- [x] Public and manager service read models expose ServiceVariant fields needed for normal service workflows without requiring `familyId` or `kind`.
- [x] Package read models include definition, component, price override, active, sort, and staff capability information needed by setup and manager flows.
- [x] OpenAPI route/schema definitions are updated for the new response contracts.
- [x] API tests cover tenant scoping and the absence of family/combo concepts from the new catalog payload.

## Blocked by

- [BL-0042 Migrate legacy combos and add-on scopes into package-ready storage](../done/BL-0042-migrate-legacy-combos-and-addon-scopes.md)

## Notes

- Type: AFK.
- Source slice from `SERVICE_CATALOG_MIGRATION_PLAN.md`.
- Completed on 2026-07-08. Added combined manager service catalog response, included packages in setup catalog, exposed package `staffIds`, regenerated OpenAPI/API client artifacts, and verified with focused API tests, typechecks, and `pnpm db:check`.
