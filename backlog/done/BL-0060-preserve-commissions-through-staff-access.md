---
id: BL-0060
title: Preserve commissions through Staff Profile Access changes
status: done
type: task
priority: medium
size: medium
parent: BL-0019
blocked_by: [BL-0056, BL-0057]
created: 2026-07-17
updated: 2026-07-17
---

## Parent

[BL-0019 Configure and report Staff Commissions](BL-0019-configure-and-report-staff-commissions.md)

## What to build

Ensure commissions belong to the salon-owned Staff Profile across its access lifecycle. Managers can configure and accrue earnings for an unclaimed profile; the staff member sees that history after access is established, and loses the ability to read it when access is revoked without deleting the salon's records.

## Acceptance Criteria

- [x] A manager can activate an agreement for an unclaimed Staff Profile.
- [x] Eligible Appointments accrue Staff Commission while the profile has no login access.
- [x] After Staff Profile Access is established, the staff identity sees the profile's existing commission history.
- [x] Revoked or wrong-salon access cannot read the profile's agreement or report.
- [x] Revoking access does not delete the agreement, commissions, Appointments, or manager reporting history.
- [x] A disabled agreement's earlier earnings remain visible while Staff Profile Access remains active.
- [x] A multi-salon staff identity sees an independent agreement and history in each selected salon.
- [x] Database and API tests cover unclaimed, claimed, revoked, disabled, and cross-salon cases.

## Blocked by

- BL-0056
- BL-0057

## Notes

- Closed 2026-07-17.
