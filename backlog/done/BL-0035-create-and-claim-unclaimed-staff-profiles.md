---
id: BL-0035
title: Create and claim unclaimed Staff Profiles
status: done
type: feature
priority: high
size: large
created: 2026-06-23
updated: 2026-06-23
---

## Parent

[BL-0031 Assisted Salon Setup and handoff](BL-0031-assisted-salon-setup-and-handoff.md)

## What to build

Allow an authorized admin to create salon-owned Staff Profiles, schedules, and ServiceVariant capabilities during setup without creating passwords or verified users. Complete the slice with a first-login flow in which the staff member enters their phone, verifies OTP, reuses an existing eligible identity or establishes a password, and claims the prepared profile.

## Acceptance criteria

- [x] An authorized admin can create a Staff Profile with name, phone, schedule, color, active state, and ServiceVariant capabilities in a Setup Salon.
- [x] Creating the Staff Profile does not create a credential account, choose a password, or mark the phone verified.
- [x] The Staff Profile participates in prepared schedules and service capability checks before it is claimed.
- [x] A staff member can enter the recorded phone through the login flow and receive the existing neutral OTP response behavior.
- [x] Successful OTP verification connects the identity to the matching unclaimed Staff Profile.
- [x] A person without credentials sets their own valid password after OTP; an eligible existing identity is reused without replacing its password.
- [x] Unverified, mismatched, already-claimed, and ambiguous claims are rejected without leaking identity information before OTP verification.
- [x] Existing manager-created staff and current login behavior remain compatible during migration.
- [x] Domain, API, and UI tests cover unclaimed creation, scheduling, OTP claim, password establishment, existing-user reuse, and rejection cases.

## Blocked by

- [BL-0032 Create and recognize a Setup Salon](BL-0032-create-and-recognize-setup-salon.md)
- [BL-0034 Configure the Setup Salon service catalog](BL-0034-configure-setup-salon-service-catalog.md)
