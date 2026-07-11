---
id: BL-0040
title: Add audited Platform Owner Override
status: done
type: feature
priority: medium
size: medium
created: 2026-06-23
updated: 2026-06-24
---

## Parent

[BL-0031 Assisted Salon Setup and handoff](BL-0031-assisted-salon-setup-and-handoff.md)

## What to build

Allow a Platform Owner to deliberately enter an override mode for an active salon and use the same bounded operating-data editor available during setup. Every override mutation requires an explicit reason, live-data confirmation, and audit attribution. The override never creates a tenant session and never exposes or changes authentication or messaging secrets.

## Acceptance criteria

- [x] Only an active `platform_owner` can enter Platform Owner Override for an active salon.
- [x] Platform admins, support users, and viewers remain unable to use setup mutations after handoff.
- [x] Override mode is visually explicit and requires a reason plus the existing live-data confirmation before mutation.
- [x] Override can edit only the operating-data areas supported by Assisted Salon Setup.
- [x] Override cannot read or change passwords, OTPs, sessions, credential accounts, messaging tokens, or other authentication secrets.
- [x] No tenant session or salon-user impersonation is created during override.
- [x] Every override mutation records the real Platform Owner, salon, action, reason, request metadata, and non-sensitive change summary in the admin audit log.
- [x] API and UI tests cover allowed edits, every forbidden platform role, missing confirmation/reason, audit output, and secret boundaries.

## Blocked by

- [BL-0038 Hand a Setup Salon to a new owner](BL-0038-hand-off-setup-salon-to-new-owner.md)

## Completion comment

Implemented on 2026-06-24. Active Platform Owners can deliberately enter a visually explicit override for an active salon and use the existing bounded hours, Presence, catalog, Staff Profile, and Client editors. Override intent is enforced independently on every API read and mutation; ordinary platform admins, support users, viewers, and inactive owners remain blocked. Each mutation requires its own reason and live-data confirmation, uses a distinct `salon.override.*` audit action with the real actor and request metadata, and records only a non-sensitive change summary. The flow creates no tenant session and does not expose owner handoff, credentials, OTPs, sessions, or messaging secrets. API and admin UI coverage exercises entry, permitted edits, all forbidden roles, validation, audit attribution, and secret boundaries.
