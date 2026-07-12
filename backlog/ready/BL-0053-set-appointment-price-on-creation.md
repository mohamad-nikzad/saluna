---
id: BL-0053
title: Let managers set the final Appointment price on creation
status: ready
type: task
triage: ready-for-agent
priority: medium
size: small
parent: BL-0052
blocked_by: []
created: 2026-07-12
updated: 2026-07-12
---

## Parent

[BL-0052 Allow managers to set an Appointment price within a 24-hour window](BL-0052-appointment-price-editing-window.md)

## What to build

When a manager creates an Appointment, show the calculated ServiceVariant and add-on total as the default final price and let the manager replace it before saving. Persist and return the chosen amount as the Appointment's authoritative booked total price.

## Acceptance Criteria

- [ ] The manager Appointment creation form shows an editable final-price field prefilled with the calculated ServiceVariant and add-on total.
- [ ] Leaving the default untouched preserves the current calculated-price behavior.
- [ ] Replacing the default stores and returns the manager-entered amount as the Appointment's booked total price.
- [ ] The final price uses the existing localized-number input conventions and non-negative money bounds.
- [ ] Appointment creation API tests cover calculated and manager-entered prices, including invalid values.
- [ ] A PWA interaction test proves that a manager can replace the calculated price during creation.

## Blocked By

None — can start immediately.
