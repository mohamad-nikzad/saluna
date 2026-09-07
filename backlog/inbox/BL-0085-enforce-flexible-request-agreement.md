---
id: BL-0085
title: Enforce Flexible AppointmentRequest agreement on convert
status: inbox
type: task
triage: needs-triage
priority: medium
size: small
blocked_by: []
created: 2026-08-31
updated: 2026-08-31
---

## Problem

CONTEXT says only current/future acceptable dates remain schedulable for a Flexible AppointmentRequest. `convertFlexibleAppointmentRequest` only runs Request Horizon via `normalizeAcceptableDates` and Time Preference checks — it does not require `finalDate` to be in the request’s acceptable dates. A test currently locks allowing a horizon date that was never listed. Pure timing helpers are deep; the agreement bug has no locality at the convert call site.

## Smallest Useful Version

One interface for “may this `finalDate` / start time be scheduled for this Flexible AppointmentRequest?” covering horizon, acceptable dates, and Time Preference, called before Appointment Intake on convert.

## Acceptance Criteria

- [ ] Convert rejects a `finalDate` that is not an acceptable date for that pending Flexible AppointmentRequest (subject to current/future rule in CONTEXT).
- [ ] Time Preference and Request Horizon checks stay next to that agreement check.
- [ ] Tests assert membership in acceptable dates; the old “any horizon date” lock is removed or inverted.

## Notes

- From architecture review 2026-08-26 (candidate: Deepen Flexible agreement; strength Worth exploring).
- Files: `packages/salon-core/src/appointment-request-timing.ts`, `packages/database/src/internal/appointment-request-queries.ts` (+ tests).
- Pairs naturally with BL-0083; can ship alone if convert still has two pipelines.
