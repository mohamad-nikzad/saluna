---
id: BL-0039
title: Harden Salon Handoff for existing identities and retries
status: done
type: feature
priority: high
size: medium
created: 2026-06-23
updated: 2026-06-24
---

## Parent

[BL-0031 Assisted Salon Setup and handoff](BL-0031-assisted-salon-setup-and-handoff.md)

## What to build

Extend Salon Handoff to safely reuse an existing eligible Saluna identity, reject phones already owning another salon, survive interrupted or repeated requests without duplicate records, and optionally publish the public page through an explicit admin choice that defaults off.

## Acceptance criteria

- [x] A verified existing user without a salon can claim the Setup Salon without creating a duplicate user or replacing their password.
- [x] A phone already owning another salon produces a clear admin conflict and cannot claim a second salon in this version.
- [x] Setup Salon creation warns authorized admins when the intended-owner phone is already associated with a salon and shows that salon's name and status.
- [x] Repeating handoff after a timeout or response loss returns the same successful ownership state without duplicate users, memberships, sidecars, or audit transitions.
- [x] A consumed or superseded handoff link cannot transfer the salon to another identity.
- [x] The handoff action offers an explicit enable-public-page choice that defaults to disabled.
- [x] Enabling publication takes effect only after successful handoff and never publishes a Setup Salon.
- [x] Domain, API, and UI tests cover existing identity reuse, ownership conflict, idempotency, stale links, and both publication choices.

## Blocked by

- [BL-0038 Hand a Setup Salon to a new owner](BL-0038-hand-off-setup-salon-to-new-owner.md)

## Completion comment

Implemented on 2026-06-24. Salon Handoff now reuses verified credentialed identities without changing their password, rejects identities already attached to another salon with the conflicting salon name and status, and serializes completion so retries return the original successful ownership state without duplicate rows. Handoff links retain an explicit public-page choice that defaults off and is applied atomically only as the Setup Salon becomes active. Admin creation warnings, API conflicts, stale-link behavior, both publication choices, and new/existing-owner browser flows are covered by focused tests.
