---
id: BL-0036
title: Transfer verified staff access between salons
status: done
type: feature
priority: medium
size: medium
created: 2026-06-23
updated: 2026-06-23
---

## Parent

[BL-0031 Assisted Salon Setup and handoff](BL-0031-assisted-salon-setup-and-handoff.md)

## What to build

Handle a setup Staff Profile whose phone is already claimed in another salon without adding multi-salon membership. Authorized admins can see the existing salon and status, while only the staff member's successful OTP verification can move login access. The previous salon retains its Staff Profile, schedule, appointments, and history without the person's login access.

## Acceptance criteria

- [x] When a setup staff phone is already claimed, an authorized admin sees the existing salon name and lifecycle status before proceeding.
- [x] Platform support and viewer roles cannot use this cross-salon identity view or transfer flow.
- [x] No platform user can transfer staff login access without successful OTP verification by the staff member.
- [x] After verification, the identity claims the new Staff Profile and no longer has tenant access through the previous salon.
- [x] The previous salon retains its Staff Profile, schedule, capabilities, appointments, and historical attribution.
- [x] Retrying a completed transfer is idempotent and cannot produce concurrent memberships.
- [x] Domain and API tests cover authorized visibility, privacy boundaries, verified transfer, preserved history, and retry behavior.

## Blocked by

- [BL-0035 Create and claim unclaimed Staff Profiles](BL-0035-create-and-claim-unclaimed-staff-profiles.md)

## Completion comment

Implemented on 2026-06-23. Added a permission-gated setup lookup for the existing salon name and lifecycle, kept transfer authority exclusively in the successful staff OTP callback, and made the transfer transactional and retry-safe. The previous salon's operational references are restored to its retained Staff Profile before login membership moves to the new salon. Added the `access_detached_at` migration, domain/API coverage, and regenerated the OpenAPI contract. Verified with focused tests (67 passing), API/database type-checks, lint, and migration-schema sync.
