---
id: BL-0074
title: Help managers complete and share their public page
status: done
type: task
triage: ready-for-agent
priority: high
size: medium
parent: BL-0069
blocked_by: [BL-0070]
created: 2026-07-26
updated: 2026-07-28
---

## Parent

[BL-0069 Improve public Salon pages for local organic search](BL-0069-improve-public-salon-local-seo.md)

## What to Build

Place a prominent publication card in the manager public-page screen that
shows whether useful Salon details are complete and, once the last saved state
is enabled, makes the canonical public URL easy to share, copy, or open.

## Acceptance Criteria

- [x] A compact hint identifies missing province, city, address, phone, bio, or visible services without preventing publication.
- [x] The saved enabled state shows the canonical public URL outside the slug editor with Share, Copy link, and Open public page actions.
- [x] Share invokes the native Web Share API with the Salon name, the approved short Persian invitation, and the canonical URL.
- [x] Browsers without native sharing fall back to copying the bare canonical URL and show the same visible confirmation as Copy link.
- [x] Cancelling the native share sheet stays quiet; actual share or clipboard failures show a useful error.
- [x] Copy link writes only the bare canonical URL, and Open public page opens it in a new browser context without changing manager state.
- [x] Disabled and newly toggled-but-unsaved pages cannot be shared and explain that the page must be saved as enabled first.
- [x] One authenticated browser test covers enabled, disabled, unsaved, successful, cancellation, fallback, failure, copy, and open behavior.

## Blocked By

- BL-0070 Capture structured Salon Presence location — done.
