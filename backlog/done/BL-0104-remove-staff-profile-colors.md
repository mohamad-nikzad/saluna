---
id: BL-0104
title: Remove Staff Profile colors
status: done
type: task
triage: ready-for-agent
priority: medium
size: medium
blocked_by: []
created: 2026-10-11
updated: 2026-10-11
---

## Problem

Managers can assign a color to a Staff Profile, but the user considers this setting useless and wants the whole feature removed. Removing only the picker would leave staff color data and styling throughout the app.

## Smallest Useful Version

Remove Staff Profile color selection, storage, API fields, defaults, and rendering based on stored Staff Profile colors. Assign Staff Profiles stable display colors automatically from the predefined Calendar palette, using profile identity rather than stored preferences. Use shared theme tokens for staff avatars and indicators in light and dark themes. Keep names and initials visible so managers can still identify staff in lists and Appointments.

## Acceptance Criteria

- [x] Staff Profile creation, editing, detail, onboarding, and admin Salon Setup have no staff color controls or color descriptions.
- [x] Staff lists, profile headers, Calendar staff filters and indicators, and Today views no longer derive their appearance from a Staff Profile color.
- [x] Staff Profile contracts, forms, API schemas, data clients, database reads and writes, and automatic profile creation no longer require, assign, or return staff color data.
- [x] A database migration removes obsolete Staff Profile color storage from an existing installation without losing profiles, schedules, capabilities, Staff Profile Access, Appointments, or Staff Commissions.
- [x] Shared color helpers and tokens used by services or Service Packages remain available under suitable names. Service colors, Appointment status colors, and general theme styling retain their existing behavior.
- [x] Existing Staff Profiles still load and can be edited. Creating profiles through invitations, onboarding, Salon Handoff, and admin Salon Setup succeeds without a color value.
- [x] Relevant typechecks and regression checks pass, and mobile staff, Calendar, and Today screens remain readable in light and dark themes.

- [x] Automatic staff colors use a stable Staff Profile ID and the five predefined Calendar tokens, with matching accents across Calendar, Today, lists, and profile headers in both themes.

## Notes

- User request on 2026-10-11: "remove the whole staff color, its useless and point less."
- Start with `apps/pwa/src/components/staff/staff-drawer.tsx`, `staff-detail-view.tsx`, `staff-detail-hero.tsx`, and `staff-list-card.tsx`; `apps/admin/src/features/salons/salon-setup-staff.tsx`; and shared Staff Profile forms, types, contracts, and persistence.
- Color consumers also exist in Calendar components, `apps/pwa/src/lib/today-view-model.ts`, database row mappers and Dashboard queries, invitations, signup, and Salon Handoff.
- `STAFF_COLORS` currently supplies defaults for services and Service Packages too. Audit those uses before removing or renaming shared definitions.

- Scope clarification on 2026-10-11: keep automatic staff colors from a predefined palette, with light and dark theme support; remove the per-profile setting and storage.

## Completion

- Removed staff color controls, forms, API fields, database reads and writes, and creation defaults. Services and Service Packages retain their color behavior through shared Calendar helpers.
- Migration `0034_remove_staff_profile_colors` drops only the obsolete columns on `staff_profiles` and `salon_member`. A Postgres regression migrates an existing installation and verifies every seeded operational record survives, while services keep their colors and profiles remain editable and creatable.
- Automatic staff accents use a deterministic ID hash and existing light/dark Calendar tokens. OKLab blending keeps avatar and Appointment hues consistent, and Calendar time labels use theme foreground text.
- Verification: 225 PWA, 336 core, 521 API, and 174 database unit tests; 31 database and 13 API Postgres integration tests; relevant typechecks; lint with no errors; schema/migration synchronization; PWA production build. The full PWA suite passed with two workers after two timeouts under unrestricted concurrency.
- Browser verification used mocked API responses at 390px width. Staff, Calendar, and Today passed in light and dark themes, with no staff color control or horizontal overflow. All five accents passed a 4.5:1 foreground contrast check for avatar and Calendar backgrounds in both themes. Screenshots are in ignored `output/playwright/bl0104-*.png`.

- Applied migration 0034 to the local `salon` database on 2026-10-11. Verified both obsolete columns are absent and existing counts remain unchanged: 5 profiles, 28 schedules, 35 service capabilities, 5 access records, 29 Appointments, and 13 Staff Commissions.
