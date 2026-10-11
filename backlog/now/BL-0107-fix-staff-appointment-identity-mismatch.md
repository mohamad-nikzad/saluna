---
id: BL-0107
title: Fix staff Appointment visibility and repair identity mismatches
status: now
type: task
triage: ready-for-agent
priority: high
size: large
blocked_by: []
created: 2026-10-11
updated: 2026-10-11
---

## Problem

A manager at آراویرا reported that a newly invited staff member could log in but could not see assigned work. Production inspection confirmed an Appointment Staff Assignment stored against the login identity ID while staff authorization filters by the different Staff Profile ID. The Appointment exists and is confirmed, but the staff Today and calendar queries exclude it. Reauthentication cannot correct the stored mismatch.

This is an urgent production defect in the core scheduling workflow. The same inconsistent identifiers can affect Appointment detail access, staff status actions, conflicts, notifications, and Staff Commissions. Those additional effects require verification; the incident directly confirms missing Appointment visibility.

## Smallest Useful Version

Use the salon-owned Staff Profile ID consistently for Appointment Staff Assignments and operational staff references. Keep the login identity ID separate for authentication and notification delivery through active Staff Profile Access. Align manager selection, Appointment Intake, persistence, reads, and access lifecycle operations so accepting or revoking access never changes the operational identity of assigned work.

Repair existing identity-keyed records through a repeatable, salon-scoped mapping to their Staff Profiles. Audit all affected salons rather than hardcoding only this incident. Include service capabilities, schedules, and related request/package references where needed to keep the corrected Appointment workflows functional. Preserve manager scheduling and legacy records through an explicit compatibility or backfill path.

Do not fix visibility by removing authorization filters or granting access to every Appointment in a salon. Follow [ADR-0006](../../docs/adr/0006-separate-staff-profiles-from-login-identities.md) and [ADR-0039](../../docs/adr/0039-appointment-staff-assignments-are-sole-roster.md).

## Acceptance Criteria

- [ ] A manager can invite a new staff member, the member can accept and log in, and the manager can assign a new Appointment after acceptance. The persisted assignment uses the Staff Profile ID, and the member sees it in Today, calendar, list, and detail through the real API.
- [ ] Appointments created before invite acceptance remain visible after acceptance. Acceptance, revocation, departure, and later access acceptance preserve assignment ownership and operational history. Revoked identities lose access immediately; the currently accepted identity gains only its assigned work.
- [ ] Assignment changes and lead/additional Staff Profiles use the same identifiers across manager forms, Appointment Intake, request approval/conversion, and Package Tasks. Unclaimed Staff Profiles and managers who perform services remain schedulable through an explicit supported mapping.
- [ ] Service capability checks, schedules, availability, conflict checks, roster display, and notifications resolve the same salon-owned Staff Profile. Notification delivery resolves the current accepted login identity without changing stored assignments.
- [ ] Staff status actions and Staff Commissions work for corrected assignments. Repair preserves assignment IDs, lead roles, Work Allocations, exclusion flags, status history, and earned commission snapshots without duplicating or recalculating historical earnings.
- [ ] Cross-salon isolation, unassigned staff rejection, revoked access, and Client privacy remain enforced. An identity with access in two salons cannot use a login ID or a Staff Profile from one salon to read or modify the other salon's work.
- [ ] A read-only audit and idempotent repair cover existing login-ID references using salon-scoped, unambiguous Staff Profile mappings. Ambiguous, missing, or conflicting mappings are reported rather than guessed. The repair includes a recovery point and before/after counts, preserves unrelated records, and changes nothing on a second run.
- [ ] Regression coverage reproduces the production sequence through persisted invite acceptance and manager Appointment creation with different login/profile UUIDs, then checks staff reads and status writes. Include pre-acceptance Appointments, access revocation/reacceptance, multiple salons, and repair reruns against Postgres. Fixture-only tests with equal IDs are insufficient.
- [ ] Production rollout and data repair are verified for the incident Appointment and the audit's other affected records. Record deployed versions, repaired counts, unresolved mappings, and staff visibility evidence before marking this task complete.

## Production evidence

Read-only inspection on 2026-10-11 found the following on the running production database and API bundle:

| Record | Observed value |
| --- | --- |
| Salon | آراویرا, slug `aravirabeautylounge` |
| Salon ID | `2f472012-a882-47c0-ad71-7b611a335ebe` |
| Staff Profile | فهیمه گلزار, phone ending `5276`, active |
| Staff Profile ID | `76b0e65c-f525-43fd-ae10-c469166e831d` |
| Login identity ID | `69c947d3-fa3d-4063-9e98-3abfa1321b93` |
| Staff Profile Access | Active, accepted at 18:44:50 Asia/Tehran on 2026-10-11 |
| Service capabilities | Nine active ServiceVariants saved against the login identity ID |
| Appointment ID | `0522b892-6622-4123-84a6-dafbdd34e03c` |
| Appointment | اسکراب اسکالپ, 2026-10-11, 18:00–18:55 Asia/Tehran, confirmed |
| Assignment | Lead assignment uses the login identity ID; none uses this Staff Profile ID |
| Creation | Appointment created at 18:47:46 Asia/Tehran, after invite acceptance |
| Running versions | API `0.13.1-2792fca`, PWA `0.14.2-2792fca` |

The query found one Appointment assigned to this login identity and zero assigned to its Staff Profile. The staff filter in the deployed bundle matches only `tenant.staffProfileId`. Login, accepted access, active membership, and saved service capabilities were all present.

## Implementation starting points

- `packages/database/src/internal/row-mappers.ts`: `staffUserSelect.id` is the login identity ID for claimed staff.
- `packages/database/src/internal/staff-queries.ts`: `getAllStaff` returns login IDs for claimed staff and profile IDs for unclaimed staff; capabilities and schedules follow those mixed IDs.
- `packages/database/src/internal/user-queries.ts`: claimed Staff Profile IDs are not resolved by the prepared-profile fallback; reconcile callers when introducing consistent profile IDs.
- `packages/database/src/internal/appointment-intake.ts` and `appointment-roster-queries.ts`: validate and persist the manager's selected identifiers.
- `packages/database/src/staff-invite-acceptance.ts`: acceptance remaps assignment IDs from the Staff Profile to the login identity. Review `setup-staff.ts` claim behavior and reverse remapping in `staff-access-revocation.ts` as part of the same fix.
- `packages/auth/src/tenant.ts`, `apps/api/src/routes/today.ts`, and `apps/api/src/routes/appointments.ts`: staff reads and actions require Staff Profile IDs from active access.
- Trace commission profile resolution, request approval, package scheduling, API contracts, PWA staff selection, and notification recipient resolution before choosing the migration boundary.

## Notes

- Requested as urgent follow-up to the live production investigation. This task records the fix and data-repair work; the investigation made no production changes.
- Related completed work: [BL-0016](../done/BL-0016-staff-can-join-multiple-salons.md), [BL-0060](../done/BL-0060-preserve-commissions-through-staff-access.md), [BL-0081](../done/BL-0081-deepen-appointment-staff-assignment.md), and [BL-0091](../done/BL-0091-staff-appointment-status-and-client-privacy.md).
- Coordinate changes to the staff service editor with [BL-0106](BL-0106-search-and-bulk-select-staff-services.md). That UI improvement does not block this production fix.
