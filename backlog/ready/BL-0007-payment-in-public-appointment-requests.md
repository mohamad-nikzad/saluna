---
id: BL-0007
title: Payment in public appointment requests
status: ready
type: feature
priority: medium
size: large
created: 2026-06-13
updated: 2026-06-13
---

## Problem

Public appointment requests may need upfront payment or deposits to reduce no-shows and confirm customer intent.

## Smallest Useful Version

Support a single payment step for public `AppointmentRequest` flows, scoped to one payment provider and one payment policy.

## Acceptance Criteria

- [ ] Public request flow can require payment before final submission or approval.
- [ ] Payment status is stored with the request or related payment record.
- [ ] Failed or cancelled payments do not create confirmed appointments.
- [ ] Manager-facing screens can identify paid requests.

## Notes

- Original note: "Payment in public bookings".
