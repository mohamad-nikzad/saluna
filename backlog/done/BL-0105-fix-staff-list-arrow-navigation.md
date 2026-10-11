---
id: BL-0105
title: Fix staff list arrow navigation
status: done
type: task
triage: ready-for-agent
priority: medium
size: small
blocked_by: []
created: 2026-10-11
updated: 2026-10-11
---

## Problem

The left-side arrow on a staff list card suggests that tapping it opens the Staff Profile, but it does nothing. In `StaffListCard`, the name and avatar are inside the navigation button while the `ChevronLeft` sits outside it without a click handler.

## Smallest Useful Version

Make the left arrow and its surrounding touch area open the same Staff Profile detail page as the name and avatar. Keep the row menu's actions independently operable.

## Acceptance Criteria

- [x] Tapping or clicking the left arrow on a staff card opens `/staff/$id` for that card's Staff Profile.
- [x] The arrow belongs to an accessible navigation control with a clear name, visible keyboard focus, and a usable mobile touch target.
- [x] Clicking the staff name or avatar continues to open the same profile.
- [x] Opening the row menu or choosing services, schedule, invitation, or deletion actions does not also navigate to the profile.
- [x] The RTL mobile layout preserves the left-side arrow placement and avoids overlapping controls or nested interactive elements.
- [x] A focused regression check exercises the arrow and confirms that another staff card opens its own profile, while the row menu remains independent.

## Notes

- User report on 2026-10-11: "clicking left side arrow on staff list don't do anything."
- Relevant files: `apps/pwa/src/components/staff/staff-list-card.tsx`, `staff-list-row-menu.tsx`, and `apps/pwa/src/routes/_authed/staff.index.tsx`.
- This task concerns each staff card's arrow, not the page-header back button.

## Completion

- Completed on 2026-10-11. The arrow now sits in a labeled shared Button with a 44px touch target and keyboard focus styling. Name, avatar, arrow, and profile-menu navigation share the same profile handler; the menu remains a sibling control.
- Seven regression checks pass in `staff-list-card.test.tsx`, covering arrow and touch-area clicks for two profiles, name and avatar navigation, and independent services, schedule, deletion, resend-invitation, and cancel-invitation actions.
- PWA typecheck and ESLint for both changed component files pass.
- Playwright verified the actual staff page at 320px RTL width: a 44×44 arrow at the left, non-overlapping controls, no nested buttons or links, mouse navigation to the first profile, and Tab focus plus Enter navigation to the second profile. Browser data came from mocked API responses because local login returned a server error.
