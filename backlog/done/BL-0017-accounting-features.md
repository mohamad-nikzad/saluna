---
id: BL-0017
title: Accounting features
status: done
type: feature
priority: medium
size: large
created: 2026-06-13
updated: 2026-09-07
---

## Problem

Salons may need financial tracking beyond appointment totals, such as income, expenses, settlement, or reports.

## Smallest Useful Version

Choose the first accounting workflow instead of building a broad accounting module.

## Acceptance Criteria

- [x] First accounting use case is selected.
- [x] Required financial records are named.
- [x] Relationship to appointments and payments is documented.

## Notes

- Original note: "Add accounting features".
- Related: BL-0019 staff and salon income cuts.

## Completion review

Status reviewed on 2026-09-07. The first workflow is the Salon Money Report, completed under BL-0078 in commit `f85c709`, alongside Staff Commission reporting from BL-0019. `CONTEXT.md` names AppointmentTotalsSnapshot, Staff Commission, Eligible Commission Basis, and Salon Retained Amount and documents their relationship. ADR-0023 separates Client Payments from booked totals. This closes the selection/documentation scope of this item; expenses, collected-payment accounting, and settlement are not implemented by that report.
