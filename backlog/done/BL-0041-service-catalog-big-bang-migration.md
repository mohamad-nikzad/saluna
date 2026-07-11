---
id: BL-0041
title: Service catalog big-bang migration
status: done
type: feature
priority: high
size: large
created: 2026-06-30
updated: 2026-07-11
---

## Problem

The current service catalog still exposes legacy ServiceFamily and combo-service workflows in manager/admin/API surfaces. The target model is `ServiceCategory -> ServiceVariant`, with Service Packages as the manager-only way to schedule bundled same-day work.

## Smallest Useful Version

Ship one coordinated cutover that keeps existing appointments, appointment requests, staff capabilities, snapshots, public visibility, and historical combo rows valid while moving new workflows to categories, services, add-ons, and Service Packages.

## Acceptance Criteria

- [x] Manager/admin/public catalog flows use categories, services, add-ons, and packages without exposing family or combo workflows.
- [x] `services` remains the canonical ServiceVariant table so existing appointment, request, staff capability, and snapshot references survive migration.
- [x] Complete legacy combos migrate into Service Package records with components, price override behavior, explicit staff package capabilities, and inactive legacy service rows.
- [x] Incomplete legacy combos become inactive and are recorded for admin/manual review.
- [x] Add-ons use one simplified scope model: `all`, `category`, or `service`; existing category, family, service, and empty scopes migrate without losing behavior.
- [x] Manager-only package scheduling creates a package booking header and normal task Appointment rows transactionally, validating staff capability, working hours, and conflicts before writing anything.
- [x] Public booking remains single-service only; package tasks do not support add-ons in v1.
- [x] CatalogPresets import categories and services only; packages are not imported in this pass.
- [x] OpenAPI, HeyAPI client, Drizzle migration metadata, `CONTEXT.md`, and a superseding ADR are updated.
- [x] Verification passes: `pnpm db:check`, `pnpm generate:api-contract`, `pnpm generate:api-client`, `pnpm typecheck`, `pnpm test`, plus targeted PWA/admin visual checks.

## Child Implementation Slices

1. [BL-0042 Migrate legacy combos and add-on scopes into package-ready storage](BL-0042-migrate-legacy-combos-and-addon-scopes.md).
   Type: AFK. Blocked by: none.

2. [BL-0043 Replace service catalog API contracts](BL-0043-replace-service-catalog-api-contracts.md).
   Type: AFK. Blocked by: BL-0042.

3. [BL-0044 Simplify ServiceVariant create and update flows](BL-0044-simplify-servicevariant-flows.md).
   Type: AFK. Blocked by: BL-0043.

4. [BL-0045 Rebuild add-on scope management](BL-0045-rebuild-addon-scope-management.md).
   Type: AFK. Blocked by: BL-0042 and BL-0043.

5. [BL-0046 Add Service Package setup and staff capabilities](BL-0046-add-service-package-setup.md).
   Type: AFK. Blocked by: BL-0042 and BL-0043.

6. [BL-0047 Add manager-only package scheduling](BL-0047-add-manager-package-scheduling.md).
   Type: AFK. Blocked by: BL-0046.

7. [BL-0048 Keep public booking service-only](BL-0048-keep-public-booking-service-only.md).
   Type: AFK. Blocked by: BL-0043, BL-0044, and BL-0045.

8. [BL-0049 Flatten CatalogPresets to categories and services](BL-0049-flatten-catalog-presets.md).
   Type: AFK. Blocked by: BL-0043 and BL-0044.

9. [BL-0050 Update catalog and calendar surfaces for the new model](BL-0050-update-catalog-and-calendar-surfaces.md).
   Type: AFK. Blocked by: BL-0044, BL-0045, BL-0046, and BL-0047.

10. [BL-0051 Finish service catalog cutover verification](BL-0051-finish-service-catalog-cutover-verification.md).
    Type: AFK. Blocked by: BL-0042 through BL-0050.

## Notes

- Source plan: `SERVICE_CATALOG_MIGRATION_PLAN.md`.
- This item is the parent tracker. Child backlog items BL-0042 through BL-0051 were created from the implementation slices.
- A GitHub issue was created by mistake and closed because Saluna tracks implementation tasks locally.
- Closed 2026-07-11: all child slices BL-0042 through BL-0051 are done. Parent tracker closed after verifying no open children remain.
