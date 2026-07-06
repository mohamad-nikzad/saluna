# Context

## Language

### Appointments

**Appointment**:
A scheduled service on the staff calendar, with a validated client, assigned staff, time window, and `BookedServiceSnapshot`.
_Avoid_: booking (verb only, customer UI copy)

**AppointmentRequest**:
A customer-submitted proposal for an `Appointment` or `Service Package`, awaiting manager review. Carries raw customer contact, desired timing, and snapshot-shaped service/package fields. Lifecycle: `pending` → `approved` | `rejected` | `cancelled` | `expired`. Never on the staff calendar.
_Avoid_: booking request, public booking, pending appointment

Approving a package request schedules every package task with staff and time, making the package operationally real on staff calendars.

**Appointment Intake**:
The validation gate that turns a requested create/update into a validated command or a precise rejection. Shared by internal create flows and `AppointmentRequest` approval.

**Appointment Detail Read Model**:
The tenant-scoped view used by manager and staff screens when they need an `Appointment` together with its client, staff, and service details.

**Tenant Request**:
The authenticated salon request context carried by API routes — tenant user, salon scope, or an authorization response.

### Service Catalog

**ServiceCategory**:
Salon-scoped catalog group for a broad area (`ناخن`, `مو`, `پوست`, `مژه`, `ابرو`, `اسپا`). DB/API: `service_categories`; TS: `ServiceCategory`. Persian UI: `دسته`.

**ServiceFamily**:
Legacy storage middle grouping inside a `ServiceCategory`. Manager, admin, and public catalog workflows must use `ServiceCategory` → `ServiceVariant` and must not expose family-level creation, editing, or selection.
_Avoid_: required service group

**ServiceVariant**:
The sellable, bookable service (`کاشت با پودر`, `کاشت دست و پا`). Represented by the `Service` type and `services` table; new service rows use `familyId = null` and `kind = standard`. Call it "service" in ordinary product/admin copy and "service variant" only when distinguishing it from legacy combos or add-ons. Persian UI: `خدمت`.
_Avoid_: package, bundle, group, type, subtype, item, offering, option

**Standard ServiceVariant**:
A `ServiceVariant` sold as one standalone salon service.

**Service Package**:
A sellable bundle composed from multiple staff-assigned package tasks, often across categories, for manager-side booking as one offering. Its duration comes from the scheduled tasks; its total price may be calculated from included services or overridden by the manager. Package scheduling creates a `service_package_bookings` header, normal `appointments` rows for each task, and `service_package_tasks` links. Public booking remains service-only.
_Avoid_: combo service, service group

**PackageComponent**:
A staff-assigned unit of work inside a `Service Package`, based on an included service and carrying its own duration and calendar slot.
_Avoid_: combo component

Package tasks may have gaps or run in parallel across different staff, but they must respect staff and client scheduling conflicts.
Package scheduling is same-day in v1: the manager picks one date, then assigns staff and start/end times per task. Add-ons are not supported on package bookings.

**ServiceAddon**:
An optional salon-defined extra selected alongside a `ServiceVariant` at booking.

### Catalog Presets

**CatalogPreset**:
A ready-made service catalog assembly that a manager imports during onboarding to skip building the catalog by hand. It is built from flat preset categories and preset services but keeps its own curated defaults. Presets import categories and standard services only; they do not import families or packages. UI copy: `قالب خدمات`. Not sellable, not tenant-scoped — defined by the product, picked by the salon.
_Avoid_: package, bundle, template service, service group

**PresetCategory / PresetFamily / PresetVariant**:
Reusable product-maintained library items that map to salon catalog records when a `CatalogPreset` is applied. `PresetFamily` is legacy input compatibility only; the target preset language is `PresetCategory` and preset service.

**Preset Catalog**:
The product-maintained collection of preset categories, preset services, and assembled `CatalogPreset`s that platform staff uses to curate starter service catalogs.
_Avoid_: service preset page, template manager

### Snapshots

**BookedServiceSnapshot**:
The appointment-owned copy of the selected `ServiceVariant` at booking time: name, duration, price. Binding even if the underlying service is later edited or archived.

**BookedAddonSnapshot**:
The appointment-owned copy of a selected `ServiceAddon`: name, duration delta, price delta.

**AppointmentTotalsSnapshot**:
The appointment-owned total duration and price after applying the `BookedServiceSnapshot` and any `BookedAddonSnapshot`s. Authoritative for revenue and retention spend.

### Clients

**Client**:
A salon's customer record — name, phone, notes, tags — used for appointments, retention, and messaging. Persian UI: `مشتری`.
_Avoid_: contact (phone address book), customer (public booking copy)

**Device Contact**:
An entry from the manager's phone address book. May become a `Client` after import or pick; not tenant-scoped until created on the server.
_Avoid_: client, مخاطب (use only in UI copy for the phone picker, not in domain language)

**Client Import**:
Bulk or single flow that turns owner-supplied VCF or CSV data, or `Device Contact` data from Contact Picker, into new `Client` rows, with dedup against existing salon phones. Assisted imports begin with a duplicate/error preview and create records only after explicit confirmation.

### Salon

**Assisted Salon Setup**:
A path in which authorized platform staff creates and prepares a `Setup Salon`, then hands it to the verified `Salon Owner`.
_Avoid_: admin onboarding, impersonation

**Setup Salon**:
A non-public salon created by authorized platform staff for preparation before it has a verified owner. It records the intended owner's phone, editable until handoff, while platform staff prepares its hours, catalog, Staff Profiles, Salon Presence, and Clients.
_Avoid_: draft workspace, Setup Case

**Setup Page**:
A focused page in a `Salon Workspace` for preparing one part of a `Setup Salon`, such as basics, hours, presence, catalog, Staff Profiles, Clients, or handoff.
_Avoid_: setup modal, setup tab bundle

**Salon Handoff**:
The one-time transfer of a `Setup Salon` to its intended `Salon Owner`. The owner verifies their phone and establishes login access; the salon becomes active and ordinary platform setup access ends without a separate review step.
_Avoid_: owner approval, setup review, Setup Handoff

**Salon Owner**:
The person who verifies their own identity and assumes ownership through self-service signup or `Salon Handoff`. Platform staff may prepare a salon but never assume this identity.
_Avoid_: account owner, admin-created owner

**Salon Workspace**:
The per-salon admin area opened from the salon table, where platform staff reviews the salon overview and moves into related operational or setup pages.
_Avoid_: salon detail, tenant tabs, setup case, governance

**Platform Owner Override**:
A deliberate action by a `Platform Owner` on an active salon after `Salon Handoff`. It is attributable and excludes authentication secrets, session takeover, and acting as another user.
_Avoid_: unrestricted access, super admin, impersonation, break-glass login

**Salon Working Days**:
Salon-level open-day mask — which weekdays the salon is open. DB: `business_settings.working_days`. Coarse gate above per-staff `staff_schedules`.

**Salon Presence**:
Public contact surface: address, map links, and social links. DB: typed nullable columns on `salon_profile`. Persian UI: `حضور آنلاین`.
_Avoid_: contact info, social block

### Staff

**Staff Profile**:
A salon-owned record for a person who provides services, including their display identity, schedule, and capabilities. A Staff Profile may exist without login access.
_Avoid_: staff account, employee user

**Staff Account Claim**:
The act by which a staff member verifies their own identity and connects their login access to an existing `Staff Profile`. Neither a salon manager nor platform staff may claim an account on the staff member's behalf.
_Avoid_: staff activation, admin-created login

**Staff Access Transfer**:
A staff member's verified move of their login access from one salon's `Staff Profile` to another's. The previous salon retains its Staff Profile and operational history without the person's login access; one staff identity may be claimed by only one salon at a time.
_Avoid_: staff migration, profile transfer, admin reassignment

### Product Support

**Support Ticket**:
A question, problem report, or feature request submitted by an authenticated salon manager to Saluna's platform support team. Belongs to the manager's salon; any manager of that salon may view it, while staff have no support-ticket access. Forms a conversation through one or more `Support Message`s. Lifecycle: new tickets and manager messages set `open`; platform-support replies set `waiting_for_manager`; platform support alone sets `resolved`; any later message reopens a resolved ticket as `open`.
_Avoid_: issue (ambiguous with engineering work), feedback (too narrow), request (conflicts with `AppointmentRequest`)

Resolving a `feature_request` Support Ticket means its support conversation is complete; it does not mean the feature was accepted, scheduled, or delivered.

**Support Message**:
A manager-authored or platform-support-authored entry in a `Support Ticket` conversation. The ticket's initial description is its first message.
_Avoid_: comment, reply (a message may begin the conversation)

**Support Ticket Category**:
The manager-selected classification of a `Support Ticket`: `problem`, `question`, `feature_request`, or `other`. Categories organize one shared support workflow rather than defining separate ticket types.
_Avoid_: ticket type, department

**Example dialogue**:

> **Support:** “I replied to the salon’s Support Ticket, so it is now waiting for a manager.”
>
> **Developer:** “The manager answered, which reopened it. If it is a feature request, resolving the ticket still does not mean the feature will ship.”

## Naming rules

- Prefer `category` and `service` in new product/admin catalog language; treat `family` as legacy storage/history only.
- Keep `services`, `serviceId`, `staff_services.service_id`, and `appointments.service_id` for the bookable variant level.
- Use `familyId` and `familyName` on service read models only to preserve legacy/historical rows; new workflows should create services directly under `categoryId`.
- Use `bookedServiceName`, `bookedServiceDuration`, `bookedServicePrice` for appointment snapshot fields.
- Use `Service Package` for sellable bundles, especially when included services span categories.
- Treat existing combo tables and fields as migration/history names only; new workflows should use `Service Package`, package components, and package tasks.
- Require explicit staff capability on the `Service Package`; do not infer it from components.
