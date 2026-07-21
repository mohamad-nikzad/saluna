---
id: BL-0065
title: Close Drafts accurately
status: done
type: task
triage: ready-for-agent
priority: medium
size: medium
parent: BL-0061
blocked_by: [BL-0062]
created: 2026-07-21
updated: 2026-07-21
---

## Parent

[BL-0061 Capture flexible AppointmentRequests as manager drafts](BL-0061-plan-flexible-appointment-requests.md)

## What to Build

Let managers close Drafts without deleting history and record who ended the request. Salon rejection and customer withdrawal become distinct terminal outcomes available from each Draft's secondary actions.

## Acceptance Criteria

- [x] A manager can mark a pending Draft rejected when the salon declines it.
- [x] A manager can mark a pending Draft cancelled when the customer withdraws it.
- [x] Rejection and cancellation work without a mandatory reason and retain an optional closure note when supplied.
- [x] Both outcomes remove the request from active Drafts and show it in the matching existing lifecycle tab.
- [x] Closing a Draft never deletes it or changes its Client, BookedServiceSnapshot, timing preferences, notes, or history.
- [x] Rejected and cancelled requests are terminal and cannot be edited, converted, rejected again, or cancelled again.
- [x] Only authorized managers in the request's salon may close it.
- [x] Existing customer-token cancellation for exact public requests remains unchanged.

## Blocked By

- BL-0062 Record and list manager Drafts.
