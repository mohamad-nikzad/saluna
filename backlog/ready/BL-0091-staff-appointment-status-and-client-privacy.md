---
id: BL-0091
title: Let staff update assigned Appointment status while protecting Client details
status: ready
type: task
triage: ready-for-agent
priority: high
size: medium
blocked_by: []
created: 2026-10-05
updated: 2026-10-05
---

## Problem

A salon manager wants staff to record the progress of their assigned Appointments without exposing Client phone numbers and other private information. Staff need enough information to perform the service, while managers retain control of Client contact and booking changes.

The API already permits assigned staff to set `confirmed`, `completed`, and `no-show`, and the PWA has a staff status mutation. The work therefore includes checking and improving the visibility of those actions, tightening transition permissions, and protecting Client data. The Appointment detail endpoint currently returns the Client record to assigned staff, so hiding fields only in the UI would leave them accessible.

## Smallest Useful Version

Use one default staff policy. Staff with active Staff Profile Access can view their assigned Appointments and record `confirmed`, `completed`, or `no-show` through clear actions in their Appointment screens. On an Appointment with multiple staff, only the lead may mark the whole Appointment `completed`; other assigned staff may confirm it or record a no-show.

Managers retain cancellation, rescheduling, price changes, and corrections to completed or otherwise closed Appointments. Persist who changed a status, the previous and new status, and when it happened. Managers can inspect that history, including corrections that affect Staff Commissions.

Staff see the Client name, booked service, scheduled time, and Appointment instructions needed to perform the service. Client phone numbers, private Client notes, and unrelated Client history remain manager-only. Enforce this in server responses as well as the UI. Staff who need to contact a Client ask a manager in this first version.

## Acceptance Criteria

- [ ] Staff can find and use permitted status actions from their assigned Appointment screens, with Persian labels, saving feedback, and a clear error if a write fails.
- [ ] The API accepts only status-only writes from staff with active access to a Staff Profile assigned to that Appointment in the current salon. Staff cannot mutate unassigned Appointments or Appointments in another salon.
- [ ] Assigned staff may set `confirmed` or `no-show` on an open Appointment. Only its lead Staff Profile may set `completed`; the sole assignment on a single-staff Appointment is its lead.
- [ ] Staff cannot reopen or change an Appointment already marked `completed`, `cancelled`, or `no-show`. Managers retain status correction through existing manager workflows.
- [ ] Staff cannot cancel, reschedule, change Client or staff assignments, change services, or change prices, including by adding those fields to a status request.
- [ ] Every successful status transition records the authenticated actor, salon, Appointment, previous status, new status, and timestamp. Managers can view the history; corrections preserve earlier entries. Failed writes and requests that leave status unchanged do not create transition entries.
- [ ] Completion and manager correction preserve the existing Staff Commission lifecycle for every assignment. Repeated submissions do not duplicate commissions or status history.
- [ ] Staff Appointment lists and detail views show the Client name, booked service, time, and relevant Appointment instructions without phone numbers, private Client notes, or unrelated Client history.
- [ ] Staff API responses omit protected Client data across Appointment lists, details, status mutation responses, and any other staff-accessible Client read paths. Direct requests cannot retrieve those fields through manager Client endpoints, search, or exports.
- [ ] Manager access to Client details and operational workflows remains available. Staff privacy follows the role in the current salon when a person has access to several salons.
- [ ] Regression coverage exercises assigned and unassigned staff, revoked access, salon isolation, lead and additional staff, closed-status corrections, audit history, commission consistency, and protected fields in actual API responses. Include a staff UI journey that completes an assigned Appointment without displaying Client contact details.

## Notes

- Approved on 2026-10-05 following manager feedback and discussion of staff autonomy and Client privacy.
- Follow [ADR-0006](../../docs/adr/0006-separate-staff-profiles-from-login-identities.md) for revocable Staff Profile Access and [ADR-0039](../../docs/adr/0039-appointment-staff-assignments-are-sole-roster.md) for assignment and lead authority.
- Relevant implementation includes `apps/api/src/routes/appointments.ts`, `packages/database/src/internal/appointment-queries.ts`, `apps/pwa/src/lib/use-staff-today-status-mutation.ts`, and staff Appointment list/detail components. Review other staff read paths and API contracts during implementation.
- Related work: [BL-0076](BL-0076-allow-multiple-staff-on-appointment.md) and [BL-0056](../done/BL-0056-correct-staff-commission-lifecycle.md).
- Per-salon permission switches, staff access to phone numbers, and a new manager-contact request workflow are outside this first version.
