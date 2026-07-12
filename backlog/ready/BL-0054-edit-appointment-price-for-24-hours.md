---
id: BL-0054
title: Let managers edit an Appointment price for 24 hours after its scheduled end
status: ready
type: task
triage: ready-for-agent
priority: medium
size: small
parent: BL-0052
blocked_by:
  - BL-0053
created: 2026-07-12
updated: 2026-07-12
---

## Parent

[BL-0052 Allow managers to set an Appointment price within a 24-hour window](BL-0052-appointment-price-editing-window.md)

## What to build

Let a manager change an Appointment's stored final price until 24 hours after its scheduled end time. Enforce the deadline and manager authorization in the API using Salon local time, and make the expired price control read-only with a clear explanation in the PWA.

## Acceptance Criteria

- [ ] A manager can edit the stored final price before the Appointment's scheduled end and throughout the following 24 hours.
- [ ] Updating other Appointment fields preserves the stored final price unless the manager explicitly changes it.
- [ ] The API rejects price changes after the deadline, including direct requests that bypass the PWA.
- [ ] The deadline is calculated from the Appointment's scheduled end date and time in `Asia/Tehran`.
- [ ] Existing staff permissions remain unchanged and staff cannot edit Appointment prices.
- [ ] The expired PWA control is read-only and explains that the editing window has closed.
- [ ] API tests cover an allowed update, the exact boundary, an expired update, and authorization.
- [ ] A PWA interaction test covers editable and expired states.

## Blocked By

- [BL-0053 Let managers set the final Appointment price on creation](BL-0053-set-appointment-price-on-creation.md)
