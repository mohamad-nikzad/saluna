---
id: BL-0047
title: Add manager-only package scheduling
status: done
type: feature
priority: high
size: large
created: 2026-06-30
updated: 2026-07-08
---

## Parent

[BL-0041 Service catalog big-bang migration](../ready/BL-0041-service-catalog-big-bang-migration.md)

## What to build

Let managers schedule a same-day Service Package by creating one package booking header and normal task Appointment rows for each package component, with all validations completed before anything is written.

## Acceptance Criteria

- [x] Package scheduling accepts one date and per-task staff, start, and end times.
- [x] Every package task validates staff package capability, component service capability, working hours, and scheduling conflicts before creation.
- [x] Package scheduling is transactional: if any task fails, no package booking, task row, or task Appointment is created.
- [x] Successful scheduling creates normal Appointment rows that appear in calendar, today, staff, and appointment detail read models with minimal package-specific branching.
- [x] Package booking snapshots store the package name and resolved price at scheduling time.
- [x] Package tasks do not support add-ons in v1.
- [x] API tests cover success, conflict rejection, invalid staff rejection, permission enforcement, and rollback on partial failure.

## Blocked by

- [BL-0046 Add Service Package setup and staff capabilities](BL-0046-add-service-package-setup.md)

## Notes

- Type: AFK.
- Source slice from `SERVICE_CATALOG_MIGRATION_PLAN.md`.
- Implemented with `/api/v1/service-packages/:id/bookings`, transactional package booking/task Appointment creation, package booking snapshots, add-on rejection for package tasks, PWA calendar package scheduling, and focused query/API tests.
