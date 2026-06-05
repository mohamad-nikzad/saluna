# Test Manager Reported Issues

Date captured: 2026-06-05

This tracker normalizes the reported QA/UX issues into implementation-ready tasks.

## Summary Groups

| Group | Theme | Priority | Tasks | Status |
| --- | --- | --- | --- | --- |
| A | Validation visibility and form recovery | P1 | A1 | **Done** |
| B | Numeric and time input editing | P1 | B1 | **Done** |
| C | Calendar UX and navigation | P1 | C1, C2, C3, C4 | **Done** |
| D | Appointment edit drawer mutations | P1 | D1, D2 | Open |
| E | Appointment Intake service/staff availability dead-ends | P1 | E1 | Partial |

**Done (6):** A1, B1, C1, C2, C3, C4  
**Partial (1):** E1 — capability vs availability split and form recovery started; not all acceptance criteria met  
**Open (2):** D1, D2

## A. Validation Visibility and Form Recovery

### A1. Surface hidden invalid Salon Presence fields during onboarding

**Status:** Done — auto-open first invalid row, collapsed error state, scroll/focus on submit, `presence-validation` tests

**Report**

On the onboarding page for address, map links, and social links, when a manager enters incorrect data and clicks continue, they cannot see which inputs are invalid.

**Normalized issue**

Salon Presence uses collapsed rows for address, map links, and social links. Validation errors can be attached to fields inside closed rows, so the user sees that the step did not continue but may not see the invalid field or error message.

**Likely affected surfaces**

- `apps/pwa/src/routes/_authed/onboarding/presence.tsx`
- `apps/pwa/src/components/public-page/presence-form.tsx`
- `apps/pwa/src/components/public-page/presence-fields.tsx`
- `packages/salon-core/src/forms/presence.ts`

**Task**

Make validation failures visible and actionable in the Salon Presence form.

**Acceptance criteria**

- When submitting invalid Salon Presence data, the first invalid collapsed row opens automatically.
- The invalid row shows a visible error state even when collapsed.
- Focus or scroll moves to the first invalid field/row after submit.
- The footer submit state and root errors do not hide field-level errors.
- Works for invalid map URLs, social handles, WhatsApp phone, and website URL.
- Add focused tests for the error-to-open-row behavior if the existing test setup supports this component level.

## B. Numeric and Time Input Editing

### B1. Make numeric inputs editable when users clear existing values

**Status:** Done (`86b9363` — `LocalizedNumberInput`, appointment/service drawers, regression tests)

**Report**

Number input edits are hard. Managers cannot remove the current value and enter a new number; they cannot remove the last digit. Example: appointment drawer end time/duration and other places. Suggested direction: use text input with decimal/numeric input mode and validate non-number values.

**Normalized issue**

Controlled inputs render localized digits from numeric values and parse changes back to numbers immediately. When the user clears the field, parsing falls back to the previous value or `0`, so the last digit reappears and normal editing becomes frustrating.

**Known affected surfaces**

- Appointment create duration: `apps/pwa/src/components/calendar/appointment-drawer.tsx`
- Appointment detail edit duration: `apps/pwa/src/components/calendar/appointment-detail/appointment-detail-edit-form.tsx`
- Service duration: `apps/pwa/src/components/services/service-drawer.tsx`
- Service addon duration/sort order: `apps/pwa/src/components/services/service-addon-drawer.tsx`

**Task**

Introduce a reusable localized numeric text-input pattern that permits intermediate empty/invalid strings while preserving numeric validation on blur/submit.

**Acceptance criteria**

- Users can select all, delete, and type a new value without the old value reappearing.
- Empty values are allowed while editing and validated on blur/submit with a clear error message.
- Inputs use `type="text"` with `inputMode="numeric"` or `inputMode="decimal"` as appropriate.
- Persian and Latin digits are accepted.
- Non-numeric characters do not break the controlled input; they are either rejected gently or produce validation errors.
- Existing schemas remain the source of truth for final numeric constraints.
- Add regression tests for clearing the last digit and entering a new value.

## C. Calendar UX and Navigation

### C1. Make month-view day interaction deterministic and appointment-safe

**Status:** Done (`0a1beff` — `DaySummarySheet`, month day/event clicks open summary first)

**Report**

In month view, when a manager clicks a day that already has appointments, sometimes appointment detail opens and sometimes the new appointment drawer opens. The report suggests appointment detail should not open directly from this interaction and asks for a better UX.

**Observed behavior**

Month view currently supports both date clicks and event clicks. Date clicks open appointment create at the salon working start. Event clicks open appointment detail. This creates an unpredictable-feeling target area when a day cell contains appointments.

**Task**

Redesign month-view interactions so selecting any day opens a day summary first.

**Recommended direction**

Use month view as a navigation/overview surface:

- Clicking/tapping any day cell opens a day summary for that date first.
- Appointment detail opens only after selecting a specific appointment from that day summary/list.
- Creating an appointment is a clear secondary action from the day summary or floating create button.

**Acceptance criteria**

- Tapping a populated month day does not accidentally open appointment detail.
- Tapping an empty month day opens the day summary first, not the create drawer directly.
- Populated days expose appointments in a scannable list/sheet before opening detail.
- The day summary includes a clear action for creating a new appointment on that date.
- The interaction works on mobile touch targets without accidental event/detail activation.
- Keyboard and screen-reader flows have explicit labels for "view day", "new appointment", and "open appointment".

### C2. Extend agenda/list view to show upcoming appointments through next month

**Status:** Done (`0a1beff` — `listUpcomingMonth` view, one-month `visibleRange`, updated empty copy)

**Report**

Agenda view should show appointments up to next month. Right now it appears to show only the current week.

**Observed behavior**

Calendar list view maps to FullCalendar `listWeek`, and list events are filtered to today onward. That explains why agenda appears limited to the current week.

**Task**

Change agenda/list view to show today through approximately one month ahead.

**Acceptance criteria**

- Agenda/list view includes appointments from today through the same date next month, or another explicitly chosen one-month range.
- Past appointments remain hidden unless product wants historical agenda browsing.
- Empty state says no appointments in the upcoming month, not no appointments in this week.
- Calendar range fetching still includes enough data for the agenda range.
- Date navigation behavior is clear: moving the calendar anchor updates the agenda range predictably.

### C3. Improve staff-filter feedback when filtered appointments are outside the current view

**Status:** Done (`0a1beff` — filtered empty state, clear filter, jump to nearest appointment)

**Report**

Filtering by staff feels broken in day/week view because the selected staff member's appointments may not be in the current visible date/time view.

**Normalized issue**

The filter can be valid but produce an empty current view, especially in day/week mode. Users interpret the blank view as broken because there is no explanation or path to the filtered staff member's next appointment.

**Task**

Add contextual empty/filter feedback and navigation for staff-filtered calendar views.

**Acceptance criteria**

- When a staff filter is active and no appointments are visible, show an empty state explaining the filter/date combination.
- Provide actions to clear staff filter and jump to the selected staff member's next appointment if one exists in the fetched range.
- If appointments exist for the selected staff outside the current visible date/time but within fetched data, expose that count or nearest appointment date.
- The filter state remains visibly active and easy to clear.
- Works in day, week, month, and agenda/list views.

### C4. Improve mobile calendar usability for long working-hour ranges

**Status:** Done (`0a1beff` — mobile scroll-to-first-appointment/current time, coarser slot height)

**Report**

On mobile devices, the calendar scrolls vertically a lot, especially when working hours are long.

**Normalized issue**

Day/week time-grid views render the full salon working-hour span. Long working hours create excessive vertical scrolling, making filters, appointments, and create actions harder to use.

**Task**

Reduce mobile friction for long working-hour calendar views.

**Acceptance criteria**

- On mobile day/week views, the calendar opens near the first relevant appointment or current time instead of always forcing users through the full day.
- Staff filter/view controls remain reachable while scrolling.
- Appointment blocks remain readable at mobile widths.
- Long working hours do not hide the floating actions or make them overlap important content.
- Consider a compact density mode, "jump to next appointment", or dynamic slot height if vertical travel remains high.

## D. Appointment Edit Drawer Mutations

### D1. Close appointment edit/detail drawer after successful edit

**Status:** Fixed — `/calendar` closes the detail drawer after a successful full edit; status-only updates still refresh the open drawer

**Report**

Drawers like appointment edit should close after a successful edit.

**Observed behavior**

After appointment detail edit succeeds, the calendar cache updates and the detail drawer is reopened with the updated appointment. Delete closes the drawer; create already closes after success.

**Likely affected surfaces**

- `apps/pwa/src/routes/_authed/calendar.tsx`
- `apps/pwa/src/components/calendar/appointment-detail/use-appointment-detail-drawer.ts`
- `apps/pwa/src/components/appointments/use-appointment-flow.ts`

**Task**

Close the appointment detail/edit drawer after successful full edit-form save, while preserving success feedback and cache updates.

**Acceptance criteria**

- Saving edits to an appointment closes the drawer after success.
- Status-only changes do not need to close the drawer as part of this task.
- The calendar reflects the edited appointment immediately.
- Delete still closes the drawer.
- Offline/queued updates show the right queued/saved feedback before or during close.

### D2. Persist appointment edit start/end time changes

**Status:** Fixed — intake/query layers compare actual service/add-on changes instead of payload presence; explicit `endTime` wins when managers edit a custom end time alongside service/add-on changes; regression tests added

**Report**

Managers receive a success message after editing an appointment's start time and end time, but after opening the detail/edit drawer again the changes are gone.

**Normalized issue**

The appointment edit mutation appears to report success before the persisted appointment read model reflects the edited values. Start/end time changes should round-trip through the update payload, server validation, database patch, returned detail response, calendar cache, and subsequent refetch.

**Observed implementation notes**

- Appointment edit submits through `useAppointmentIntakeMutations().updateAppointment`.
- The shared appointment form payload includes `startTime`, `endTime`, and `durationMinutes`.
- When service/addons change, the database update recalculates `endTime` from booked total duration today, but the desired rule is that an explicitly edited custom end time wins.

**Likely affected surfaces**

- Edit UI: `apps/pwa/src/components/calendar/appointment-detail/appointment-detail-edit-form.tsx`
- Edit controller: `apps/pwa/src/components/calendar/appointment-detail/use-appointment-detail-drawer.ts`
- Mutation wrapper: `apps/pwa/src/lib/use-appointment-intake-mutations.ts`
- API route: `apps/api/src/routes/appointments.ts`
- Database update: `packages/database/src/internal/appointment-queries.ts`
- Offline/data-client update: `packages/data-client/src/core/modules/appointments-module.ts`

**Task**

Fix appointment edit persistence so saved start/end time changes survive drawer close/reopen and server refetch.

**Acceptance criteria**

- Editing only `startTime` and `endTime` persists after closing and reopening the appointment detail/edit drawer.
- Editing start/end time persists after a full appointments range refetch, not just optimistic cache update.
- If service/addon changes and a manager also edits a custom end time, the custom end time wins and persists.
- Service/addon duration recalculation must not silently overwrite a custom end time entered by the manager.
- The success toast/message is shown only after the value that will be reloaded from storage is known.
- Add regression tests covering server/database update and, if feasible, data-client/offline update behavior.

## E. Appointment Intake Service/Staff Availability Dead-Ends

### E1. Prevent appointment create/edit forms from getting stuck when selected service duration exceeds salon/staff bounds

**Status:** Partial (`12840ca` — `serviceDisabledReason` vs `serviceStatusReason`, clear service/staff, intake tests; staff outside schedule still disabled; nearest-slot / auto-adjust end time not implemented)

**Report**

In the appointment drawer, a user selects an enabled service but the staff field does not auto-fill and says staff must be selected. After opening staff selection, all staff are disabled as out of schedule. After that the form gets stuck; opening service selection shows all services disabled. The suspected cause is the previously selected service time reaching outside salon or staff schedule bounds.

**Normalized issue**

Service/staff availability appears to be evaluated against the current date/start/end time. When a selected ServiceVariant duration or existing end time pushes the appointment outside salon/staff working hours, the UI disables every recovery option instead of letting the manager change service, staff, duration, or time in a safe order.

**Likely affected surfaces**

- Appointment create drawer: `apps/pwa/src/components/calendar/appointment-drawer.tsx`
- Appointment edit drawer: `apps/pwa/src/components/calendar/appointment-detail/appointment-detail-edit-form.tsx`
- Intake view model: `apps/pwa/src/lib/appointment-intake.ts`
- Staff availability rules: `packages/salon-core/src/staff-availability.ts`
- Appointment intake persistence/validation: `packages/database/src/internal/appointment-intake.ts`

**Task**

Make Appointment Intake resilient to invalid intermediate service/staff/time combinations.

**Recommended solution direction**

- Do not disable all ServiceVariants solely because the current time window is invalid.
- Distinguish capability from availability:
  - Capability: staff can perform the ServiceVariant.
  - Availability: current date/time/duration fits staff and salon schedule.
- Keep service and staff fields editable even when the current combination is invalid.
- When service duration changes and the end time exceeds schedule bounds, either:
  - auto-adjust to the nearest valid end time if possible, or
  - keep the selection and show a precise warning with a "change time" action.
- If no staff is available for the current time, show the reason and offer nearest available slots instead of disabling the entire form.
- Avoid stale selected service/staff state causing every option to become disabled.

**Acceptance criteria**

- Selecting a ServiceVariant near the end of business hours never leaves the form with all services and all staff disabled.
- If no staff can perform the service, the service-level error says "no capable staff" and the user can choose another service.
- If capable staff exist but none fit the selected time, staff rows show "outside schedule" or "unavailable at this time" while remaining recoverable through time changes.
- Changing start time, duration, service, or staff can recover the form without closing/reopening the drawer.
- Auto-fill selects a staff member only when capability and current time-window rules are satisfied, or clearly explains why it did not.
- Submit validation still blocks invalid appointments at the final gate.
- Add tests for:
  - service duration extends beyond salon hours,
  - service duration extends beyond staff custom hours,
  - selected staff becomes invalid after service change,
  - changing time recovers available staff/services.
