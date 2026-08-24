---
id: BL-0080
title: Let managers browse and filter all Appointments
status: inbox
type: feature
triage: needs-triage
priority: medium
size: medium
created: 2026-08-23
updated: 2026-08-23
---

## Problem

Managers can run one Salon-local Date on Today and scan a schedule on Calendar, and they can open one Client’s history. They cannot open a dedicated list of the salon’s Appointments and filter that list. `/reports` (BL-0078) only lists completed Appointments as a money-report excerpt, capped with show-more, and is not an operational history.

## Smallest Useful Version

Give managers a dedicated Appointments page that lists Appointments for the current Salon and lets them filter the list. Staff do not get this page.

Exact filters, default range, and how this sits next to Today and Calendar are still open. Do not fold this into `/reports`.

## Acceptance Criteria

- [ ] A manager can open a dedicated page and see Appointments for their Salon.
- [ ] The manager can filter that list.
- [ ] Staff cannot open the page.
- [ ] Today, Calendar, and `/reports` keep their current jobs.

## Notes

- Captured 2026-08-23 while shaping BL-0078. Intentionally not the reports v1.
- Still to decide: route and Settings/nav placement; which filters (status, date, Staff Profile, ServiceVariant, Client, search); default range; pagination vs infinite list; tap-through to existing Appointment detail (likely yes).
- Related: BL-0078 (money report list is not this page), Today, Calendar, Client history.
