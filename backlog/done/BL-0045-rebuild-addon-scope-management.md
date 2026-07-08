---
id: BL-0045
title: Rebuild add-on scope management
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

Move ServiceAddon setup and lookup to the simplified scope model so managers can make add-ons available everywhere, by ServiceCategory, or by ServiceVariant, and appointment add-on selection still behaves correctly.

## Acceptance Criteria

- [x] Add-on create/update accepts `all`, `category`, and `service` scopes only.
- [x] Family-scoped legacy add-ons are represented as equivalent service scopes after migration.
- [x] Add-ons with no legacy scope are available everywhere after migration.
- [x] Manager and setup APIs can save and read the simplified scopes.
- [x] Appointment add-on lookup returns active add-ons available for the selected ServiceVariant.
- [x] API and UI tests cover global, category, service, and migrated family-scope behavior.

## Blocked by

- [BL-0042 Migrate legacy combos and add-on scopes into package-ready storage](../done/BL-0042-migrate-legacy-combos-and-addon-scopes.md)
- [BL-0043 Replace service catalog API contracts](../done/BL-0043-replace-service-catalog-api-contracts.md)

## Notes

- Type: AFK.
- Source slice from `SERVICE_CATALOG_MIGRATION_PLAN.md`.
