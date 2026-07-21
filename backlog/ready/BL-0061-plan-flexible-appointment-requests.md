---
id: BL-0061
title: Capture flexible AppointmentRequests as manager drafts
status: ready
type: feature
triage: ready-for-agent
priority: medium
size: large
created: 2026-07-19
updated: 2026-07-21
---

## Problem Statement

Managers at some small and medium salons receive rough appointment requests by SMS, phone, chat, or in person. Customers may ask for “next week,” name several suitable dates, or state a broad preference such as afternoon instead of choosing an exact slot. Managers currently keep this tentative demand in Apple Notes or on paper until they are ready to schedule it.

Saluna's current `AppointmentRequest` requires an exact date, start time, and end time and can only be submitted through the public flow. It cannot replace the manager's external notes without making tentative demand look like a scheduled `Appointment`.

## Solution

Let managers record a `Flexible AppointmentRequest` from the existing Requests page. A new Drafts tab provides a prominent New draft action and shows pending manager-recorded requests as cards grouped chronologically by their earliest remaining acceptable date. “Draft” is UI language for a pending manager-recorded `Flexible AppointmentRequest`, not a new domain object or status.

A flexible request records exactly one Client, one ServiceVariant and its binding `BookedServiceSnapshot`, one or more acceptable dates within the 30-day Request Horizon, one shared Time Preference, and optional notes. Managers can select arbitrary dates across weeks or use a quick “next week” action.

Each Draft card exposes Edit and Convert to Appointment actions. Conversion opens a focused scheduling sheet in which the manager chooses only the final date, start time, and Staff Profile. Saluna guides the manager toward choices that satisfy the request, then runs Appointment Intake as the authoritative validation gate before atomically creating the Appointment and approving the AppointmentRequest.

Pending Drafts never occupy staff calendars or hold availability. The existing exact public AppointmentRequest flow remains unchanged.

## User Stories

1. As a manager, I want to record a rough request received outside Saluna, so that I no longer need a notes application or paper.
2. As a manager, I want to create a Draft from the existing Requests page, so that tentative demand has one predictable home.
3. As a manager, I want a prominent New draft action at the top of the Drafts tab, so that recording a phone call or message is fast.
4. As a manager, I want to select an existing Client or create one while recording a Draft, so that the request belongs to a validated salon customer.
5. As a manager, I want to select exactly one ServiceVariant, so that the Draft has a known duration, price, and capability requirement.
6. As a manager, I want the ServiceVariant's name, duration, and price captured when the Draft is recorded, so that later catalog changes do not change the customer's request.
7. As a manager, I want to select one or more arbitrary acceptable dates, so that I can capture requests such as “Monday, Wednesday, or next Saturday.”
8. As a manager, I want acceptable dates to span calendar weeks, so that the date picker does not impose an artificial weekly boundary.
9. As a manager, I want a quick “next week” action, so that the most common rough request takes one action to record.
10. As a manager, I want “next week” resolved using the Salon-local Saturday–Friday week, so that the saved dates match the salon's planning language.
11. As a manager, I want acceptable dates limited to today through 30 days ahead, so that Drafts remain near-term and actionable.
12. As a manager, I want one broad Time Preference shared by every acceptable date, so that I can capture “these days, afternoon” without entering exact windows.
13. As a manager, I want Morning, Afternoon, Evening, and Any time choices, so that common customer language maps to clear scheduling constraints.
14. As a manager, I want the Time Preference to constrain only the Appointment start time, so that a service may finish after the named part of day.
15. As a manager, I want optional notes on a Draft, so that I can retain free-form details such as a preferred Staff Profile or callback instruction.
16. As a manager, I want pending Drafts kept off every staff calendar, so that tentative demand is never mistaken for a scheduled Appointment.
17. As a manager, I want pending Drafts not to reserve availability, so that other customers may still be scheduled normally.
18. As a manager, I want Drafts grouped by their earliest remaining acceptable date, so that the most urgent actionable demand appears first.
19. As a manager, I want sections such as This week, Next week, and Later, so that I can scan Drafts by planning horizon.
20. As a manager, I want each Draft shown exactly once even when its dates span groups, so that counts and actions are not duplicated.
21. As a manager, I want all acceptable dates visible on the Draft card, so that grouping does not hide later choices.
22. As a manager, I want elapsed acceptable dates retained but visibly unavailable, so that the original request remains understandable without offering impossible choices.
23. As a manager, I want Drafts with the same next date ordered oldest-first, so that older customer requests do not get buried.
24. As a manager, I want to edit acceptable dates, Time Preference, and notes while a Draft is pending, so that I can record a changed customer agreement.
25. As a manager, I want Client and booked service details immutable after creation, so that the identity and commercial history of the request remain trustworthy.
26. As a manager, I want to convert a Draft into an Appointment without re-entering the Client or service, so that scheduling is quick and consistent.
27. As a manager, I want the conversion sheet to show the Client, BookedServiceSnapshot, acceptable dates, Time Preference, and notes, so that I can review the request while scheduling it.
28. As a manager, I want conversion to collect only final date, start time, and Staff Profile, so that scheduling cannot silently change the customer's requested work.
29. As a manager, I want the final-date control limited to remaining acceptable dates, so that I do not accidentally schedule outside the agreement.
30. As a manager, I want the start-time control limited to the Time Preference, so that I do not accidentally violate the customer's stated availability.
31. As a manager, I want the Staff Profile control limited to capable staff, so that known capability errors are prevented before submission.
32. As a manager, I want Salon Working Days, staff schedules, capabilities, and Appointment conflicts validated when I submit, so that stale UI state cannot create an invalid Appointment.
33. As a manager, I want the Appointment end time derived from the binding booked duration, so that I do not need to calculate or enter it.
34. As a manager, I want Draft notes copied to the Appointment, so that relevant context follows the scheduled work.
35. As a manager, I want successful conversion to create one normal Appointment and approve and link the AppointmentRequest, so that it leaves Drafts and cannot be converted twice.
36. As a manager, I want an unsuccessful conversion to leave the Draft pending and create no Appointment, so that I can correct the selection safely.
37. As a manager, I want to reject a Draft when the salon declines it, so that it leaves active work while preserving history.
38. As a manager, I want to cancel a Draft when the customer withdraws it, so that the recorded outcome distinguishes customer intent from salon rejection.
39. As a manager, I want rejection and cancellation to work without a mandatory reason, so that closing a quick Draft remains lightweight.
40. As a manager, I want to add an optional closure note, so that unusual outcomes can retain context.
41. As a manager, I want a Draft to expire only after its final acceptable date fully ends in Salon local time, so that it remains actionable throughout that date.
42. As a manager, I want approved, rejected, cancelled, and expired requests to remain terminal, so that history cannot be rewritten by reopening them.
43. As a manager, I want to create a new Draft from a terminal request, so that renewed demand does not require re-entering stable Client, ServiceVariant, and note details.
44. As a manager, I want copied Drafts to require fresh dates and a fresh Time Preference, so that stale availability is never carried forward.
45. As a manager, I want overlapping Drafts allowed, so that legitimate similar requests are not blocked by unreliable duplicate detection.
46. As a manager, I want staff preferences kept as visible notes rather than enforced constraints, so that I retain human judgment over the final capable Staff Profile.
47. As a staff user, I want manager Drafts hidden from my operational calendar, so that I see only real scheduled work.
48. As a customer, I want the existing exact public request submission, status, cancellation, and approval behavior to continue unchanged.

## Implementation Decisions

- Extend the existing `AppointmentRequest` aggregate as established by ADR-0014. Do not introduce a Draft aggregate, new lifecycle state, or separate planning table.
- Treat “Draft” as manager-facing UI copy for a pending manager-recorded `Flexible AppointmentRequest`.
- Preserve the lifecycle `pending` → `approved` | `rejected` | `cancelled` | `expired` for exact and flexible requests.
- Record whether an AppointmentRequest uses an exact slot or flexible preferences and enforce an exclusive-or invariant: exactly one mode must be present.
- Preserve exact request fields and public contracts for backward compatibility. Fields that exist only for exact timing must not be required for flexible mode.
- Add an optional Client relationship to AppointmentRequest. Require it for manager-recorded flexible requests; public exact requests may remain unlinked until approval.
- Require exactly one ServiceVariant for a flexible request and bind its BookedServiceSnapshot name, duration, and price at creation.
- Do not support Service Packages or ServiceAddons on flexible requests.
- Accept one or more normalized Gregorian acceptable dates from Salon-local today through 30 days ahead, inclusive. Dates may cross calendar weeks.
- Enforce unique acceptable dates within one request and store them as normalized calendar constraints rather than preserving relative phrases.
- Resolve “next week” to all seven dates in the next Salon-local Saturday–Friday week. Salon Working Days constrain conversion, not the recorded customer preference.
- Use one Time Preference for all acceptable dates: Morning `[00:00, 12:00)`, Afternoon `[12:00, 17:00)`, Evening `[17:00, 24:00)`, or Any time.
- Apply Time Preference to the Appointment start time only; the derived end time may cross the preference boundary.
- Add manager contracts for creating a flexible request, editing its mutable timing preferences and notes, converting it, cancelling it on the customer's behalf, and creating a new Draft from a terminal request.
- Keep manager request authorization tenant-scoped and limited to the existing appointment-management permission. Staff users receive no Draft access.
- On flexible creation, reject a missing Client, invalid or inactive ServiceVariant, empty acceptable-date set, out-of-horizon date, duplicate date, or invalid Time Preference.
- While pending, permit updates only to acceptable dates, Time Preference, and notes. Client, ServiceVariant, and BookedServiceSnapshot remain immutable.
- Treat the saved dates and Time Preference as the current customer agreement. Do not add consent flags or preference-history storage.
- Add a Drafts tab to the existing Requests page with a top New draft action.
- Group a Draft by its earliest remaining acceptable date into chronological sections such as This week, Next week, and Later.
- Render a Draft only once and show every acceptable date on its card. Mark elapsed dates unavailable instead of deleting them.
- Within a section, order Drafts by earliest remaining acceptable date, then oldest creation time.
- Each card provides Edit and Convert to Appointment as primary actions and rejection/cancellation through secondary actions.
- Use the established mobile FormSheet shell and existing Client, ServiceVariant, Jalali date, time, and staff controls for creation, editing, and conversion where their contracts fit.
- Build a focused conversion form rather than reusing the unrestricted Appointment creation form. The latter exposes service, Client, package, add-on, duration, and price changes that conversion forbids.
- Show Client, BookedServiceSnapshot, all dates, Time Preference, and notes in the conversion sheet as read-only context.
- Accept only final date, start time, and Staff Profile during conversion. Derive end time from the binding booked duration.
- Constrain final-date choices to remaining acceptable dates, start-time choices to the Time Preference, and Staff Profile choices to active capable staff.
- Keep Appointment Intake authoritative on submission. Re-run Salon Working Day, staff schedule, capability, and conflict validation because availability may change after rendering.
- Reject any submitted final date or start time outside the stored preferences even if the client attempted to bypass constrained controls.
- Copy the Draft notes into the resulting Appointment. Do not interpret preferred staff written in notes as a machine-enforced constraint.
- Perform Appointment creation and the conditional `pending` → `approved` request update in one transaction. On any validation, creation, or concurrent-state failure, create no Appointment and leave the request unchanged.
- Link a successfully approved request to exactly one Appointment and prevent repeat conversion with a conditional pending-state transition.
- Keep all pending AppointmentRequests outside Appointment calendar, availability, revenue, retention, and conflict read models, preserving ADR-0001 and ADR-0002.
- Rejecting means the salon declined the request; cancelling means the customer withdrew it. Neither outcome deletes the request.
- Allow an optional shared closure note for rejection or cancellation; do not require one.
- Determine schedulability using current or future acceptable dates without erasing elapsed dates from history.
- Expire a pending flexible request after its last acceptable date has fully ended in Salon local time.
- Keep approved, rejected, cancelled, and expired requests terminal. Never reopen them.
- “Create new Draft from this” copies the Client, ServiceVariant reference, and notes into a distinct pending request, binds a fresh current ServiceVariant snapshot, and requires new timing preferences. If the Client or ServiceVariant is no longer selectable, require a valid replacement instead of silently copying it.
- Do not block or warn on similar pending Drafts. Overlap is legitimate under ADR-0002.
- Update the OpenAPI contract and generated client types for the exact/flexible response union and manager lifecycle operations without changing existing exact public payloads.
- Do not add a standalone weekly planning screen, calendar side panel, suggestion engine, or compactness-ranking service.

## Testing Decisions

- Test external behavior rather than storage representation, internal helper calls, component structure, or sorting implementation details.
- Use one primary acceptance seam: a Playwright manager journey through the real PWA, API, and seeded Postgres.
- The primary journey creates a Draft, verifies its chronological group and card contents, edits timing preferences, converts it, and observes exactly one linked Appointment on the calendar and no remaining active Draft.
- Extend the existing critical salon journey pattern for authentication, seeded Client/ServiceVariant/Staff Profile data, FormSheet interaction, response waiting, and calendar verification.
- Keep the end-to-end test serial and use unique data so repeated local or CI runs do not collide with seeded requests.
- At the same seam, verify that a pending Draft does not appear on the calendar or block creation of an overlapping Appointment before conversion.
- At the same seam, exercise a server-rejected conversion caused by changed availability and verify that no Appointment is created and the Draft remains pending.
- Add small pure-function tests only for calendar logic that would make the Playwright test slow or opaque: Salon-local “next week” normalization, Request Horizon bounds, unique-date normalization, Time Preference membership, earliest-remaining-date grouping, and expiry cutoff.
- Cover dates spanning weeks and verify that the Draft appears once under its earliest remaining date while all dates remain visible.
- Cover an elapsed early date with a remaining later date and verify that the early date stays visible but cannot be selected.
- Cover all four Time Preferences and verify half-open start-time boundaries, including that an Appointment may end after the band.
- Cover flexible input validation at the authenticated manager API boundary: missing Client, empty dates, conflicting exact/flexible modes, out-of-horizon dates, duplicate dates, and unsupported service/package/add-on inputs.
- Cover authorization at the existing route-test seam: unauthenticated and staff callers cannot list, create, edit, convert, reject, cancel, or copy Drafts; another salon cannot address them by ID.
- Cover conditional lifecycle behavior at the AppointmentRequest boundary: only pending requests may be edited, converted, rejected, or cancelled; terminal requests may only seed a new Draft.
- Cover successful conversion with a catalog-edited ServiceVariant and verify the Appointment retains the Draft's BookedServiceSnapshot name, duration, and price.
- Cover rejected final date, Time Preference violation, closed Salon Working Day, inactive staff schedule, missing capability, and Appointment conflict through Appointment Intake behavior.
- Cover concurrent conversion attempts and verify one Appointment, one approved request, and one conflict response.
- Cover rejection versus customer cancellation, optional closure notes, terminal immutability, and history retention.
- Cover copying a terminal request and verify a distinct ID, fresh snapshot, copied stable details, and absent timing preferences.
- Preserve an existing exact public AppointmentRequest regression test covering submit, status, cancellation, and approval.
- Preserve existing mock-based route tests for narrow HTTP status and contract mapping, but do not use them as the feature's acceptance seam.

## Out of Scope

- Flexible public customer submission.
- A standalone weekly planning screen or calendar side panel.
- Suggested-slot ranking or compact-week optimization.
- Automatically choosing, approving, or moving Appointments.
- Automatically messaging customers or negotiating alternative dates or times.
- Preference consent history or audit records.
- Deposits or payment changes.
- Recurring requests, waitlists, Service Packages, ServiceAddons, or requests without a known ServiceVariant.
- Arbitrary time windows or salon-configurable Time Preference bands.
- Different Time Preferences per acceptable date.
- Structured preferred-Staff constraints; record them in notes in this version.
- Blocking or warning on similar pending Drafts.
- Reopening terminal AppointmentRequests.
- Opening or closing Salon Working Days automatically based on demand.

## Further Notes

- The workflow was observed with a test salon that collects customer requests during the week in Apple Notes and plans later in a batch.
- Example constraints include “sometime next week” and “one of these days, afternoon only.”
- A throwaway UI prototype compared three Drafts-tab layouts. The selected direction groups Draft cards chronologically, places New draft at the top, and keeps Edit and Convert to Appointment on each card; the prototype code was removed after the decision was captured.
- ADR-0014 records why public exact requests and manager-recorded flexible Drafts remain one AppointmentRequest aggregate despite different origins and Client requirements.
- ADR-0002 continues to govern availability: pending requests never reserve slots.

## Subtasks

- [BL-0062 Record and list manager Drafts](BL-0062-record-list-manager-drafts.md) — blocked by none
- [BL-0063 Organize and edit Draft timing](BL-0063-organize-edit-draft-timing.md) — blocked by BL-0062
- [BL-0064 Convert a Draft into an Appointment](BL-0064-convert-draft-to-appointment.md) — blocked by BL-0063
- [BL-0065 Close Drafts accurately](BL-0065-close-drafts-accurately.md) — blocked by BL-0062
- [BL-0066 Expire and renew terminal Drafts](BL-0066-expire-renew-terminal-drafts.md) — blocked by BL-0063 and BL-0065
- [BL-0067 Prove the complete Draft journey](BL-0067-prove-complete-draft-journey.md) — blocked by BL-0064 and BL-0066
