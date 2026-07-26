---
id: BL-0068
title: Let managers make one date unavailable
status: inbox
type: feature
triage: needs-triage
priority: medium
size: medium
blocked_by: []
created: 2026-07-26
updated: 2026-07-26
---

## Problem

A salon may be open on a weekday normally but unable to offer services on one specific date. Changing Salon Working Days would incorrectly close that weekday every week.

## Smallest Useful Version

Let a manager mark one Salon-local calendar date unavailable for the whole salon. That date overrides Salon Working Days and staff schedules when showing availability or creating an Appointment, without changing the recurring weekly schedule.

## Acceptance Criteria

- [ ] A manager can mark one future Salon-local date unavailable and later make it available again.
- [ ] Only the selected date is affected; the same weekday in other weeks keeps its normal Salon Working Days setting.
- [ ] Public availability does not offer times on an unavailable date.
- [ ] Appointment Intake rejects new Appointments and AppointmentRequest approvals on an unavailable date.
- [ ] Existing Appointments on the date remain visible and are not automatically cancelled or changed.

## Notes

- Requested by a test user who occasionally needs to close the salon for a single day without changing its normal weekly schedule.
- Salon-wide only in the smallest version; per-Staff Profile time off is out of scope.
- Needs triage: decide whether marking a date unavailable should warn about existing Appointments on that date.
