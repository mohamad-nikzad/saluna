---
id: BL-0077
title: Set per-service Staff Commission overrides
status: ready
type: feature
triage: ready-for-agent
priority: medium
size: medium
blocked_by: [BL-0076]
created: 2026-08-07
updated: 2026-08-07
---

## Problem

One Staff Profile may earn different commission percentages for different services. Saluna currently applies one Commission Agreement percentage to every eligible Appointment for that profile, forcing managers to accept inaccurate calculations or repeatedly change the agreement before completion.

## Smallest Useful Version

Keep one Commission Agreement per Staff Profile with one required default percentage. Let a manager add, edit, or remove optional Service Commission Overrides on the Staff Profile detail page. At Appointment completion, use that Staff Profile's override for the Appointment's ServiceVariant when one exists; otherwise use the default percentage.

Reuse the existing Eligible Commission Basis, rounding, snapshot, lifecycle, authorization, and reporting behavior. Do not create copied rules for every service: store only explicit overrides.

## Acceptance Criteria

- [ ] Every existing Commission Agreement percentage becomes its default percentage without changing existing Staff Commissions or backfilling earlier completed Appointments.
- [ ] A manager can list, add, edit, and remove at most one Service Commission Override for each Staff Profile and ServiceVariant in the same salon.
- [ ] Default and override percentages are greater than 0 and at most 100, with up to two decimal places.
- [ ] Completing an Appointment uses the assigned Staff Profile's override for the Appointment's ServiceVariant when present and the active agreement's default percentage otherwise.
- [ ] The effective percentage is selected when the Appointment first becomes completed and is stored on the resulting Staff Commission; repeated completion remains idempotent.
- [ ] Adding, editing, or removing an override affects only later completions. Existing commissions keep their stored percentage.
- [ ] Changing the default percentage affects only later completions for services without an override and does not change or remove existing overrides.
- [ ] Disabling a Commission Agreement pauses its default and every override without deleting them; reactivating the agreement restores the preserved overrides unless the manager changes or removes them.
- [ ] An Appointment first completed without an active Commission Agreement remains excluded from commission even if an agreement or override is later added and the Appointment is moved away from and back to completed.
- [ ] Final-price corrections, moving away from completed, and restoring completion continue to recalculate, void, or restore a Staff Commission with its originally stored percentage.
- [ ] Changing an Appointment's ServiceVariant before its first completion uses the newly selected service's applicable percentage; later service renames or catalog edits do not rewrite the recorded Staff Commission.
- [ ] The override is selected from the Appointment's base ServiceVariant and applies to its full existing Eligible Commission Basis, including add-ons and manager-set final prices; there are no separate add-on overrides.
- [ ] A Service Package task uses the override for that task's ServiceVariant on its deterministic package-price allocation; there are no package-level overrides.
- [ ] After BL-0076, every Appointment Staff Assignment resolves its own assigned Staff Profile and ServiceVariant percentage independently, then applies it to that assignment's Work Allocation without duplicating salon-wide revenue or completed counts.
- [ ] Archiving a ServiceVariant or removing a Staff Profile's capability does not silently delete an existing override. The manager can still see and remove it, and it remains applicable to an already-booked Appointment completed later.
- [ ] Manager writes reject Staff Profiles and ServiceVariants from another salon. Staff cannot create, edit, or remove overrides.
- [ ] A staff member with active Staff Profile Access can read their own agreement's default percentage and Service Commission Overrides, including whether the agreement is disabled, but cannot read another profile's agreement.
- [ ] Commission reports continue to show each Staff Commission's applied percentage and agree across per-staff and salon-wide totals for defaulted and overridden services.
- [ ] Automated checks cover fallback, override selection, configuration changes, disable/reactivate, price and status lifecycle, add-ons, package tasks, multi-staff allocation, archived services, tenant isolation, and staff self-read authorization.

## Out of Scope

- Zero-percent service exclusion.
- Category-, add-on-, package-, or Appointment-specific overrides.
- Fixed-amount, tiered, or time-based commission rules.
- Retroactive recalculation or backfilling.
- Staff approval or negotiation workflows.

## Notes

- The override belongs to the Staff Profile–ServiceVariant pair inside its Commission Agreement; it does not belong to the service globally.
- An override equal to the default is harmless but unnecessary; removing it restores fallback behavior.
- BL-0076 is a blocker because it changes commission creation from one row per Appointment to one row per Appointment Staff Assignment. Implementing overrides afterward avoids conflicting schema and lifecycle changes.
- Related: BL-0019 Configure and report Staff Commissions and BL-0059 Allocate Service Package revenue to Staff Commissions.

## Blocked By

- BL-0076
