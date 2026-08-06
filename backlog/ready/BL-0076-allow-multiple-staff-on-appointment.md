---
id: BL-0076
title: Allow multiple Staff Profiles on one Appointment
status: ready
type: feature
triage: ready-for-agent
priority: medium
size: large
blocked_by: []
created: 2026-08-07
updated: 2026-08-07
---

## Problem

Some services, such as hair keratin, may be performed by more than one Staff Profile at the same time. Saluna currently gives an Appointment one assigned Staff Profile, so a manager cannot reserve every participating staff member's calendar or divide the resulting Staff Commissions without creating duplicate Appointments and revenue.

## Smallest Useful Version

Let a manager opt a ServiceVariant into multiple-staff scheduling with an **Allow multiple staff for this service** switch. When that service is selected in the manager Appointment form, keep one lead Staff Profile and let the manager add distinct Staff Profiles. Every Appointment Staff Assignment occupies the Appointment's complete shared time window.

Keep one Appointment, one client, one service snapshot, and one authoritative total. Before completion, divide that total among the assigned Staff Profiles through Work Allocations that total 100%, defaulting to an equal split. Apply each Staff Profile's existing Commission Agreement to only that profile's allocated basis.

## Acceptance Criteria

- [ ] A manager can enable or disable **Allow multiple staff for this service** while creating or editing a ServiceVariant; it is disabled by default for existing and new services.
- [ ] A ServiceVariant without the option enabled continues to accept exactly one Staff Profile per Appointment.
- [ ] Selecting an enabled ServiceVariant in the manager Appointment create or edit flow starts with one lead Staff Profile and lets the manager add or remove additional distinct Staff Profiles.
- [ ] Additional staff are optional: enabling the service option does not impose a required staff count.
- [ ] Every selected Staff Profile must be active, capable of performing the ServiceVariant, working, and free for the Appointment's complete time window before the Appointment can be saved.
- [ ] A multi-staff Appointment appears on every assigned Staff Profile's calendar, blocks conflicts for every assignment, and remains a single Appointment in salon-wide views and totals.
- [ ] Each assigned Staff Profile can open the Appointment through the same staff authorization rules that apply to a single assigned profile.
- [ ] Appointment creation and reassignment notifications are sent to each affected assigned Staff Profile without notifying the acting user or creating duplicate notifications.
- [ ] Work Allocations exist for every Appointment Staff Assignment, total exactly 100%, and default to an equal split; any rounding remainder is assigned deterministically to the lead Staff Profile.
- [ ] The manager can adjust Work Allocations before completing the Appointment, and invalid or incomplete allocations prevent completion.
- [ ] Completing the Appointment creates at most one Staff Commission per Appointment Staff Assignment with an applicable Commission Agreement, using `Appointment total × Work Allocation × Commission Agreement percentage`.
- [ ] An assigned Staff Profile without an applicable Commission Agreement earns no Staff Commission, and that profile's allocation remains part of the Salon Retained Amount rather than being redistributed.
- [ ] Multi-staff commission calculations use the Appointment's authoritative total once; salon-wide gross revenue, completed counts, and Salon Retained Amount do not multiply when more staff are assigned.
- [ ] Existing commission lifecycle behavior applies to every resulting Staff Commission, including price correction, voiding/restoring completion, deletion, agreement history, and per-staff reporting.
- [ ] Changing the ServiceVariant setting later does not rewrite existing Appointment Staff Assignments or historical Staff Commissions.
- [ ] AppointmentRequest approval supports choosing multiple staff for an enabled ServiceVariant; public AppointmentRequest intake does not ask customers to select staff.
- [ ] Automated checks cover service configuration, multi-staff create/edit validation, conflict detection, staff authorization and calendars, notifications, commission allocation and lifecycle, tenant isolation, and the complete manager booking journey.

## Out of Scope

- Requiring exactly two or another fixed number of staff.
- Giving different Staff Profiles different time windows within one Appointment.
- Per-service Commission Agreements or fixed-amount commission rules.
- Changing Service Package task scheduling; each package task continues to use its existing Staff Profile assignment.

## Notes

- The service switch means **allowed**, not **required**.
- The first selected Staff Profile is the lead; additional selections are co-staff, not separate Appointments.
- Related: BL-0019 Configure and report Staff Commissions.
- The current model permits only one assigned Staff Profile and at most one Staff Commission per Appointment; this work must expand those constraints while preserving existing single-staff behavior and history.

## Blocked By

None — can start immediately.
