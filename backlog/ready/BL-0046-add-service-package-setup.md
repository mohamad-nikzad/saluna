---
id: BL-0046
title: Add Service Package setup and staff capabilities
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

Add manager/admin setup flows for defining Service Packages, choosing included ServiceVariants, configuring package price behavior, and explicitly assigning staff package capabilities.

## Acceptance Criteria

- [ ] Managers can list, create, update, activate/archive, and sort Service Package definitions.
- [ ] Managers can replace a package's included ServiceVariant components in a deterministic order.
- [ ] Managers can set package pricing with an override or fallback to the sum of included ServiceVariant prices.
- [ ] Managers can assign explicit staff package capabilities separately from normal staff service capabilities.
- [ ] Package setup routes enforce tenant permissions.
- [ ] Tests cover package definition, component validation, duplicate prevention, price behavior, and staff package capability reads/writes.

## Blocked by

- [BL-0042 Migrate legacy combos and add-on scopes into package-ready storage](../done/BL-0042-migrate-legacy-combos-and-addon-scopes.md)
- [BL-0043 Replace service catalog API contracts](../done/BL-0043-replace-service-catalog-api-contracts.md)

## Notes

- Type: AFK.
- Source slice from `SERVICE_CATALOG_MIGRATION_PLAN.md`.
