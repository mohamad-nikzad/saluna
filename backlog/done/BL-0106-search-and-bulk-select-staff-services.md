---
id: BL-0106
title: Add search and bulk selection to staff services
status: done
type: task
triage: ready-for-agent
priority: medium
size: medium
blocked_by: []
created: 2026-10-11
updated: 2026-10-12
---

## Problem

Managers editing a Staff Profile's permitted services must scroll through category groups and check or uncheck services one at a time. The drawer has no search or bulk selection controls, so changing a large catalog selection takes unnecessary work.

## Smallest Useful Version

In the custom-selection mode of the staff services drawer, add search by service name and category name, a selected-service count, and select-all and deselect-all actions. Without a search, bulk actions apply to all active services. With a search, they apply only to matching active services and their labels state that scope.

Keep the existing "all active services" mode distinct from selecting every service in the current catalog. The former also permits services added later; the latter saves an explicit selection.

## Acceptance Criteria

- [x] Managers can search active services by service name or category name using Persian text, with surrounding whitespace ignored and matching consistent with the app's existing search conventions.
- [x] Search keeps category grouping for matching results, omits empty groups, and shows a clear no-results state with a way to clear the query.
- [x] Changing or clearing the search preserves all checked services, including selections outside the current results.
- [x] In custom-selection mode, select-all checks every visible matching service and deselect-all unchecks those services. With an empty query, both actions cover the full active catalog.
- [x] Bulk action labels explain whether they apply to all active services or only search results. Bulk actions with no matching results are disabled.
- [x] Managers can still check individual services, and a visible count reflects the whole selection rather than just matching results.
- [x] Selecting all in custom-selection mode saves explicit service IDs and does not switch to unrestricted mode. The existing unrestricted mode continues to save `serviceIds: null`.
- [x] Deselect-all may leave an empty draft so the manager can build a new selection. Saving an empty custom selection shows a validation error before normalization and never silently grants all services. The manager must select at least one service or explicitly enable unrestricted mode.
- [x] Saving persists the chosen services, and reopening the drawer restores them. Cancelling or discarding changes preserves the saved selection, and unsaved-change protection covers individual and bulk edits.
- [x] Search resets when opening the editor for another Staff Profile. Filtering and bulk edits never change that other profile or silently remove saved IDs outside the displayed active catalog.
- [x] Search, bulk controls, list scrolling, and save/cancel actions work on narrow RTL mobile screens and with keyboard navigation.
- [x] Focused regression coverage verifies filtered bulk actions, hidden-selection preservation, explicit-all versus unrestricted behavior, empty-selection validation, and save/reopen behavior.

## Notes

- User request on 2026-10-11: improve staff service management with search and select/deselect-all controls instead of editing every checkbox separately.
- Main implementation: `apps/pwa/src/components/staff/staff-services-drawer.tsx`; persistence uses `useUpdateStaffServicesMutation` in `apps/pwa/src/lib/staff-queries.ts`.
- `packages/salon-core/src/forms/staff.ts` currently normalizes an empty `serviceIds` array to `null`. Account for this before implementing deselect-all; the existing post-parse empty-array check does not protect an empty custom draft.
- This task improves service capability selection. It does not change Staff Commission overrides or Service Package capabilities.

## Completion — 2026-10-12

- Added the shared clearable SearchInput with Persian normalization for service and category names, grouped results, and an empty-results state.
- Bulk actions operate only on matching active services and preserve hidden, inactive, and unavailable saved IDs. The count reflects the complete explicit selection.
- Explicit select-all retains service IDs; unrestricted mode still saves `null` and includes future active services.
- Empty custom drafts are rejected before the shared payload schema can normalize them to unrestricted access. The validation message stays visible in the fixed footer and is announced as an alert.
- Query and draft reset when opening another Staff Profile. Bulk edits use the existing dirty-form discard protection, and selection controls are disabled while saving.
- Added nine drawer regression tests using the real form, drawer, dismiss guard, and mutation hook with the SDK network boundary mocked. They cover Persian filtering, scoped bulk changes, hidden-ID preservation, save/reopen, future catalog additions, unrestricted mode, empty drafts, discard protection, profile changes, and failed saves.
- Verification: 18 focused tests passed across the drawer, shared search input, and staff queries; PWA type checking, focused ESLint, production Vite build, and `git diff --check` passed. The build reports a large-chunk warning.
- Chromium exercised the actual drawer and stylesheet at 320px, 375px, and 1280px widths with mocked API responses. Keyboard Tab/Enter/Space controls, save/reopen, validation, discard, list scrolling, footer visibility, and absence of horizontal overflow passed. Browser logs and screenshots are available under `/tmp/bl0106-browser*` for this workspace session.

## Full-app verification follow-up — 2026-10-12

- Ran the real manager PWA, API, Better Auth password login, and freshly migrated/seeded isolated PostgreSQL databases. No browser requests or API responses were mocked.
- Added `e2e/staff-services.spec.ts`. Both 320px and 1280px journeys passed, covering filtered bulk edits, hidden-selection preservation, explicit-all persistence, reload/reopen, empty-selection validation without a backend write, discard, and unrestricted mode. Each journey restores the Staff Profile selection it changes.
- Corrected the shared E2E login helper to select the brand's level-one heading; its prior broad brand-name match also selected the login section heading.
- Added the tested `scripts/cloud-dev.mjs` startup helper and `docs/agents/cloud-development.md`. Warm preparation took 2.17 seconds; the two browser journeys took about one minute. Full-app screenshots and the Playwright report are in the ignored local test artifacts.
- This verification covered the affected authenticated manager workflow. The worker currently has no supported user-facing port-sharing operation, and its existing staging-access configuration is absent. The separately hosted ChatGPT Site remains a demo, not a review link to the running full app.

## UX revision — 2026-10-12

- Reduced the description to the Staff Profile name, removed the nested cards and long instructional paragraphs, and replaced the unrestricted mode card with one compact toggle row.
- Select-all/deselect-all and save/cancel each stay side by side at narrow mobile widths. Bulk buttons have short visible labels with the shared visible scope and full accessible labels.
- Search and bulk controls stay above the independently scrolling service list. Service rows use a 44px minimum hit area with tighter category spacing and no unrelated duration metadata.
- Verification: nine drawer regressions and both real-app E2E journeys (320px and 1280px) passed; PWA type checking, focused linting, and the demo production build passed. Actual app screenshots were inspected at both widths.

## Category selection — 2026-10-12

- Added a checkbox beside each category heading. It selects or clears that category's visible active services, shows a dash for partial selection, and leaves other categories, hidden search selections, and unavailable saved IDs intact. With a query, the accessible label identifies the matching-results scope.
- Group edits use the same explicit-ID draft, validation, and dirty-form protection as the global bulk controls. They do not switch to unrestricted mode.
- The shared Checkbox now renders a dash for indeterminate state and a check for complete selection, with matching selected colors.
- Verification: eleven drawer regressions passed; real-app category toggles, keyboard Space activation, filtered group saves, persistence, and the existing booking-capability editor journey passed at 320px and 1280px. An additional mobile check verified the visible dash/check indicators. PWA type checking, focused linting, and the hosted demo build passed. The existing private test Site was updated.
