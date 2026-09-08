---
id: BL-0080
title: Let managers browse and filter all Appointments
status: done
type: feature
triage: ready-for-agent
priority: medium
size: medium
created: 2026-08-23
updated: 2026-09-08
---

## Problem

Managers can run one Salon-local Date on Today and scan a schedule on Calendar, and they can open one Client’s history. They cannot open a dedicated list of the salon’s Appointments and filter that list. `/reports` (BL-0078) only lists completed Appointments as a money-report excerpt, capped with show-more, and is not an operational history.

## Smallest Useful Version

Give managers a dedicated Appointments page that lists Appointments for the current Salon and lets them filter the list. Staff do not get this page.

Exact filters, default range, and how this sits next to Today and Calendar are still open. Do not fold this into `/reports`.

## Acceptance Criteria

- [x] A manager can open a dedicated page and see Appointments for their Salon.
- [x] The manager can filter that list.
- [x] Staff cannot open the page.
- [x] Today, Calendar, and `/reports` keep their current jobs.

## Notes

- Captured 2026-08-23 while shaping BL-0078. Intentionally not the reports v1.
- Still to decide: route and Settings/nav placement; which filters (status, date, Staff Profile, ServiceVariant, Client, search); default range; pagination vs infinite list; tap-through to existing Appointment detail (likely yes).
- Related: BL-0078 (money report list is not this page), Today, Calendar, Client history.

## Implementation

- Manager-only `/appointments`, reached through Settings → نوبت‌ها. Staff are redirected to Today.
- Defaults to the current Jalali Month. Reuses Reporting Period presets and custom inclusive Salon-local Dates.
- Filters by status, any assigned Staff Profile, historical ServiceVariant, and Client name or phone, including Persian digits.
- Lists newest dates and times first, with 25 rows per page. Filtering and pagination run over the complete selected date range returned by the existing salon-scoped Appointment API. Large custom ranges still load all matching Appointments into the browser.
- Rows open the existing Calendar Appointment detail. Today, Calendar, and reports retain their current responsibilities.

## Verification

- PWA production build, TypeScript, and lint pass.
- Eight focused tests pass across the list component, route access guard, and existing Appointment query tests. Covers pagination, Persian-digit phone search, empty results, retry, manager access, and staff redirect.
- Running browser loaded a real Appointment, retained it when filtering by an additional assigned Staff Profile, and opened its Calendar detail drawer.
- Staff browser login could not be completed because both advertised seeded staff passwords were rejected. The actual route guard is covered by automated tests.
