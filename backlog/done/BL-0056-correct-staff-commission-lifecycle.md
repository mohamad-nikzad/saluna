---
id: BL-0056
title: Keep Staff Commission correct through changes and deletion
status: done
type: task
priority: medium
size: medium
parent: BL-0019
blocked_by: [BL-0055]
created: 2026-07-17
updated: 2026-07-17
---

## Parent

[BL-0019 Configure and report Staff Commissions](BL-0019-configure-and-report-staff-commissions.md)

## What to build

Keep recorded Staff Commissions correct when managers change or disable an agreement and when the source Appointment's price, status, or existence changes. Preserve historical percentages except when the user explicitly confirms permanent Appointment deletion.

## Acceptance Criteria

- [x] Changing an agreement affects only Appointments completed afterward; existing commissions keep their recorded percentages.
- [x] Disabling an agreement prevents new commissions and preserves prior commission history.
- [x] An allowed final-price edit recalculates the existing commission with its original percentage.
- [x] Moving an Appointment away from `completed` voids its commission and removes it from totals.
- [x] Restoring the Appointment to `completed` restores the voided commission with its original percentage without creating a duplicate.
- [x] Deleting a completed Appointment requires a clear warning that commission history will be permanently deleted.
- [x] Confirmed Appointment deletion removes the associated Staff Commission, while cancellation or no-show preserves it as voided history.
- [x] The lifecycle is covered through database integration, API behavior, and the destructive-confirmation UI seam.

## Blocked by

- BL-0055

## Notes

- Closed 2026-07-17.
