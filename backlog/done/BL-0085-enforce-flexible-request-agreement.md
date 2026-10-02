---
id: BL-0085
title: Enforce Flexible AppointmentRequest agreement on convert
status: done
type: task
triage: needs-triage
priority: medium
size: small
blocked_by: []
created: 2026-08-31
updated: 2026-09-07
---

## Problem

CONTEXT says only current/future acceptable dates remain schedulable for a Flexible AppointmentRequest. `convertFlexibleAppointmentRequest` only runs Request Horizon via `normalizeAcceptableDates` and Time Preference checks — it does not require `finalDate` to be in the request’s acceptable dates. A test currently locks allowing a horizon date that was never listed. Pure timing helpers are deep; the agreement bug has no locality at the convert call site.

## Smallest Useful Version

One interface for “may this `finalDate` / start time be scheduled for this Flexible AppointmentRequest?” covering horizon, acceptable dates, and Time Preference, called before Appointment Intake on convert.

## Acceptance Criteria

- [x] Convert rejects a `finalDate` that is not an acceptable date for that pending Flexible AppointmentRequest (subject to current/future rule in CONTEXT).
- [x] Time Preference and Request Horizon checks stay next to that agreement check.
- [x] Tests assert membership in acceptable dates; the old “any horizon date” lock is removed or inverted.

## Notes

- From architecture review 2026-08-26 (candidate: Deepen Flexible agreement; strength Worth exploring).
- Files: `packages/salon-core/src/appointment-request-timing.ts`, `packages/database/src/internal/appointment-request-queries.ts` (+ tests).
- Pairs naturally with BL-0083; can ship alone if convert still has two pipelines.

## Implementation comment

- Added `flexibleRequestAgreementError` to check the selected date against the saved acceptable dates, inclusive Request Horizon, and saved Time Preference before Appointment Intake. Existing date/time error responses are preserved.
- Elapsed acceptable dates remain history and do not prevent scheduling a remaining acceptable date. Elapsed dates themselves cannot be scheduled.
- Inverted the old unlisted-date test. It failed before the fix because conversion created an Appointment instead of returning 400; it passes after the fix and verifies Intake and writes are skipped.
- Added boundary coverage and a Postgres regression proving an unlisted date leaves the request pending, preserves acceptable dates, and creates no Appointment.
- Verified 333 salon-core unit tests, 15 AppointmentRequest query unit tests, and 7 Postgres conversion integration tests. Both package typechecks and changed-file ESLint passed.

Verification commands:

```sh
pnpm --filter @repo/salon-core test:unit
pnpm --filter @repo/database test:unit src/internal/appointment-request-queries.test.ts
pnpm --filter @repo/database test:integration src/internal/appointment-request-queries.integration.test.ts
pnpm --filter @repo/salon-core --filter @repo/database typecheck
```
