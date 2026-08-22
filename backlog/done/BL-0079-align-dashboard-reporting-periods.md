---
id: BL-0079
title: Align manager Dashboard with Salon-local Reporting Periods
status: done
type: task
triage: ready-for-agent
priority: high
size: small
blocked_by: []
created: 2026-08-22
updated: 2026-08-22
---

## Problem

The manager Dashboard labels KPIs as “این ماه” but `getDashboardData` still bounds that month with JavaScript’s Gregorian calendar and UTC date strings. Staff Commission reports already use a Reporting Period (Tehran today, Salon Week, Jalali Month). The same Appointment can count in one “this month” and not the other. ADR-0038 makes that disagreement invalid.

## Smallest Useful Version

Make Dashboard today / week / month the same Reporting Period commissions already use. Do not add period pickers or new analytics (that is BL-0078).

## Acceptance Criteria

- [x] Dashboard today, week, and month bounds come from one shared Reporting Period helper, not local `Date` month math or `toISOString()` date prefixes.
- [x] “This month” on Dashboard is the current Jalali Month in Salon-local Dates; “this week” is the current Salon Week; “today” is the current Salon-local Date.
- [x] Month-scoped Dashboard numbers all use that Jalali Month: completed appointment totals, Salon Retained Amount, appointment counts, popular services, staff load, month status breakdown, and new Clients.
- [x] New-Client `createdAt` filtering uses Salon-local start and end of those dates, not naive UTC midnight.
- [x] Commission `این ماه` and Dashboard `این ماه` cover the same inclusive Gregorian date range for the same instant.
- [x] Automated checks freeze a Tehran-boundary instant (same pattern as `commissionPeriodRange` tests) and assert Jalali month edges, not Gregorian `YYYY-MM-01`.
- [x] Printed dates on Dashboard, if any are added, stay Jalali; stored and API dates stay Gregorian `yyyy-MM-dd`.

## Notes

- Decision: [ADR-0038](../../docs/adr/0038-manager-facing-periods-use-jalali-months.md).
- Lift or wrap `commissionPeriodRange` in `@repo/salon-core` so Dashboard does not own a second copy and later reports (BL-0078, accounting) can import the same helper.
- Unmerged `origin/codex/bugfix-2026-08-11-133240` fixed Tehran today/week but kept Gregorian months; do not land that month helper.
- Out of scope: SMS Allowance periods, Salon Subscription terms, period pickers, new Dashboard charts.
