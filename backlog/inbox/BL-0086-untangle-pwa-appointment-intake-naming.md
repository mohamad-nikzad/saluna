---
id: BL-0086
title: Untangle PWA create helpers from Appointment Intake
status: inbox
type: task
triage: needs-triage
priority: low
size: small
blocked_by: []
created: 2026-08-31
updated: 2026-08-31
---

## Problem

Domain **Appointment Intake** is the server validation gate. `apps/pwa/src/lib/appointment-intake.ts` reuses that name for create view-model and client submit checks. Multi-staff / Work Allocation rules also appear in salon-core form `superRefine` and manager requests UI. Navigators bounce on the wrong “intake,” and policy leaks across seams.

## Smallest Useful Version

Rename the PWA module so Appointment Intake means only the server gate. Keep client UX checks thin and shared Work Allocation helpers where they already live; do not pretend client refine is the gate.

## Acceptance Criteria

- [ ] No PWA module is named as Appointment Intake.
- [ ] CONTEXT / code comments treat Appointment Intake as the server gate only.
- [ ] Client-side multi-staff checks either share salon-core helpers or are clearly labeled as UX-only, not a second Intake.

## Notes

- From architecture review 2026-08-26 (candidate: Untangle client multi-staff policy; strength Speculative).
- Related: BL-0082 (real Intake deepen). Safe as a rename + comment pass without waiting on BL-0082.
