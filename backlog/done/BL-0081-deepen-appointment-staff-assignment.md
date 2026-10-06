---
id: BL-0081
title: Deepen Appointment Staff Assignment as one roster truth
status: done
type: task
triage: ready-for-agent
priority: high
size: large
blocked_by: []
created: 2026-08-31
updated: 2026-08-31
---

## Problem

Multi-staff layered `appointment_staff_assignments` on top of the legacy lead `appointments.staffId`. Reads, filters, conflicts, availability, and Staff Commission sync each carry dual-representation glue (`legacy:` synthetic rows, `staffIdCondition`, join remaps). Understanding who is on an Appointment means bouncing across schema, attach, Intake, queries, availability, and commission paths.

## Smallest Useful Version

One release cutover (ADR-0039): drop `appointments.staff_id`, own roster through one database seam + salon-core invariants, and make Appointment create/update (and request approve) speak `staffAssignments[]` only.

## Acceptance Criteria

- [x] `appointments.staff_id` is removed after orphan backfill; every Appointment (including package task rows) has assignment rows written on create.
- [x] A database roster seam is the only SQL read/write path for lead, extras, and Work Allocation; salon-core owns roster types/invariants (exactly one lead, unique staff ids, allocations sum to 10000).
- [x] Calendar filter/conflict/availability paths and Staff Commission earn use that seam; no `legacy:` synthetic assignment rows; empty roster hard-fails (including commission sync).
- [x] Appointment API/forms: no top-level `staffId`; writes use `staffAssignments[]` (`staffId`, `isLead`, `allocationBasisPoints`); omit on update leaves roster unchanged; full replace when sent. Reads may keep derived nested lead `staff` for display.
- [x] Staff-scoped calendar UI shows an Appointment under every assignee, not only the lead.
- [x] AppointmentRequest pending/draft may keep its own `staffId`; only approve → Appointment adopts `staffAssignments[]`.
- [x] Profile remap/claim/revoke paths update assignment `staff_id` (not a dropped appointment lead column).
- [x] GLOSSARY.md and ADR-0039 reflect the decision; automated tests cover multi-staff create/update persistence through the seam.
- [x] Lands as one PR (stacked commits OK).

## Notes

- From architecture review 2026-08-26 (candidate: Deepen Appointment Staff Assignment; strength Strong). Related: BL-0076, BL-0082.
- Grill 2026-08-31 settled: drop column in-ticket (not dual-write period); empty roster = corruption; API break to assignments-only writes; keep derived nested lead `staff`; single cutover; salon-core + database split; hard fail on empty; fan-out UI under every assignee; update = full replace when sent; ADR + CONTEXT; implement later as AFK agent.
- Equal split stays a client/UI helper that fills `allocationBasisPoints` before submit; the wire requires complete allocations.
- Hot paths to rewire: `appointment-queries.ts`, intake, availability/public/today, commission sync, package booking insert, dashboard/admin joins, setup-staff / invite / revocation remaps, OpenAPI + PWA forms, concurrent/calendar grouping.
