# Context

## Language

### Appointments

**Appointment**:
A scheduled service on the staff calendar, with a validated client, assigned staff, time window, and `BookedServiceSnapshot`.
_Avoid_: booking (verb only, customer UI copy)

**AppointmentRequest**:
A customer-submitted proposal for an `Appointment`, awaiting manager review. Carries raw customer contact, a desired slot, and snapshot-shaped service fields. Lifecycle: `pending` → `approved` | `rejected` | `cancelled` | `expired`. Never on the staff calendar.
_Avoid_: booking request, public booking, pending appointment

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
Salon-scoped grouping inside a `ServiceCategory` (`کاشت ناخن`, `ترمیم ناخن`, `مانیکور`, `رنگ مو`). DB/API: `service_families`; TS: `ServiceFamily`. Persian UI: `گروه`.

**ServiceVariant**:
The sellable, bookable service (`کاشت با پودر`, `کاشت دست و پا`). Represented by the `Service` type and `services` table; call it "service variant" in copy that distinguishes it from category or family. Persian UI: `خدمت`.
_Avoid_: package, bundle, group, type, subtype, item, offering, option

**Standard ServiceVariant**:
A `ServiceVariant` sold as one standalone salon service.

**Combo ServiceVariant**:
A fixed `ServiceVariant` composed from other standard variants for booking as one sellable service. Duration and price live on the combo row, not on its components.

**ComboComponent**:
A reference from a `Combo ServiceVariant` to a standard `ServiceVariant`. Documents composition; does not drive booking, availability, staff assignment, revenue, or snapshots.

**ServiceAddon**:
An optional salon-defined extra selected alongside a `ServiceVariant` at booking.

### Catalog Presets

**CatalogPreset**:
A ready-made tree of `PresetCategory` → `PresetFamily` → `PresetVariant` rows that a manager imports during onboarding to skip building the catalog by hand. UI copy: `قالب خدمات`. Not sellable, not tenant-scoped — defined by the product, picked by the salon.
_Avoid_: package, bundle, template service, service group

**PresetCategory / PresetFamily / PresetVariant**:
The rows inside a `CatalogPreset` that map 1:1 to `ServiceCategory` / `ServiceFamily` / `ServiceVariant` when the preset is applied.

### Snapshots

**BookedServiceSnapshot**:
The appointment-owned copy of the selected `ServiceVariant` at booking time: name, duration, price. Binding even if the underlying service is later edited or archived.

**BookedAddonSnapshot**:
The appointment-owned copy of a selected `ServiceAddon`: name, duration delta, price delta.

**AppointmentTotalsSnapshot**:
The appointment-owned total duration and price after applying the `BookedServiceSnapshot` and any `BookedAddonSnapshot`s. Authoritative for revenue and retention spend.

### Salon

**Salon Working Days**:
Salon-level open-day mask — which weekdays the salon is open. DB: `business_settings.working_days`. Coarse gate above per-staff `staff_schedules`.

**Salon Presence**:
Public contact surface: address, map links, and social links. DB: typed nullable columns on `salon_profile`. Persian UI: `حضور آنلاین`.
_Avoid_: contact info, social block

### Sync

**Offline Projection**:
The data-client view produced by merging the last server snapshot with pending mutation rows so manager screens can render salon state while writes are queued.

## Naming rules

- Use `category`, `family`, and `service variant` in user-facing catalog language.
- Keep `services`, `serviceId`, `staff_services.service_id`, and `appointments.service_id` for the bookable variant level.
- Use `categoryId`, `categoryName`, `familyId`, `familyName` on service read models.
- Use `bookedServiceName`, `bookedServiceDuration`, `bookedServicePrice` for appointment snapshot fields.
- Use `combo` only as a qualifier for a `ServiceVariant`.
- Store combo composition in `service_combo_components` (`comboServiceId`, `componentServiceId`, `sortOrder`).
- Require explicit staff capability on the combo `ServiceVariant`; do not infer it from components.
