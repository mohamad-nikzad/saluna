---
id: BL-0057
title: Add period-based per-staff commission reporting
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

Provide one period-based per-staff commission report. Managers use it on the Staff Profile detail page; staff use a private self-reporting surface that cannot select another profile. Both actors see the same calculation for the same period.

## Acceptance Criteria

- [x] The report supports today in Tehran, the Saturday-to-Friday current week, the current Jalali month, and an inclusive custom date range.
- [x] Period membership follows the Appointment service date rather than the time completion was recorded.
- [x] The summary shows completed count, gross eligible Appointment revenue, and Staff Commission total.
- [x] Rows show Appointment date, Client, service, authoritative or allocated basis, applied percentage, and Staff Commission.
- [x] A manager can read the report for a Staff Profile in their salon from its detail page.
- [x] A staff member with active Staff Profile Access can read only their own report and active agreement state.
- [x] Staff cannot request another profile's report, another salon's data, or Salon Retained Amount.
- [x] The agreed Playwright flow covers manager reporting and staff self-reporting, with API authorization tests for rejected access.

## Blocked by

- BL-0055

## Notes

- Closed 2026-07-17.
