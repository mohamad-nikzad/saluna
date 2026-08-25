---
id: BL-0078
title: Give managers a salon money report for completed Appointments
status: done
type: feature
triage: ready-for-agent
priority: medium
size: medium
created: 2026-08-11
updated: 2026-08-24
---

## Problem

Managers already settle Staff Commissions on `/commissions` and glance at this Jalali Month on Dashboard, but they cannot answer “how much did the salon book in this period?” with the slices they actually use: Staff Profile, ServiceVariant, and ServiceCategory. Commission figures are always on, so a manager who only wants booked totals still has to read a pay-period report. Dashboard stays a glance and must not grow these filters.

Saluna does not settle Client Payment (ADR-0023). Booked money is `AppointmentTotalsSnapshot`, never collected cash or profit. Do not label it “income” alone.

## Smallest Useful Version

Add a manager-only `/reports` page and fold `/commissions` into it. Settings replaces “گزارش کمیسیون” with one “گزارش‌ها” row. `/commissions` redirects to `/reports`. Dashboard, `/earnings`, and the Staff Profile commission panel stay.

The page is one salon money report. Default Reporting Period is the current Jalali Month. Period controls are today, this Salon Week, this Jalali Month, ماه قبل (previous Jalali Month), and custom inclusive Salon-local Dates.

Filters combine: Staff Profile, ServiceVariant, and ServiceCategory. An empty slice means all. Category may narrow the service list. Money counts completed Appointments only.

Headline money is مبلغ نوبت‌های انجام‌شده (completed booked totals). A hide/show control reveals Staff Commission and Salon Retained Amount for the same filtered set, using stored Staff Commissions, not a live rate. With commission shown, keep the current salon commission staff summary.

Under the cards, list matching completed Appointments: date, Client, ServiceVariant, Staff Profile, booked total. With commission shown, also basis, percent, and Staff Commission. Show 10 rows, then a show-more control that reveals the next 10 until the set is exhausted. Tapping a row opens the existing Appointment detail.

Reuse the shared Reporting Period helper (ADR-0038). Do not add Appointments analytics, an AppointmentRequest funnel, a second month helper, or a payment ledger.

## Acceptance Criteria

- [x] A manager can open `/reports` from Settings and see the salon money report for the current Jalali Month by default.
- [x] Staff cannot open `/reports` (same rule as today’s Dashboard and `/commissions`).
- [x] Period controls include today, this Salon Week, this Jalali Month, ماه قبل (previous Jalali Month), and a custom inclusive range of Salon-local Dates.
- [x] Staff Profile, ServiceVariant, and ServiceCategory filters combine; empty means all; metrics stay tenant-scoped to the current Salon.
- [x] Cards always show completed booked totals (`bookedTotalPrice` / commission basis). A hide/show control adds Staff Commission and Salon Retained Amount from stored Staff Commissions, not a live rate.
- [x] With commission shown, the existing per-staff commission summary remains available for the filtered set.
- [x] The completed-Appointment list shows 10 rows, then show-more in further tens, and a row opens Appointment detail.
- [x] UI copy never labels booked totals as collected cash, profit, Client Payment, or bare “income.”
- [x] Settings has one “گزارش‌ها” entry to `/reports`. `/commissions` redirects there. Dashboard, `/earnings`, and the Staff Profile commission panel are unchanged.

## Notes

- Shaped 2026-08-23. Replaced the earlier Dashboard analytics SUV (no-show rates, revenue trend, top services, AppointmentRequest funnel). Those are not this item.
- All-Appointments list is BL-0080, not this page. Show-more stays on `/reports`; it does not jump to BL-0080.
- Explicitly not in this item: Client Payment / POS, tax, inventory, payroll paid-out, clock-in attendance, SMS campaign ROI, Appointments analytics.
- Data caveats: prefer `bookedTotalPrice` / commission basis; Client `estimatedSpend` undercounts add-ons via `bookedServicePrice`. Staff slice uses Appointment Staff Assignment; salon-wide booked totals must not multiply when BL-0076 ships.
- Related: ADR-0038, BL-0079, BL-0017, BL-0019 / BL-0057 / BL-0058, BL-0076, BL-0080.
