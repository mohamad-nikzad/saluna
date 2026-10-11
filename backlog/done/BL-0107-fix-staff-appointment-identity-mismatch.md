---
id: BL-0107
title: Fix staff Appointment visibility and repair identity mismatches
status: done
type: task
triage: ready-for-agent
priority: high
size: large
blocked_by: []
created: 2026-10-11
updated: 2026-10-12
---

## Problem

A manager at آراویرا reported that a newly invited staff member could log in but could not see assigned work. Production inspection confirmed an Appointment Staff Assignment stored against the login identity ID while staff authorization filters by the different Staff Profile ID. The Appointment exists and is confirmed, but the staff Today and calendar queries exclude it. Reauthentication cannot correct the stored mismatch.

This is an urgent production defect in the core scheduling workflow. The same inconsistent identifiers can affect Appointment detail access, staff status actions, conflicts, notifications, and Staff Commissions. Those additional effects require verification; the incident directly confirms missing Appointment visibility.

## Smallest Useful Version

Use the salon-owned Staff Profile ID consistently for Appointment Staff Assignments and operational staff references. Keep the login identity ID separate for authentication and notification delivery through active Staff Profile Access. Align manager selection, Appointment Intake, persistence, reads, and access lifecycle operations so accepting or revoking access never changes the operational identity of assigned work.

Repair existing identity-keyed records through a repeatable, salon-scoped mapping to their Staff Profiles. Audit all affected salons rather than hardcoding only this incident. Include service capabilities, schedules, and related request/package references where needed to keep the corrected Appointment workflows functional. Preserve manager scheduling and legacy records through an explicit compatibility or backfill path.

Do not fix visibility by removing authorization filters or granting access to every Appointment in a salon. Follow [ADR-0006](../../docs/adr/0006-separate-staff-profiles-from-login-identities.md) and [ADR-0039](../../docs/adr/0039-appointment-staff-assignments-are-sole-roster.md).

## Acceptance Criteria

- [x] A manager can invite a new staff member, the member can accept and log in, and the manager can assign a new Appointment after acceptance. The persisted assignment uses the Staff Profile ID, and the member sees it in Today, calendar, list, and detail through the real API.
- [x] Appointments created before invite acceptance remain visible after acceptance. Acceptance, revocation, departure, and later access acceptance preserve assignment ownership and operational history. Revoked identities lose access immediately; the currently accepted identity gains only its assigned work.
- [x] Assignment changes and lead/additional Staff Profiles use the same identifiers across manager forms, Appointment Intake, request approval/conversion, and Package Tasks. Unclaimed Staff Profiles and managers who perform services remain schedulable through an explicit supported mapping.
- [x] Service capability checks, schedules, availability, conflict checks, roster display, and notifications resolve the same salon-owned Staff Profile. Notification delivery resolves the current accepted login identity without changing stored assignments.
- [x] Staff status actions and Staff Commissions work for corrected assignments. Repair preserves assignment IDs, lead roles, Work Allocations, exclusion flags, status history, and earned commission snapshots without duplicating or recalculating historical earnings.
- [x] Cross-salon isolation, unassigned staff rejection, revoked access, and Client privacy remain enforced. An identity with access in two salons cannot use a login ID or a Staff Profile from one salon to read or modify the other salon's work.
- [x] A read-only audit and idempotent repair cover existing login-ID references using salon-scoped, unambiguous Staff Profile mappings. Ambiguous, missing, or conflicting mappings are reported rather than guessed. The repair includes a recovery point and before/after counts, preserves unrelated records, and changes nothing on a second run.
- [x] Regression coverage reproduces the production sequence through persisted invite acceptance and manager Appointment creation with different login/profile UUIDs, then checks staff reads and status writes. Include pre-acceptance Appointments, access revocation/reacceptance, multiple salons, and repair reruns against Postgres. Fixture-only tests with equal IDs are insufficient.
- [x] Production rollout and data repair are verified for the incident Appointment and the audit's other affected records. Record deployed versions, repaired counts, unresolved mappings, and staff visibility evidence before marking this task complete.

## Production evidence

Read-only inspection on 2026-10-11 found the following on the running production database and API bundle:

| Record               | Observed value                                                              |
| -------------------- | --------------------------------------------------------------------------- |
| Salon                | آراویرا, slug `aravirabeautylounge`                                         |
| Salon ID             | `2f472012-a882-47c0-ad71-7b611a335ebe`                                      |
| Staff Profile        | فهیمه گلزار, phone ending `5276`, active                                    |
| Staff Profile ID     | `76b0e65c-f525-43fd-ae10-c469166e831d`                                      |
| Login identity ID    | `69c947d3-fa3d-4063-9e98-3abfa1321b93`                                      |
| Staff Profile Access | Active, accepted at 18:44:50 Asia/Tehran on 2026-10-11                      |
| Service capabilities | Nine active ServiceVariants saved against the login identity ID             |
| Appointment ID       | `0522b892-6622-4123-84a6-dafbdd34e03c`                                      |
| Appointment          | اسکراب اسکالپ, 2026-10-11, 18:00–18:55 Asia/Tehran, confirmed               |
| Assignment           | Lead assignment uses the login identity ID; none uses this Staff Profile ID |
| Creation             | Appointment created at 18:47:46 Asia/Tehran, after invite acceptance        |
| Running versions     | API `0.13.1-2792fca`, PWA `0.14.2-2792fca`                                  |

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
- Coordinate changes to the staff service editor with [BL-0106](../ready/BL-0106-search-and-bulk-select-staff-services.md). That UI improvement does not block this production fix.

## Completion evidence, 2026-10-12

Scheduling now uses Staff Profile IDs for claimed and unclaimed staff and for managers who perform services. The directory exposes `loginUserId` separately. Invite acceptance, legacy claim, revocation, departure, and reacceptance no longer remap operational records. Workspace creation and handoff create distinct manager profiles. Salon contact edits update the profile without changing verified login credentials. Authentication keeps the login ID and exposes the accepted Staff Profile separately.

The repair covers all seven operational reference tables, requires a saved recovery report before applying, and reports ownership or uniqueness conflicts without guessing. See [the repair runbook](../../docs/STAFF_IDENTITY_REPAIR.md).

### Release and validation

- Source commit: [`42dc49af`](https://github.com/mohamad-nikzad/saluna/commit/42dc49af63c39d91433fc1b1f2eb62a861c8213a).
- [GitHub CI](https://github.com/mohamad-nikzad/saluna/actions/runs/38172472964) passed, including the eight real Postgres API regressions added to CI.
- [Production image builds](https://github.com/mohamad-nikzad/saluna/actions/runs/38172473053) passed.
- [API deployment](https://github.com/mohamad-nikzad/saluna/actions/runs/38172826011) and [PWA deployment](https://github.com/mohamad-nikzad/saluna/actions/runs/38173057590) both passed through the existing GitHub Actions production workflow.
- API `0.13.2-42dc49a`, GHCR digest `sha256:700694e847fe2757cfb1db8cbac019544b03271eb99e5c17448cb441f7d41326`.
- PWA `0.14.3-42dc49a`, GHCR digest `sha256:860f310f13db000e4aef1bed48741a0462c53902014d2ee9f926dfab6373fed4`.
- Local validation passed 521 API unit tests, 174 database unit tests, 31 database integration tests, 225 PWA tests, and eight staff identity API integration tests. API, database, and PWA typechecks passed. API and database boundary checks passed; PWA lint had existing warnings and no errors.
- The repair was rehearsed on a restored production dump and verified in Linux Node 22.16 and Nginx containers before rollout. Local image deployment was abandoned before any production deployment or database mutation; the shipped images came from GitHub Actions.

### Live repair

The all-salon audit found broken references in one salon. The transaction repaired 46 rows and backfilled four legacy membership profiles.

| Table                           | Noncanonical references before | After |
| ------------------------------- | -----------------------------: | ----: |
| `appointment_staff_assignments` |                             24 |     0 |
| `staff_services`                |                             22 |     0 |
| `staff_schedules`               |                              0 |     0 |
| `staff_package_capabilities`    |                              0 |     0 |
| `appointment_requests`          |                              0 |     0 |
| `service_package_tasks`         |                              0 |     0 |
| `service_package_bookings`      |                              0 |     0 |

Preservation hashes matched across 13 tables, omitting only the intentionally repaired staff reference columns. This confirms assignment IDs, lead flags, allocations, exclusion flags, timestamps, Appointment and request fields, status history, earned commissions, agreements, overrides, and Client records retained their values. The second apply created zero profiles and had an empty recovery row list.

Fresh backups and recovery reports are protected under `/opt/saluna/backups/bl0107` and copied off the VPS to the operator's private `.codex/private/saluna-bl0107/live` directory. Names, phones, session tokens, and full recovery rows remain outside Git.

### Staff visibility

Using the incident staff member's existing persisted session, before repair Today and calendar/list returned no Appointments and detail returned `403`. After deployment and repair, all three endpoints returned `200` and included Appointment `0522b892-6622-4123-84a6-dafbdd34e03c` for 2026-10-11. Client phone and notes remained absent. Every returned Appointment included the expected Staff Profile assignment.

Assignment `2f71d1f4-8ad3-4dc1-a737-c8b70a47d3be` now references Staff Profile `76b0e65c-f525-43fd-ae10-c469166e831d`, with its original lead role and allocation `10000`. Staff and manager `/auth/me` retained their login IDs and returned ready. The incident Staff Profile has all nine service capabilities. Both containers and the public API/PWA health endpoints passed after rollout.

### Unresolved legacy memberships

These two memberships have no broken operational references. The audit could not establish profile ownership because a phone is missing or belongs to another existing profile. They need explicit ownership evidence before backfill or linkage; the repair left them untouched.

| Salon ID                               | Login identity ID                      |
| -------------------------------------- | -------------------------------------- |
| `5beb2ef1-441c-4474-b507-8664f02b4f39` | `ac25a452-e986-442f-8c82-8a41623d300d` |
| `6a46010a-e15d-482a-a3f3-7758d7723447` | `ab27eaec-7ae5-4cc0-80e5-c0fe10dc352c` |
