---
id: BL-0028
title: Support ticket thread header hides when composer is focused on mobile
status: done
type: bug
priority: high
size: small
created: 2026-06-21
updated: 2026-06-21
---

## Problem

On the support ticket thread screen, focusing the message composer on mobile (reproduced on Android) causes the page header to disappear. The subject, status, and back button should stay visible — like common messaging apps — while only the message list area shrinks to make room for the keyboard.

## Reproduction

1. Open the manager PWA on a mobile device (Android confirmed).
2. Navigate to **پشتیبانی** and open a ticket thread.
3. Tap the composer input at the bottom.
4. Observe the header (back button, subject, category/status) scrolls off-screen or becomes invisible when the keyboard opens.

## Expected behavior

- Header remains fixed and always visible.
- Only the scrollable message thread area resizes/shrinks above the composer.
- Composer stays anchored above the keyboard.

## Smallest Useful Version

Treat the thread screen as a three-part layout: fixed header, flex-shrink message list, fixed composer. Adjust scroll/focus behavior so focusing the composer does not scroll the header out of view (review `scrollFocusedInputIntoView` usage and mobile viewport handling).

## Acceptance Criteria

- [x] On mobile (Android and iOS), the thread header stays visible while the composer is focused and the keyboard is open.
- [x] Message history scrolls in the middle region only; header and composer do not scroll away.
- [x] Focusing the composer still keeps the input usable above the keyboard.
- [x] Desktop layout is unchanged.

## Notes

- Reported on production-like Android flow on 2026-06-21.
- Fixed in `apps/pwa/src/components/support/support-ticket-thread.tsx`: removed `scrollFocusedInputIntoView` on composer focus, added `useKeyboardInset`, and `overscroll-contain` on the message list.
- Related: [BL-0023 Support ticket system](BL-0023-support-ticket-system.md).
