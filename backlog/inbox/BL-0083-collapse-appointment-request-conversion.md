---
id: BL-0083
title: Collapse AppointmentRequest conversion through Intake
status: inbox
type: task
triage: needs-triage
priority: high
size: medium
blocked_by: []
created: 2026-08-31
updated: 2026-08-31
---

## Problem

`approveAppointmentRequest` and `convertFlexibleAppointmentRequest` are near-twin pipelines (Intake → create → flip request) with divergent transaction semantics. Approve can leave an orphan Appointment on a lost status race; convert wraps flip+create in a transaction. Notification payloads are copy-pasted. ADR-0001/0014 already say conversion goes through Appointment Intake — the code has two shallow paths.

## Smallest Useful Version

One deep conversion module: shared Intake + create + flip; exact vs flexible only differ at preconditions. One transactional failure mode; one notification shape.

## Acceptance Criteria

- [ ] Exact approve and Flexible convert share one conversion path through Appointment Intake.
- [ ] Lost-race / concurrent close cannot leave an orphan Appointment on the calendar.
- [ ] Notification payload construction is not duplicated across the two call sites.
- [ ] Tests cover both exact and Flexible conversion and the race/orphan case.

## Notes

- From architecture review 2026-08-26 (candidate: Collapse AppointmentRequest → Appointment conversion; strength Strong).
- Respect ADR-0001 and ADR-0014: AppointmentRequest stays distinct; conversion still uses Appointment Intake.
- Files: `packages/database/src/internal/appointment-request-queries.ts`.
- Related: BL-0085 (Flexible acceptable-date agreement), BL-0064.
