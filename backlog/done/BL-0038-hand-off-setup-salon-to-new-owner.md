---
id: BL-0038
title: Hand a Setup Salon to a new owner
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

Complete the basic Salon Handoff path for a new owner. An authorized admin can correct the intended-owner phone and generate a one-time link. The recipient must verify that phone through OTP and set their own password; Saluna then attaches the owner identity, activates the salon, ends ordinary setup editing, and opens the normal manager app.

## Acceptance criteria

- [x] An authorized admin can edit the intended-owner phone while the salon remains in setup.
- [x] An authorized admin can generate and copy a one-time handoff link for the recorded phone.
- [x] The handoff link does not expose reusable credentials or permit claiming with a different phone.
- [x] The recipient must successfully verify the recorded phone through the existing OTP behavior.
- [x] A new owner establishes their own password after OTP verification; platform staff never sees or supplies it.
- [x] Successful handoff atomically creates the owner membership and salon member record, activates the salon, and marks onboarding so the owner enters the normal manager experience.
- [x] Ordinary assisted-setup mutations are rejected immediately after activation.
- [x] The public salon page remains disabled by default.
- [x] Auth, API, and browser-level tests cover link generation, OTP failure, password validation, successful activation, redirect, and post-handoff access boundaries.

## Blocked by

- [BL-0032 Create and recognize a Setup Salon](BL-0032-create-and-recognize-setup-salon.md)

## Completion comment

Implemented on 2026-06-23. Salon Handoff now uses a 24-hour opaque token whose SHA-256 hash is stored server-side and bound to the Setup Salon's recorded phone. Changing that phone or generating a replacement invalidates prior links. The owner verifies the bound phone through the existing OTP service, chooses their own password, and completes an atomic ownership/activation transaction that leaves public publishing disabled and closes all ordinary setup mutation gates. API, admin UI, PWA browser-flow, type, lint, build, migration-sync, and focused unit tests pass.
