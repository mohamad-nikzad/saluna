---
id: BL-0066
title: Expire and renew terminal Drafts
status: ready
type: task
triage: ready-for-agent
priority: medium
size: medium
parent: BL-0061
blocked_by: [BL-0063, BL-0065]
created: 2026-07-21
updated: 2026-07-21
---

## Parent

[BL-0061 Capture flexible AppointmentRequests as manager drafts](BL-0061-plan-flexible-appointment-requests.md)

## What to Build

Complete the flexible lifecycle by expiring Drafts only after their final acceptable date ends and letting managers start renewed demand from any terminal request without reopening or rewriting history.

## Acceptance Criteria

- [ ] A pending Flexible AppointmentRequest remains actionable throughout its final acceptable date in Salon local time.
- [ ] It becomes expired only after no acceptable date remains, regardless of earlier elapsed dates.
- [ ] Exact-request expiry continues to use its existing exact-date behavior.
- [ ] Approved, rejected, cancelled, and expired AppointmentRequests remain terminal and cannot be reopened.
- [ ] Terminal request views offer Create new Draft from this to authorized managers.
- [ ] The new Draft receives a distinct identity and copies the valid Client, ServiceVariant reference, and notes while requiring fresh acceptable dates and Time Preference.
- [ ] The new Draft binds a fresh current ServiceVariant snapshot rather than copying the old snapshot.
- [ ] An unavailable Client or ServiceVariant requires a valid replacement instead of being silently copied.
- [ ] Creating a renewed Draft leaves the source request unchanged and preserved in its terminal lifecycle tab.

## Blocked By

- BL-0063 Organize and edit Draft timing.
- BL-0065 Close Drafts accurately.
