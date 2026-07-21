---
id: BL-0062
title: Record and list manager Drafts
status: ready
type: task
triage: ready-for-agent
priority: medium
size: medium
parent: BL-0061
blocked_by: []
created: 2026-07-21
updated: 2026-07-21
---

## Parent

[BL-0061 Capture flexible AppointmentRequests as manager drafts](BL-0061-plan-flexible-appointment-requests.md)

## What to Build

Deliver the first complete manager Draft path: a manager can open Requests, create a pending Flexible AppointmentRequest for a Client and ServiceVariant, and immediately see it in a new Drafts tab without placing anything on a staff calendar.

Expand AppointmentRequest compatibly so exact public requests and manager-recorded flexible requests remain one aggregate while preserving the existing public contract. Bind the ServiceVariant snapshot when the Draft is created and expose the new manager behavior through the authenticated contract and generated client.

## Acceptance Criteria

- [ ] A manager can create a Draft from Requests by selecting or creating a Client, selecting one active ServiceVariant, entering at least one acceptable date, choosing one Time Preference, and optionally adding notes.
- [ ] The saved Draft is a pending Flexible AppointmentRequest with a bound BookedServiceSnapshot and a required Client relationship.
- [ ] The Draft appears in a new manager-only Drafts tab with its Client, service snapshot, acceptable dates, Time Preference, and notes.
- [ ] “Draft” introduces no new aggregate, lifecycle state, or calendar record.
- [ ] Flexible input rejects missing Client, missing or inactive ServiceVariant, empty dates, invalid Time Preference, and payloads containing both exact and flexible timing.
- [ ] Staff and unauthenticated users cannot create or list manager Drafts, and tenant scope prevents cross-salon access.
- [ ] A pending Draft neither appears on staff calendars nor blocks overlapping Appointment availability.
- [ ] Existing exact public request submission, status, cancellation, and approval behavior remains green.

## Blocked By

None — can start immediately.

## Notes

- Follow ADR-0014 for the shared AppointmentRequest aggregate and ADR-0002 for the no-hold invariant.
- Expand the existing model compatibly; a separate prefactor or migration-only ticket is unnecessary.
