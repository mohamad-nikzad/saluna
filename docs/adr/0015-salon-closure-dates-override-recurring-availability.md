# Salon Closure dates override recurring availability

A Salon Closure is an explicit salon-wide set of Salon-local dates above Salon Working Days and Staff Profile schedules. Managers may close today or future dates individually or by inclusive range; overlaps collapse into one date state. This preserves the intent of a bounded closure even when recurring working days later change, without adding recurring exceptions or Staff Profile time off.

Closing dates may coexist with existing Appointments. Active Appointments trigger a compact confirmation, remain valid and unchanged, and are not automatically announced or cancelled. After closure commits, all new Appointment paths—including direct creation, Service Package scheduling, exact AppointmentRequest submission, and AppointmentRequest approval—reject those dates. Existing Appointments may be edited on the same closed date or moved away, but none may move onto it.

The warning check and closure write are atomic with Appointment creation. If an Appointment commits first, an unconfirmed closure returns the updated warning; if closure commits first, Appointment intake fails. Once the manager confirms, closure may commit over any Appointments already present, while later intake remains blocked.
