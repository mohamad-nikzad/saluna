---
id: BL-0002
title: Improve salons landing pages
status: done
type: improvement
priority: high
size: medium
created: 2026-06-13
updated: 2026-06-13
---

## Problem

Public salon pages are missing parts of the salon's public presence, such as address and social links.

## Smallest Useful Version

Expose the key `Salon Presence` fields on public salon pages and make missing fields degrade cleanly.

## Acceptance Criteria

- [x] Public page can show address when available.
- [x] Public page can show social links when available.
- [x] Missing presence fields do not leave empty UI.
- [x] The implementation uses existing salon profile or public settings data where possible.

## Notes

- Original note: "Improve Salons landing page (add missing address social link ...)".
- Deployment note: ship the API/OpenAPI/client update before the web page change because public salon responses now include required `presence`.
