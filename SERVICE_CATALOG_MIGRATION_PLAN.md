# Service Catalog Big-Bang Migration Plan

## Summary

Rewrite the catalog around Category -> ServiceVariant, remove family/combo from manager/admin workflows, and add real Service Packages for manager-only same-day package scheduling.

This is a big-bang product/API cutover: update database schema, API contracts, generated clients, PWA/admin UI, seeds, and tests in one release. Keep legacy family data and legacy combo service rows in the database only for migration/history.

## Key Changes

### Data Model And Migration

- Keep `services` as the canonical ServiceVariant table so existing `appointments.service_id`, `appointment_requests.service_id`, `staff_services.service_id`, and snapshots remain valid.
- Retain `service_families` and `services.family_id` temporarily as legacy storage, but remove them from public forms, OpenAPI contracts, generated clients, and manager/admin UI. New services always use `family_id = null`.
- Stop using `services.kind` in app code. Keep the column temporarily as legacy data so old combo rows can be migrated safely.
- Drop future use of `service_combo_components`; migrate complete combos into new package records, then remove combo endpoints/UI.
- Add package tables:
  - `service_packages`: salon, optional category, name, description, color, active, `price_override`, sort order, `source_legacy_service_id`.
  - `service_package_components`: package, included service, sort order.
  - `staff_package_capabilities`: explicit staff capability for packages.
  - `service_package_bookings`: package appointment header with client, lead staff, date, package snapshot name/price, status, notes.
  - `service_package_tasks`: package booking task rows linking each package component to a created normal `appointments` row.
- Package scheduling creates normal appointment rows for each task, so calendar/today/staff views keep working with minimal branching.
- Migrate legacy combos:
  - Complete combos with component rows become `service_packages`.
  - Package `price_override` is copied from combo price when `price > 0`; otherwise fallback pricing is used.
  - Package components are copied from `service_combo_components`.
  - Staff package capability is copied from explicit `staff_services` combo rows; staff with unrestricted services get explicit package capability rows.
  - Original combo service rows are marked inactive and retained for historical appointments.
  - Incomplete combos without components are marked inactive and recorded in a migration issue list for admin/manual review.
- Replace the three add-on scope tables with one simpler scope table: `all`, `category`, or `service`.
  - Existing category scopes migrate as category scopes.
  - Existing family scopes expand to service scopes for services currently in that family.
  - Existing service scopes migrate directly.
  - Existing add-ons with no scope become `all`.

### API, Types, And UI

- Replace the manager service catalog contract with `{ categories, services, addons, packages }`.
- Remove `/api/v1/service-families` and `/api/v1/services/:id/combo-components`.
- Keep service endpoints focused on normal ServiceVariants: name, categoryId, duration, price, color, active, description, publicVisible/sortOrder if implemented in the same pass.
- Add package endpoints for manager/admin setup flows: list, create, update, set components, set staff capabilities, and create package booking.
- Public booking remains single-service only in this rewrite. Packages are not public and do not appear in public page settings yet.
- Flatten CatalogPresets to category plus services only. Presets do not import packages in this pass.
- Update PWA Services page:
  - Show categories and services only.
  - Move add-ons into a simpler "available everywhere/category/services" scope UI.
  - Add a separate Packages section for package definitions and staff capability.
- Update appointment/calendar flow:
  - Existing single-service appointment drawer stays intact.
  - Add a manager-only package scheduling flow where each task gets same date, staff, start, and end.
  - Validate every task for staff capability, working hours, and scheduling conflicts before creating anything.
  - Package creation is transactional: if one task fails, no package booking or task appointment is created.
  - Package tasks do not support add-ons in v1.

### Generated Artifacts And Docs

- Regenerate Drizzle migration metadata after schema changes.
- Regenerate OpenAPI contract and HeyAPI client after route/schema changes.
- Update `CONTEXT.md` to mark family/combo as legacy storage only and package scheduling as implemented manager-only.
- Add an ADR superseding the "defer Service Package scheduling" decision, recording the chosen manager-only same-day package scope.

## Test Plan

- Database migration tests/preflight:
  - Existing services, staff capabilities, appointments, appointment requests, public visibility, and booked snapshots survive migration.
  - Complete combos produce packages/components/capabilities and inactive legacy service rows.
  - Incomplete combos become inactive migration issues.
  - Family-scoped add-ons expand to equivalent service scopes.
  - Empty add-on scopes become global.
- API tests:
  - Service create/update no longer accepts familyId or kind.
  - Family and combo endpoints are gone.
  - Package create/update/component/capability/booking routes enforce tenant permissions.
  - Package booking rejects conflicts and invalid task staff.
- PWA/admin tests:
  - Services page no longer renders family or combo controls.
  - Add-on scope UI saves all/category/service scopes.
  - Staff capability UI distinguishes services from packages.
  - Package scheduling creates all task appointments and shows them on calendar/today views.
- Regression tests:
  - Public page only lists visible active services.
  - Public appointment requests still create service snapshots.
  - Existing appointment create/update with add-ons still works.
  - Retention/client stats still use booked snapshots, not current catalog names.
- Final verification commands:
  - `pnpm db:check`
  - `pnpm generate:api-contract`
  - `pnpm generate:api-client`
  - `pnpm typecheck`
  - `pnpm test`
  - Targeted PWA/admin visual pass for services, staff capabilities, appointment calendar, and setup catalog.

## Assumptions And Defaults

- Big-bang means old frontend/generated clients are not supported after deploy; API and apps ship together.
- `services` table name and `serviceId` field names stay because appointments and staff capability already depend on them.
- Families are hidden and preserved temporarily, not renamed into service names.
- Packages are manager-only in v1.
- Package tasks are same-day only, but may be sequential, gapped, or parallel.
- Package price uses `price_override` when set; otherwise it snapshots the sum of included service prices at booking time.
- Catalog presets import services only; package templates are a later feature.
- Add-ons with no scope mean available everywhere.
