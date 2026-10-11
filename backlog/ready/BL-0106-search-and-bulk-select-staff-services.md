---
id: BL-0106
title: Add search and bulk selection to staff services
status: ready
type: task
triage: ready-for-agent
priority: medium
size: medium
blocked_by: []
created: 2026-10-11
updated: 2026-10-11
---

## Problem

Managers editing a Staff Profile's permitted services must scroll through category groups and check or uncheck services one at a time. The drawer has no search or bulk selection controls, so changing a large catalog selection takes unnecessary work.

## Smallest Useful Version

In the custom-selection mode of the staff services drawer, add search by service name and category name, a selected-service count, and select-all and deselect-all actions. Without a search, bulk actions apply to all active services. With a search, they apply only to matching active services and their labels state that scope.

Keep the existing "all active services" mode distinct from selecting every service in the current catalog. The former also permits services added later; the latter saves an explicit selection.

## Acceptance Criteria

- [ ] Managers can search active services by service name or category name using Persian text, with surrounding whitespace ignored and matching consistent with the app's existing search conventions.
- [ ] Search keeps category grouping for matching results, omits empty groups, and shows a clear no-results state with a way to clear the query.
- [ ] Changing or clearing the search preserves all checked services, including selections outside the current results.
- [ ] In custom-selection mode, select-all checks every visible matching service and deselect-all unchecks those services. With an empty query, both actions cover the full active catalog.
- [ ] Bulk action labels explain whether they apply to all active services or only search results. Bulk actions with no matching results are disabled.
- [ ] Managers can still check individual services, and a visible count reflects the whole selection rather than just matching results.
- [ ] Selecting all in custom-selection mode saves explicit service IDs and does not switch to unrestricted mode. The existing unrestricted mode continues to save `serviceIds: null`.
- [ ] Deselect-all may leave an empty draft so the manager can build a new selection. Saving an empty custom selection shows a validation error before normalization and never silently grants all services. The manager must select at least one service or explicitly enable unrestricted mode.
- [ ] Saving persists the chosen services, and reopening the drawer restores them. Cancelling or discarding changes preserves the saved selection, and unsaved-change protection covers individual and bulk edits.
- [ ] Search resets when opening the editor for another Staff Profile. Filtering and bulk edits never change that other profile or silently remove saved IDs outside the displayed active catalog.
- [ ] Search, bulk controls, list scrolling, and save/cancel actions work on narrow RTL mobile screens and with keyboard navigation.
- [ ] Focused regression coverage verifies filtered bulk actions, hidden-selection preservation, explicit-all versus unrestricted behavior, empty-selection validation, and save/reopen behavior.

## Notes

- User request on 2026-10-11: improve staff service management with search and select/deselect-all controls instead of editing every checkbox separately.
- Main implementation: `apps/pwa/src/components/staff/staff-services-drawer.tsx`; persistence uses `useUpdateStaffServicesMutation` in `apps/pwa/src/lib/staff-queries.ts`.
- `packages/salon-core/src/forms/staff.ts` currently normalizes an empty `serviceIds` array to `null`. Account for this before implementing deselect-all; the existing post-parse empty-array check does not protect an empty custom draft.
- This task improves service capability selection. It does not change Staff Commission overrides or Service Package capabilities.
