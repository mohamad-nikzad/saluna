---
id: BL-0064
title: Convert a Draft into an Appointment
status: done
type: task
triage: ready-for-agent
priority: medium
size: medium
parent: BL-0061
blocked_by: [BL-0063]
created: 2026-07-21
updated: 2026-07-21
---

## Parent

[BL-0061 Capture flexible AppointmentRequests as manager drafts](BL-0061-plan-flexible-appointment-requests.md)

## What to Build

Let a manager turn an actionable Draft into one normal Appointment from the Draft card. A focused scheduling FormSheet shows the recorded request and accepts only the final date, start time, and Staff Profile before routing the command through Appointment Intake.

## Acceptance Criteria

- [x] Every active Draft card offers Convert to Appointment and opens a focused FormSheet using established scheduling controls.
- [x] The sheet shows Client, BookedServiceSnapshot, all acceptable dates, Time Preference, and notes as read-only context.
- [x] Conversion accepts only a remaining acceptable date, a start time inside the Time Preference, and an active capable Staff Profile.
- [x] Client, ServiceVariant, booked name/duration/price, add-ons, packages, duration, and price cannot be changed during conversion.
- [x] The Appointment end time is derived from the Draft's binding booked duration, and Draft notes are copied to the Appointment.
- [x] Appointment Intake remains authoritative for Salon Working Days, staff schedule, capability, and Appointment conflict validation.
- [x] A successful conversion creates exactly one normal Appointment, links it to the AppointmentRequest, changes the request from pending to approved, and removes it from Drafts.
- [x] Appointment creation and the conditional request transition are atomic; a validation, creation, or concurrent-state failure creates no Appointment and leaves the Draft pending.
- [x] Repeated or concurrent conversion attempts cannot create a second Appointment.
- [x] Conversion with a catalog-edited ServiceVariant still uses the Draft's BookedServiceSnapshot.

## Blocked By

- BL-0063 Organize and edit Draft timing.
