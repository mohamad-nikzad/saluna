---
id: BL-0050
title: Update catalog and calendar surfaces for the new model
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

Update PWA and admin surfaces so managers and platform staff use the new catalog model: categories and services for normal catalog work, simplified add-on scopes, package definitions, staff package capability, and manager-only package scheduling.

## Acceptance Criteria

- [ ] PWA Services page shows categories and ServiceVariants only for normal services.
- [ ] Family controls and combo service controls are removed from manager and setup catalog UI.
- [ ] Add-on UI supports available everywhere, category, and service scopes.
- [ ] Packages have a separate manager/admin setup section for definitions, components, price behavior, and staff capabilities.
- [ ] Calendar/appointment flow includes a manager-only package scheduling path.
- [ ] Scheduled package task Appointments appear correctly on calendar, today, staff, and appointment detail views.
- [ ] PWA/admin tests cover service catalog rendering, add-on scope saving, staff package capability, package scheduling, and no family/combo controls.

## Blocked by

- [BL-0044 Simplify ServiceVariant create and update flows](BL-0044-simplify-servicevariant-flows.md)
- [BL-0045 Rebuild add-on scope management](BL-0045-rebuild-addon-scope-management.md)
- [BL-0046 Add Service Package setup and staff capabilities](BL-0046-add-service-package-setup.md)
- [BL-0047 Add manager-only package scheduling](BL-0047-add-manager-package-scheduling.md)

## Notes

- Type: AFK.
- Source slice from `SERVICE_CATALOG_MIGRATION_PLAN.md`.
