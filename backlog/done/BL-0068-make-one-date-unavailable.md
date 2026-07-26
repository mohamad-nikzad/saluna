---
id: BL-0068
title: Let managers make dates unavailable
status: done
type: feature
triage: ready-for-agent
priority: medium
size: medium
blocked_by: []
created: 2026-07-26
updated: 2026-07-26
---

## Problem

A salon may be open on weekdays normally but unable to offer services on one date or a bounded date range. Changing Salon Working Days would incorrectly close those weekdays every week.

## Smallest Useful Version

Let a manager mark Salon-local today, a future calendar date, or an inclusive date range unavailable for the whole salon. A salon may have multiple closures. Each closed date overrides Salon Working Days and staff schedules when showing availability or creating an Appointment, without changing the recurring weekly schedule.

## Acceptance Criteria

- [x] A manager can mark Salon-local today, a future date, or an inclusive date range unavailable and later make its dates available again; past dates cannot be changed.
- [x] One close or reopen operation spans at most 366 inclusive dates; multiple operations remain allowed.
- [x] A salon can have multiple closures.
- [x] Unavailable dates act as one unified salon-wide set; every closure picker visibly marks dates already in that set.
- [x] Closing overlapping selections is idempotent rather than creating separate range ownership.
- [x] A range may span dates already unavailable; only newly unavailable dates are added and included in the Appointment warning.
- [x] The picker compactly distinguishes dates closed by Salon Working Days from one-time unavailable dates without exposing overlap mechanics.
- [x] A selected closure records every date in its range, including dates already closed by Salon Working Days, so later weekly-schedule changes cannot reopen part of the closure.
- [x] Making a date available removes only its one-time closure; Salon Working Days and staff schedules still determine actual availability.
- [x] Only the selected dates are affected; the same weekdays in other weeks keep their normal Salon Working Days settings.
- [x] Public availability does not offer times on an unavailable date.
- [x] Manager booking surfaces show an unavailable date as closed wherever an Appointment can be initiated.
- [x] Appointment Intake rejects new Appointments, Service Package scheduling, and AppointmentRequest approvals on an unavailable date; managers cannot override the closure.
- [x] A new AppointmentRequest for an already unavailable exact date is rejected; requests created before closure remain pending but cannot be approved while it stays unavailable.
- [x] If the date has active Appointments, the manager sees their count and must confirm before marking the date unavailable.
- [x] The warning counts `scheduled` and `confirmed` Appointment rows only; each active Service Package task counts as one Appointment.
- [x] For a range, the confirmation shows the total active Appointment count and a per-date count for affected dates, without listing individual Appointment details.
- [x] Confirming leaves existing Appointments visible and unchanged, then blocks subsequent Appointment creation and AppointmentRequest approval for that date.
- [x] Confirmation remains valid if the Appointment count changes before closure commits; all Appointments committed before closure remain unchanged and later intake is rejected.
- [x] An unconfirmed closure and Appointment creation are atomic: if the Appointment commits first the manager receives the warning; if the closure commits first the Appointment is rejected.
- [x] Closing a date does not automatically notify clients or staff; existing Appointments remain valid and manager follow-up is manual.
- [x] Pending AppointmentRequests neither appear in the warning nor prevent closure; they remain pending but cannot be approved while it stays unavailable.
- [x] Existing Appointments may be edited while staying on the same unavailable date or moved away from it; moving an Appointment onto an unavailable date is rejected.

## Notes

- Requested by a test user who occasionally needs to close the salon for a single day without changing its normal weekly schedule.
- Salon-wide only in the smallest version; per-Staff Profile time off is out of scope.
- Recurring closures are out of scope.
- An unavailable date may contain existing Appointments. Closing the date never cancels, removes, or changes them.
- The closure must become authoritative when committed so later Appointment Intake cannot admit more Appointments on that date.
- UI prototype: use one list-first settings surface showing only closed dates; Add opens the shadcn Jalali range Calendar in a drawer.
