---
id: BL-0058
title: Add salon-wide commission reporting
status: done
type: task
priority: medium
size: medium
parent: BL-0019
blocked_by: [BL-0057]
created: 2026-07-17
updated: 2026-07-17
---

## Parent

[BL-0019 Configure and report Staff Commissions](BL-0019-configure-and-report-staff-commissions.md)

## What to build

Extend the approved period reporting into a manager-only salon view that explains how completed Appointment revenue is divided across Staff Commissions and the Salon Retained Amount, with per-staff filtering and drill-down.

## Acceptance Criteria

- [x] Managers can use every approved period and custom date range for the salon-wide report.
- [x] The summary shows gross eligible Appointment revenue, total Staff Commissions, and Salon Retained Amount as gross minus commissions.
- [x] Per-staff rows show gross eligible revenue, completed count, and Staff Commission total.
- [x] A manager can filter or drill down to the Appointment rows for one Staff Profile.
- [x] Labels do not describe gross revenue as collected payment or Salon Retained Amount as profit.
- [x] Staff and cross-salon requests are rejected server-side.
- [x] Report totals agree with the per-staff report for the same period and salon.

## Blocked by

- BL-0057

## Notes

- Closed 2026-07-17.
