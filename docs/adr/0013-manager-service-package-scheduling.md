# Manager Service Package scheduling is same-day task scheduling

Supersedes ADR-0012.

The service catalog cutover implements manager-side Service Package scheduling, while public booking remains service-only. A manager defines packages from ordered service components, may override the package price, and grants explicit package capability to staff. Scheduling a package accepts one date and one task entry per component, each with staff, start time, and end time. Tasks may be sequential, gapped, or parallel, but they are same-day in v1.

The API validates that the package is active, the task set exactly matches the package components, the client exists, assigned staff can perform the package and component services, staff are within working hours, and no staff or client conflicts exist. On success, the transaction creates a `service_package_bookings` header, normal appointment rows for the scheduled work, and `service_package_tasks` links. Package bookings do not accept add-ons in this pass.

We chose this because calendar, staff load, today, and appointment history can keep using normal appointments for operational work while packages still have a first-class aggregate for pricing and review. It also avoids orphan approved package requests or package bookings that are not real on the calendar.

Legacy ServiceFamily and combo-service data are retained for migration/history only. New manager, admin, and public catalog flows use categories, services, add-ons, and packages.
