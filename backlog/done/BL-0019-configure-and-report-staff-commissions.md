---
id: BL-0019
title: Configure and report Staff Commissions
status: done
type: feature
priority: medium
size: large
created: 2026-06-13
updated: 2026-07-17
---

## Problem Statement

Some Iranian salons compensate Staff Profiles with an agreed percentage of completed Appointment revenue instead of a salary. Managers currently cannot configure that agreement or reliably calculate each staff member's earnings, and staff cannot independently inspect the amount they have earned for a selected period. The product must distinguish calculated earnings from money collected, paid, or retained as profit.

## Solution

Allow a manager to activate one percentage-based Commission Agreement per Staff Profile. Appointments completed after activation produce Staff Commissions from their authoritative totals. Managers can inspect per-staff reports on Staff Profile detail pages and salon-wide totals; staff with active Staff Profile Access can privately inspect their own earnings. Reports support today, the current Saturday-to-Friday week, the current Jalali month, and inclusive custom date ranges.

## User Stories

1. As a manager, I want to activate a percentage Commission Agreement for a Staff Profile, so that the salon can calculate that person's earnings.
2. As a manager, I want the percentage validated between greater than 0 and 100 with up to two decimal places, so that invalid agreements cannot be saved.
3. As a manager, I want one percentage to apply across all services for a Staff Profile, so that the agreement stays understandable.
4. As a manager, I want an agreement to take effect immediately without backfilling earlier completions, so that enabling the feature does not rewrite history.
5. As a manager, I want later percentage changes to affect only later completions, so that previously earned commissions remain stable.
6. As a manager, I want to disable an agreement without deleting previous earnings, so that a changed compensation arrangement preserves history.
7. As a manager, I want to configure an unclaimed Staff Profile, so that earnings can accrue before the staff member gains login access.
8. As a manager, I want completing an eligible Appointment to produce one Staff Commission, so that earnings follow performed work.
9. As a manager, I want commission based on the Appointment's authoritative total, so that add-ons and manager-set final prices are included.
10. As a manager, I want each Appointment commission rounded to the nearest toman, so that report totals use payable units.
11. As a manager, I want an allowed final-price correction to recalculate commission with its original percentage, so that the earning follows the corrected charge without adopting a later agreement.
12. As a manager, I want moving an Appointment away from completed to void its commission, so that cancelled, no-show, or corrected visits do not remain in totals.
13. As a manager, I want restoring an Appointment to completed to restore its original commission, so that status corrections are reversible.
14. As a manager, I want a clear financial-history warning before deleting a completed Appointment, so that I understand its commission will also be permanently deleted.
15. As a manager, I want Service Package revenue allocated across task Appointments, so that each assigned Staff Profile earns from the package's actual booked price.
16. As a manager, I want package allocation rounding to total exactly the booked package price, so that no toman is created or lost.
17. As a manager, I want a Staff Profile detail report, so that I can review one staff member's gross revenue, commission total, completed count, and Appointment rows together.
18. As a manager, I want salon-wide gross revenue, total Staff Commissions, and Salon Retained Amount, so that I can understand the split across the salon.
19. As a manager, I want to filter salon-wide reporting by Staff Profile, so that I can investigate individual earnings.
20. As a manager, I want reports for today, this week, this Jalali month, and a custom range, so that common pay-period questions are quick to answer.
21. As a staff member, I want to see my active percentage and effective state, so that the agreement is transparent.
22. As a staff member, I want to see only my own gross Appointment total, Staff Commission total, completed count, and Appointment rows, so that I can verify my earnings without accessing another staff member's finances.
23. As a staff member, I want the same reporting periods as the manager, so that we can compare the same calculation.
24. As a staff member, I want earlier earnings to remain visible after my agreement is disabled, so that ending the agreement does not erase my history.
25. As a staff member who claims an existing Staff Profile, I want its earlier commission history to become visible, so that work recorded before login access is not lost.
26. As a salon user, I want financial labels to distinguish gross Appointment revenue, Staff Commission, and Salon Retained Amount, so that calculated amounts are not mistaken for collected payments, payouts, or profit.

## Implementation Decisions

- A Commission Agreement is salon-scoped and belongs to exactly one Staff Profile. A cross-salon staff identity has an independent agreement in each salon.
- Only managers may activate, change, or disable an agreement. Staff acceptance is not required.
- One percentage applies to every eligible service for the Staff Profile. There are no service-level or Appointment-level overrides.
- A percentage is greater than 0 and at most 100, with up to two decimal places.
- Activation is prospective. An Appointment becomes eligible only when it transitions to `completed` while an agreement is active; existing completed Appointments are not backfilled.
- A Staff Commission retains the percentage, basis, rounded amount, and Appointment association that produced it. Later agreement changes do not recalculate it.
- One Appointment produces at most one Staff Commission. Repeated completion requests must be idempotent.
- The basis for a regular Appointment is `bookedTotalPrice`, including booked add-ons and the manager-set final price.
- Commission is rounded per Appointment to the nearest toman before report aggregation.
- Editing the final price within the existing 24-hour window recalculates an existing Staff Commission using its stored percentage.
- Moving an Appointment away from `completed` voids its existing Staff Commission; restoring `completed` restores that commission with its original percentage.
- Permanently deleting a completed Appointment is allowed only after explicit UI confirmation and deletes its associated commission history.
- Disabling an agreement prevents later completions from earning commission but preserves existing commissions and their visibility.
- Commission ownership follows the salon-owned Staff Profile, not login identity. Staff Profile Access controls whether a staff identity may read that profile's history.
- A Service Package's booked price is allocated proportionally across task Appointments using their booked service prices. Remainders are distributed deterministically in task order so allocations sum exactly to the booked package price.
- A package task earns commission from its allocated amount when that task Appointment becomes completed.
- Reports use Appointment service dates. Today follows Tehran time, weeks run Saturday through Friday, Jalali month boundaries are converted to stored Gregorian dates, and custom ranges include both endpoints.
- The per-staff report is shared domain behavior exposed to managers on the Staff Profile detail page and to staff through a private self-reporting surface.
- The manager salon report returns gross eligible Appointment revenue, total Staff Commissions, Salon Retained Amount, per-staff summaries, and Appointment rows.
- Staff report authorization is enforced server-side using active Staff Profile Access and salon context. Staff cannot request another profile's report or salon-wide retained amounts.
- API contracts expose manager agreement management, per-staff reporting, and salon-wide reporting without leaking implementation storage details.
- Existing generated API-client and query patterns are reused; no new dependency or speculative accounting abstraction is introduced.

## Testing Decisions

- Tests assert external financial behavior and authorization, not internal query structure or component implementation details.
- The primary user-flow seam is one Playwright path through manager agreement configuration, Appointment completion, manager reporting, and staff self-reporting.
- Database integration tests cover prospective activation, percentage snapshots, per-Appointment rounding, idempotent completion, price correction, void/restore, deletion, disabling, and deterministic Service Package allocation.
- Existing API route-test patterns cover validation, response contracts, tenant isolation, manager-only writes, and staff self-only reads.
- Focused PWA tests are used only where the browser flow does not cheaply cover presentation behavior, especially the destructive-delete warning and period selection.

## Out of Scope

- Payment collection, refunds, tips, salary, staff payouts, paid/unpaid balances, debts, and settlement periods.
- Staff approval or negotiation of a Commission Agreement.
- Backfilling Appointments completed before agreement activation.
- Per-service, per-Appointment, fixed-amount, or tiered commission rules.
- Manual positive or negative commission adjustments.
- CSV, spreadsheet, print, or PDF export.

## Further Notes

- Prices and commission amounts are denominated in toman.
- Salon Retained Amount is `gross eligible Appointment revenue - Staff Commissions`; it is not collected cash or profit.
- Related work: BL-0017 accounting features, BL-0052 Appointment price editing window, and BL-0047 manager Service Package scheduling.
- Original note: “Add Staff and salon cuts from income.”
- Grilled against the domain model and current Appointment, Staff Profile Access, price-edit, Tehran calendar, and Service Package behavior on 2026-07-17.
- Closed 2026-07-17 after all six subtasks shipped with database integration, API authorization, focused PWA, and Playwright coverage.

## Subtasks

- [BL-0055 Activate Staff Commission for a regular Appointment](BL-0055-activate-staff-commission.md)
- [BL-0056 Keep Staff Commission correct through changes and deletion](BL-0056-correct-staff-commission-lifecycle.md)
- [BL-0057 Add period-based per-staff commission reporting](BL-0057-add-per-staff-commission-reporting.md)
- [BL-0058 Add salon-wide commission reporting](BL-0058-add-salon-wide-commission-reporting.md)
- [BL-0059 Allocate Service Package revenue to Staff Commissions](BL-0059-allocate-package-revenue-to-commissions.md)
- [BL-0060 Preserve commissions through Staff Profile Access changes](BL-0060-preserve-commissions-through-staff-access.md)
