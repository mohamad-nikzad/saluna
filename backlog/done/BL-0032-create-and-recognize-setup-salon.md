---
id: BL-0032
title: Create and recognize a Setup Salon
status: done
type: feature
priority: high
size: medium
created: 2026-06-23
updated: 2026-06-23
---

## Parent

[BL-0031 Assisted Salon Setup and handoff](BL-0031-assisted-salon-setup-and-handoff.md)

## What to build

Give authorized platform owners and platform admins one complete admin flow for creating a non-public `Setup Salon` with a normalized intended-owner phone. The salon receives its ordinary baseline settings without creating a placeholder owner identity, appears clearly as setup in the salon list and detail screen, and remains unavailable to tenant and public flows.

## Acceptance criteria

- [x] A platform owner or platform admin can create a Setup Salon with a name and intended-owner phone from the admin app.
- [x] The phone is canonicalized using the existing salon-phone rules, and invalid phones produce a clear validation error.
- [x] Creation produces the salon's required baseline profile, business settings, public settings, and onboarding state without creating a user, owner membership, or password.
- [x] Setup Salons are visibly distinguished from active, suspended, and archived salons in admin list and detail views.
- [x] Setup Salons cannot be reached through tenant routes, public salon routes, availability, or public AppointmentRequest creation.
- [x] Platform support and platform viewer users cannot see or invoke setup mutations.
- [x] Creation is recorded in the admin audit log with the real platform actor and intended-owner phone redacted from audit metadata.
- [x] API and UI tests cover authorized creation, forbidden roles, validation, sidecar creation, and non-public behavior.

## Blocked by

None - can start immediately
