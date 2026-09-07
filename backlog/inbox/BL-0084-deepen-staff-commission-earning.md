---
id: BL-0084
title: Deepen Staff Commission earning away from reports
status: inbox
type: task
triage: needs-triage
priority: medium
size: medium
blocked_by: []
created: 2026-08-31
updated: 2026-08-31
---

## Problem

`commission-queries.ts` mixes agreement CRUD, `syncAppointmentCommission` earning (void/exclude/override/rewrite), and (formerly) salon money reads. Pure Work Allocation math in salon-core is deep; earning policy bugs hide at the sync call site and are hard to test without the full report SQL surface.

## Smallest Useful Version

Pull Staff Commission earning (`syncAppointmentCommission` + package-aware basis lookup) into a deep earning module. Leave agreement CRUD and staff commission reports as separate modules. Salon Money Report already owns salon money aggregation (see CONTEXT).

## Acceptance Criteria

- [ ] Earning sync lives in a module whose interface is the earn/void/exclude/rewrite test surface.
- [ ] Agreement CRUD and per-staff commission reports do not own earning policy.
- [ ] Tests cover earning without salon money / Dashboard SQL.

## Notes

- From architecture review 2026-08-26 (candidate: Deepen Staff Commission earning; strength Worth exploring).
- Salon money collapse already shipped relative to BL-0078; this ticket is the earning-side deepen only.
- Files: `packages/database/src/internal/commission-queries.ts`, `appointment-commission-basis.ts`, `packages/salon-core/src/commissions.ts`.
