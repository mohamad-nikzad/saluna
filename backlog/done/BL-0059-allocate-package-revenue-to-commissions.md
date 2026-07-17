---
id: BL-0059
title: Allocate Service Package revenue to Staff Commissions
status: done
type: task
priority: medium
size: medium
parent: BL-0019
blocked_by: [BL-0055]
created: 2026-07-17
updated: 2026-07-17
---

## Parent

[BL-0019 Configure and report Staff Commissions](BL-0019-configure-and-report-staff-commissions.md)

## What to build

Make Service Package task Appointments earn Staff Commission from their proportional share of the package's actual booked price instead of their undiscounted service prices. Each assigned Staff Profile earns independently as their task is completed.

## Acceptance Criteria

- [x] The booked package price is allocated proportionally using task Appointments' booked service prices.
- [x] Toman rounding and deterministic remainder distribution make task allocations sum exactly to the booked package price.
- [x] Completing a package task produces commission from that task's allocated amount and assigned Staff Profile agreement.
- [x] Completing, voiding, restoring, or price-correcting one task does not duplicate or misassign another task's commission.
- [x] A package with multiple staff reports the same allocations and commissions in per-staff and salon-wide reads.
- [x] Database integration tests cover discounts, overridden package prices, unequal task prices, multiple staff, and rounding remainders.

## Blocked by

- BL-0055

## Notes

- Closed 2026-07-17.
