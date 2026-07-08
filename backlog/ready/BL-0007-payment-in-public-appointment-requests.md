---
id: BL-0007
title: Payment in public appointment requests
status: ready
type: feature
priority: medium
size: large
created: 2026-06-13
updated: 2026-07-08
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
- Partial implementation note: `salon_public_settings.deposit_policy`, `appointment_requests.payment_status`, and `appointment_requests.deposit_amount` exist as schema/API placeholders. No checkout provider, payment confirmation, or public payment step is implemented yet.
