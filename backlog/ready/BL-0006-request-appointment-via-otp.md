---
id: BL-0006
title: Request appointment via OTP
status: ready
type: feature
priority: high
size: medium
created: 2026-06-13
updated: 2026-06-13
---

## Problem

Public appointment requests need a lightweight way to verify that the submitted phone number belongs to the customer.

## Smallest Useful Version

Require OTP verification before creating or confirming an `AppointmentRequest` from a public booking flow.

## Acceptance Criteria

- [ ] Customer can request OTP during public appointment request flow.
- [ ] `AppointmentRequest` is created or confirmed only after OTP verification.
- [ ] Verification failures show clear customer-facing errors.
- [ ] OTP request throttling prevents repeated abuse.

## Notes

- Original note: "Request appointment via OTP".
- Related: BL-0008 SMS support.
