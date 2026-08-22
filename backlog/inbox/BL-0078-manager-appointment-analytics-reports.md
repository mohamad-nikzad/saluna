---
id: BL-0078
title: Give managers period analytics from existing Appointment data
status: inbox
type: feature
triage: needs-triage
priority: medium
size: medium
created: 2026-08-11
updated: 2026-08-22
---

## Problem

Managers can run the day on Today and settle Staff Commissions on period reports, but the Dashboard only shows a static month glance. They cannot answer common salon questions from data Saluna already stores:

- What share of Appointments ended as no-show or cancelled?
- Is completed booked revenue trending up or down day to day?
- Which ServiceVariants drive money, not just visit count?
- How are AppointmentRequests converting out of the inbox?

Broader accounting (cash, expenses, tax) is out of scope here — see BL-0017. Saluna does not settle Client Payment (ADR-0023); money metrics must stay booked totals / commission basis, never “collected cash” or “profit.”

## Smallest Useful Version

Extend the existing manager Dashboard (`/dashboard`) with the same period controls already used on salon commission reports (today / week / Jalali month / custom). For the selected period, show:

1. **No-show and cancellation rates** — counts and % of Appointments by status (at least completed vs cancelled vs no-show).
2. **Completed revenue trend** — completed `AppointmentTotalsSnapshot` (`bookedTotalPrice` / commission basis) by day within the period.
3. **Top ServiceVariants by revenue** — completed booked totals, not appointment count.
4. **AppointmentRequest funnel** — counts by status (`pending` / `approved` / `rejected` / `cancelled` / `expired`) for requests touching the period.

Reuse the shared Reporting Period (ADR-0038): today, Salon Week, Jalali Month, or custom inclusive Salon-local Dates. Do not invent a new product area, payment ledger, or a second month helper.

## Acceptance Criteria

- [ ] A manager can open Dashboard and select a reporting period using the commission-style period controls.
- [ ] For that period, the manager sees no-show and cancellation rates (counts and percentages) derived from Appointment status.
- [ ] For that period, the manager sees completed booked revenue broken down by day (or an equivalent period trend).
- [ ] For that period, the manager sees top ServiceVariants ranked by completed booked revenue (using `bookedTotalPrice` / commission basis, not catalog price or count-only).
- [ ] For that period, the manager sees AppointmentRequest status counts (funnel).
- [ ] UI copy never labels booked totals as collected cash, profit, or Client Payment.
- [ ] Staff users still cannot access Dashboard.
- [ ] Metrics stay tenant-scoped to the current Salon.

## Notes

- Source audit: manager reporting inventory against schema + Today / Dashboard / Commissions / Retention (2026-08-11). Canvas: manager-reports-audit.
- Already strong elsewhere: Today (day ops + overdue outcomes), `/commissions` (pay periods), `/retention` (action queue).
- Explicitly **not** in this item: Client Payment / POS, tax, inventory, payroll paid-out, clock-in attendance, SMS campaign ROI.
- Follow-on candidates (same data, later slices): Staff Profile utilization %, retention follow-up outcomes, repeat/churn cohorts, package vs single mix, addon attach rate, capacity heat, assignment-aware staff scorecard, placeholder Client debt.
- Data caveats before/while building:
  - Prefer `bookedTotalPrice` / commission basis for money; Client `estimatedSpend` currently undercounts add-ons via `bookedServicePrice`.
  - Dashboard staff load still keys off lead `appointments.staffId`; Today uses assignments — align before any multi-staff scorecard follow-on (BL-0076).
- Related: ADR-0038 (Reporting Period), BL-0079 (Dashboard must already use that period before new analytics), BL-0017 (broader accounting), BL-0019 / BL-0057 / BL-0058 (commission reporting already shipped), BL-0076 (multi-staff assignments).
