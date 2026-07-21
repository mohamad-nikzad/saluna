---
id: BL-0067
title: Prove the complete Draft journey
status: ready
type: task
triage: ready-for-agent
priority: medium
size: medium
parent: BL-0061
blocked_by: [BL-0064, BL-0066]
created: 2026-07-21
updated: 2026-07-21
---

## Parent

[BL-0061 Capture flexible AppointmentRequests as manager drafts](BL-0061-plan-flexible-appointment-requests.md)

## What to Build

Prove the complete feature through the approved highest behavioral seam and close any integration gaps found there. The journey runs through the real PWA, API, and seeded Postgres rather than treating mocked route or query tests as acceptance evidence.

## Acceptance Criteria

- [ ] One serial Playwright manager journey creates a uniquely identified Draft, verifies its chronological group and content, edits its timing, converts it, and observes exactly one linked Appointment on the calendar.
- [ ] The journey proves that the pending Draft neither appears on the calendar nor blocks an overlapping Appointment before conversion.
- [ ] A changed-availability scenario rejects conversion, creates no Appointment, and leaves the Draft pending.
- [ ] Authorization coverage proves that unauthenticated, staff, and cross-salon callers cannot access manager Draft operations.
- [ ] Concurrency coverage proves that simultaneous conversion attempts produce one Appointment and one approved request.
- [ ] Lifecycle coverage proves rejection, cancellation, optional closure notes, expiry, terminal immutability, and creating a new Draft from terminal history.
- [ ] Exact public request submission, status, cancellation, and approval regression coverage remains green.
- [ ] Mock-based route tests remain limited to narrow status and contract mapping; the Playwright journey is the feature's acceptance seam.
- [ ] Any integration defects exposed by the journey are fixed without adding behavior outside BL-0061.

## Blocked By

- BL-0064 Convert a Draft into an Appointment.
- BL-0066 Expire and renew terminal Drafts.
