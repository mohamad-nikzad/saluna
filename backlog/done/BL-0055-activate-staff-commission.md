---
id: BL-0055
title: Activate Staff Commission for a regular Appointment
status: done
type: task
priority: medium
size: medium
parent: BL-0019
blocked_by: []
created: 2026-07-17
updated: 2026-07-17
---

## Parent

[BL-0019 Configure and report Staff Commissions](BL-0019-configure-and-report-staff-commissions.md)

## What to build

Give a manager the first complete Staff Commission workflow: activate a validated percentage Commission Agreement from a Staff Profile detail page, complete a regular Appointment after activation, and see the resulting commission and calculation basis on that staff member's detail page. Earlier completed Appointments must remain untouched.

## Acceptance Criteria

- [x] A manager can activate one percentage greater than 0 and at most 100, with up to two decimal places, for a Staff Profile in the current salon.
- [x] Staff and cross-salon requests cannot create or change the agreement.
- [x] An Appointment completed after activation produces at most one Staff Commission from `bookedTotalPrice`, rounded to the nearest toman.
- [x] Repeating the completion action is idempotent.
- [x] Appointments already completed before activation do not receive a Staff Commission.
- [x] The manager can see the active agreement and the new commission's Appointment, basis, percentage, and amount on the Staff Profile detail page.
- [x] External behavior is covered at the agreed database-integration, API authorization, and manager UI seams.

## Blocked by

None — can start immediately.

## Notes

- Closed 2026-07-17.
