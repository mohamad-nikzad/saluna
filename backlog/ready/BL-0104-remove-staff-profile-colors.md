---
id: BL-0104
title: Remove Staff Profile colors
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

Managers can assign a color to a Staff Profile, but the user considers this setting useless and wants the whole feature removed. Removing only the picker would leave staff color data and styling throughout the app.

## Smallest Useful Version

Remove Staff Profile color selection, storage, API fields, defaults, and staff-specific rendering. Use shared theme styling for staff avatars and indicators. Keep names and initials visible so managers can still identify staff in lists and Appointments.

## Acceptance Criteria

- [ ] Staff Profile creation, editing, detail, onboarding, and admin Salon Setup have no staff color controls or color descriptions.
- [ ] Staff lists, profile headers, Calendar staff filters and indicators, and Today views no longer derive their appearance from a Staff Profile color.
- [ ] Staff Profile contracts, forms, API schemas, data clients, database reads and writes, and automatic profile creation no longer require, assign, or return staff color data.
- [ ] A database migration removes obsolete Staff Profile color storage from an existing installation without losing profiles, schedules, capabilities, Staff Profile Access, Appointments, or Staff Commissions.
- [ ] Shared color helpers and tokens used by services or Service Packages remain available under suitable names. Service colors, Appointment status colors, and general theme styling retain their existing behavior.
- [ ] Existing Staff Profiles still load and can be edited. Creating profiles through invitations, onboarding, Salon Handoff, and admin Salon Setup succeeds without a color value.
- [ ] Relevant typechecks and regression checks pass, and mobile staff, Calendar, and Today screens remain readable in light and dark themes.

## Notes

- User request on 2026-10-11: "remove the whole staff color, its useless and point less."
- Start with `apps/pwa/src/components/staff/staff-drawer.tsx`, `staff-detail-view.tsx`, `staff-detail-hero.tsx`, and `staff-list-card.tsx`; `apps/admin/src/features/salons/salon-setup-staff.tsx`; and shared Staff Profile forms, types, contracts, and persistence.
- Color consumers also exist in Calendar components, `apps/pwa/src/lib/today-view-model.ts`, database row mappers and Dashboard queries, invitations, signup, and Salon Handoff.
- `STAFF_COLORS` currently supplies defaults for services and Service Packages too. Audit those uses before removing or renaming shared definitions.
