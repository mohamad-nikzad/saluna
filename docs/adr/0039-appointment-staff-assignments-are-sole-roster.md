# Appointment Staff Assignments are the sole roster

An Appointment's staff roster lives only as Appointment Staff Assignments: exactly one lead (`is_lead`), optional extras when the ServiceVariant allows multi-staff, and Work Allocation on each row. We drop `appointments.staff_id` rather than keep a dual-write period, because calendar, conflicts, availability, and Staff Commission earn already disagreed on which representation to trust, and a second lead column kept inventing synthetic assignment rows. Create/update and request approve send `staffAssignments[]` (no top-level Appointment `staffId`); reads may still expose a derived nested lead `staff` for display. An Appointment with zero assignment rows is corrupt and fails hard through the roster seam, including commission sync. Package task Appointments write assignment rows like any other Appointment. salon-core owns roster types and invariants; the database package owns the only SQL read/write seam.

## Considered options

- **Dual-write period, drop later.** Rejected: expand already happened in migration 0030; stretching contract phases leaves half-migrated readers.
- **Keep dual columns forever, only concentrate glue.** Rejected: the dual representation is the bug.
- **Keep top-level API `staffId` as a derived lead id.** Rejected: a parallel lead handle on the wire fights "lead lives only on assignments"; nested lead `staff` for display is enough.
