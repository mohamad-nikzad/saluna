---
id: BL-0063
title: Organize and edit Draft timing
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

Make the Draft queue useful for day-to-day planning. Managers can capture arbitrary dates across weeks, use the quick “next week” action, edit the customer's current timing preferences, and scan Drafts grouped by the earliest date that can still be scheduled.

## Acceptance Criteria

- [x] Managers can select one or more unique acceptable dates from Salon-local today through 30 days ahead, including dates across calendar weeks.
- [x] “Next week” selects and stores all seven dates in the next Salon-local Saturday–Friday week without retaining a relative phrase.
- [x] Morning, Afternoon, Evening, and Any time use the spec's fixed half-open start-time boundaries and one choice applies to every acceptable date.
- [x] A pending Draft can edit only acceptable dates, Time Preference, and notes; Client, ServiceVariant, and BookedServiceSnapshot remain immutable.
- [x] Drafts are grouped into chronological sections by earliest remaining acceptable date and ordered oldest-first when that date ties.
- [x] A Draft spanning groups appears once while every acceptable date remains visible on its card.
- [x] Elapsed dates remain visible as history but cannot be selected for scheduling; a later remaining date advances the Draft to the appropriate group.
- [x] Similar or overlapping Drafts remain allowed without duplicate warnings or blocking.
- [x] Pure calendar checks cover Request Horizon bounds, “next week” normalization, unique dates, Time Preference membership, earliest-remaining grouping, and expiry cutoff.

## Blocked By

- BL-0062 Record and list manager Drafts.
