---
id: BL-0105
title: Fix staff list arrow navigation
status: ready
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

- [ ] Tapping or clicking the left arrow on a staff card opens `/staff/$id` for that card's Staff Profile.
- [ ] The arrow belongs to an accessible navigation control with a clear name, visible keyboard focus, and a usable mobile touch target.
- [ ] Clicking the staff name or avatar continues to open the same profile.
- [ ] Opening the row menu or choosing services, schedule, invitation, or deletion actions does not also navigate to the profile.
- [ ] The RTL mobile layout preserves the left-side arrow placement and avoids overlapping controls or nested interactive elements.
- [ ] A focused regression check exercises the arrow and confirms that another staff card opens its own profile, while the row menu remains independent.

## Notes

- User report on 2026-10-11: "clicking left side arrow on staff list don't do anything."
- Relevant files: `apps/pwa/src/components/staff/staff-list-card.tsx`, `staff-list-row-menu.tsx`, and `apps/pwa/src/routes/_authed/staff.index.tsx`.
- This task concerns each staff card's arrow, not the page-header back button.
