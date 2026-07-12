---
id: BL-0052
title: Allow managers to set an Appointment price within a 24-hour window
status: done
type: feature
priority: medium
size: medium
created: 2026-07-12
updated: 2026-07-12
---

## Subtasks

- [BL-0053 Let managers set the final Appointment price on creation](BL-0053-set-appointment-price-on-creation.md)
- [BL-0054 Let managers edit an Appointment price for 24 hours after its scheduled end](BL-0054-edit-appointment-price-for-24-hours.md)

## Problem Statement

Managers currently see an Appointment price calculated from the booked ServiceVariant and add-ons, but cannot replace it with the price actually agreed or charged. This prevents corrections for discounts, extra work, and other real-world price changes, including corrections made shortly after the Appointment is due.

## Solution

Let managers set the final Appointment price while creating an Appointment and edit it until 24 hours after the Appointment's scheduled end time. Keep the calculated service-and-add-on total as the default. Enforce the edit deadline on the server using Salon local time so expired prices cannot be changed through a direct API request.

## User Stories

1. As a manager, I want the calculated service-and-add-on total prefilled when creating an Appointment, so that the common case requires no extra work.
2. As a manager, I want to replace the calculated total while creating an Appointment, so that the booked price matches what I agreed with the Client.
3. As a manager, I want to edit the final price before the Appointment ends, so that I can correct booking mistakes.
4. As a manager, I want to edit the final price for 24 hours after the scheduled end time, so that I can record discounts, extra work, or corrections after the Appointment.
5. As a manager, I want the price to become read-only after the deadline, so that historical revenue does not change unexpectedly.
6. As a manager, I want to see why an expired price cannot be edited, so that the restriction is understandable.
7. As a Salon owner, I want the server to reject expired price changes, so that reporting data cannot be bypassed through the API.
8. As a staff member, I do not want this feature to expand my existing Appointment permissions, so that manager-only financial controls remain protected.

## Implementation Decisions

- Reuse the existing booked total price snapshot as the authoritative final Appointment price; do not add a separate pricing subsystem.
- Accept an optional non-negative final price in manager Appointment create and update contracts.
- On creation, default the field to the current ServiceVariant plus selected add-ons total, while allowing the manager to replace it.
- On update, preserve the stored final price unless the manager explicitly changes it.
- Permit price changes through the end of the 24-hour period measured from the Appointment's scheduled end date and time in `Asia/Tehran`.
- Enforce the deadline and manager authorization in the API. The PWA should also disable or hide editing after the deadline and explain that the window has closed.
- Price editing must not change the booked ServiceVariant or add-on snapshots, duration, schedule, or status.
- Validate the price with the existing non-negative money bounds and localized-number input conventions.

## Testing Decisions

- Prefer API route tests as the highest seam covering authorization, validation, persistence, and the deadline.
- Cover creation with the calculated default and with an explicit manager-entered price.
- Cover an update before the scheduled end, exactly at the 24-hour boundary, and after the boundary.
- Cover rejection of negative or excessive prices and rejection of staff price updates.
- Add a focused PWA interaction test proving that the manager can enter a price during creation/editing and that the control becomes read-only after expiry.
- Assert observable responses and stored Appointment details rather than internal helper calls.

## Acceptance Criteria

- [x] Appointment creation shows the calculated ServiceVariant and add-on total as an editable final-price field for managers.
- [x] A manager-entered creation price is stored and returned as the Appointment's booked total price.
- [x] Managers can edit the stored final price until 24 hours after the Appointment's scheduled end time.
- [x] The price control is read-only after the deadline and explains that the editing window has closed.
- [x] The API rejects price updates after the deadline, including direct requests that bypass the PWA.
- [x] Existing staff permissions are unchanged and staff cannot edit Appointment prices.
- [x] Existing Appointments require no data migration and retain their stored booked total price.
- [x] Automated tests cover price creation, allowed edits, the time boundary, expired edits, validation, and authorization.

## Out of Scope

- Recording price-change history or an audit log.
- Discounts, coupons, taxes, deposits, payments, refunds, or invoice/factor generation.
- Changing ServiceVariant catalog prices from the Appointment form.
- Allowing staff or Clients to edit Appointment prices.
- Editing a final price more than 24 hours after the Appointment's scheduled end time.

## Further Notes

- Source: feedback from a test user asking for Appointment price corrections up to 24 hours after the due time.
- Current behavior only displays a calculated price preview; the editable numeric field in the Appointment form controls duration.
- Closed 2026-07-12: BL-0053 and BL-0054 are done. Parent tracker closed after both subtasks shipped (`02450f5`, `804dd52`).
