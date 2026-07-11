---
id: BL-0033
title: Configure Setup Salon hours and Presence
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

Extend the Setup Salon editor with a complete path for authorized admins to configure Salon Working Days, business hours, address, map links, and social links. Reuse the same validation and domain behavior as the manager app so the prepared values work unchanged after handoff.

## Acceptance criteria

- [x] An authorized admin can view and update Salon Working Days and opening/closing hours for a Setup Salon.
- [x] An authorized admin can view and update Salon Presence, including address, supported map links, website, and supported social links.
- [x] Setup mutations enforce the existing manager-facing validation and normalization rules.
- [x] Attempts to use ordinary setup mutations on an active, suspended, or archived salon are rejected.
- [x] Saved values are visible through the ordinary manager settings screens after handoff without conversion or duplication.
- [x] The admin UI reports validation and persistence failures clearly and preserves entered values where appropriate.
- [x] API and UI tests cover successful editing, validation failures, unauthorized roles, and invalid salon lifecycle.

## Blocked by

- [BL-0032 Create and recognize a Setup Salon](BL-0032-create-and-recognize-setup-salon.md)
