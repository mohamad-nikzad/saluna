---
id: BL-0082
title: Deepen Appointment Intake into trusted persist
status: inbox
type: task
triage: needs-triage
priority: high
size: large
blocked_by: []
created: 2026-08-31
updated: 2026-08-31
---

## Problem

Appointment Intake builds a validated command, then `createAppointment` / `updateAppointment` duplicate `AppointmentCommand` / `SnapshotKeys` types and re-validate Work Allocation and add-ons. Multi-staff persistence bugs hide in call-site orchestration; assignment writes are barely tested through the persist path.

## Smallest Useful Version

One deep path: Appointment Intake produces a command the persist module trusts — no second policy pass for Work Allocation / add-ons. Tests hit that interface for create and update with assignments.

## Acceptance Criteria

- [ ] Validated create/update commands are not re-validated for the same Work Allocation and add-on policy on persist.
- [ ] Duplicated command/snapshot type blocks across Intake and queries are gone or shared once.
- [ ] Tests cover assignment writes through the Intake → persist path (including multi-staff and allocation-only updates).

## Notes

- From architecture review 2026-08-26 (candidate: Deepen Appointment Intake → persist; strength Strong).
- Files: `packages/database/src/internal/appointment-intake.ts`, `appointment-queries.ts`, `apps/api/src/routes/appointments.ts`.
- Domain term Appointment Intake stays the server validation gate (see BL-0086 for PWA naming clash).
- May pair with BL-0081; can land first if scoped to command trust without full roster deepen.
