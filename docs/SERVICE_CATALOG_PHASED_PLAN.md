# Service Catalog Phased Plan

## Summary

Upgrade services from a flat list into a real salon service catalog while keeping booking simple: one appointment still selects one sellable service variant.

The catalog should support real salon language such as:

- `ناخن > کاشت ناخن > کاشت با پودر`
- `ناخن > کاشت ناخن > کاشت با لاک ژل`
- `ناخن > کاشت ناخن > کاشت دست و پا`
- `ناخن > ترمیم ناخن > ترمیم ساده`

There are no real users yet, so schema and data changes can be direct. Migration compatibility is not a major constraint.

## Product Decisions

- Keep one selected service per appointment for the first version.
- Treat the bookable service as a sellable variant, not a configurable builder.
- Support Persian starter templates that managers can import and then edit.
- Keep web and native app behavior in parity.
- Defer configurable add-ons and multi-service appointments to later phases.

## Domain Model

Introduce three catalog levels:

- `ServiceCategory`: broad salon area, such as `ناخن`, `مو`, `پوست`, `مژه`, `ابرو`, `اسپا`.
- `ServiceFamily`: main service family inside a category, such as `کاشت ناخن`, `ترمیم ناخن`, `مانیکور`, `رنگ مو`.
- `Service`: the sellable/bookable variant, such as `کاشت با پودر`, `کاشت با لاک ژل`, `کاشت دست و پا`.

The shared `Service` shape should include:

- `categoryId`
- `categoryName`
- `familyId`
- `familyName`
- `name`
- `duration`
- `price`
- `color`
- `active`
- optional `description`
- `kind: 'standard' | 'combo'`

Appointments should store a service snapshot when created or when the selected service changes:

- booked service name
- booked duration
- booked price

This keeps historical appointment meaning stable if the salon later changes catalog prices or durations.

## UI Decisions

### Settings Catalog

Replace the current flat `خدمات` card with a richer grouped catalog section in Settings.

Use expandable groups:

- Category: `ناخن`
- Family: `کاشت ناخن`
- Variants: `کاشت با پودر`, `کاشت با لاک ژل`, `کاشت دست و پا`

Each variant row should show:

- service name
- duration
- price
- active/inactive state
- edit action

Use drawers for create/edit flows:

- category drawer
- family drawer
- service variant drawer

Add a one-click action:

- `افزودن خدمات پیشنهادی`

This imports editable Persian starter templates. It should not create fixed system services that managers cannot change.

### Booking Picker

Use one searchable grouped picker in appointment create/edit and availability flows.

Picker structure:

- group heading: `ناخن`
- subheading: `کاشت ناخن`
- row: `کاشت با پودر · ۹۰ دقیقه · ۸۰۰٬۰۰۰ تومان`

Search should match:

- category name
- family name
- variant name

After selection, display compact labels:

- `ناخن / کاشت با پودر`

Calendar/history/reporting should use compact labels by default. Detailed screens can show family context where helpful.

### Staff Service Assignment

Use the same grouped structure when assigning services to staff.

Staff capabilities remain variant-level:

- A staff member can be assigned to `کاشت با پودر` without automatically being assigned every `کاشت ناخن` service.

Keep the existing unrestricted mode where a staff member can perform all services.

## Implementation Phases

### Phase 0: Prep And Naming

- Add the catalog terms to `CONTEXT.md`: `ServiceCategory`, `ServiceFamily`, `ServiceVariant`, and `BookedServiceSnapshot`.
- Decide final route and function names before coding so web, native, database, and data-client use the same language.
- Done when the domain names are documented and the implementation uses "category/family/service variant" consistently instead of introducing parallel names.

#### Phase 0 Naming Decisions

Use these names for the rest of the phased implementation:

- Database tables: `service_categories`, `service_families`, `services`.
- Database foreign keys: `service_families.category_id`, `services.family_id`, `appointments.service_id`, `staff_services.service_id`.
- Appointment snapshot columns: `booked_service_name`, `booked_service_duration`, `booked_service_price`.
- Shared types: `ServiceCategory`, `ServiceFamily`, `Service`, and `BookedServiceSnapshot`.
- Shared service read fields: `categoryId`, `categoryName`, `familyId`, `familyName`.
- Web API routes: keep `/api/services` for service variants; add `/api/service-categories`, `/api/service-families`, and `/api/services/import-starter-templates`.
- API/data-client modules: keep `services` for variants; add `serviceCategories`, `serviceFamilies`, and `importStarterServiceTemplates`.
- UI labels: use "category", "family", and "service variant" in English docs/code comments; use Persian product copy matching the screens, such as `دسته`, `خانواده خدمت`, and `خدمت`.

### Phase 1: Database And Domain Shape

Status: complete.

- Add `service_categories` and `service_families` tables scoped by `salonId`.
- Update `services` to reference `service_families` and remove dependence on the hard-coded category enum.
- Keep `staff_services.service_id` and `appointments.service_id` pointing to the sellable service variant.
- Add appointment snapshot columns for booked service name, duration, and price.
- Update row mappers and shared `Service`/appointment detail types to expose category and family display fields.
- Done when the app can read/write the new catalog shape from the database and existing appointment logic still has a single `serviceId`.

#### Phase 1 Completion Notes

- `service_categories` and `service_families` are represented in the database schema and migration.
- `services.family_id` is required and points at the sellable service variant's family.
- The legacy `services.category` database column is removed from the catalog schema; any remaining `Service.category` usage is a temporary UI compatibility field until the grouped web/native UI phases replace it.
- Appointments now store `bookedServiceName`, `bookedServiceDuration`, and `bookedServicePrice` snapshots when created, and refresh those snapshots when the selected service changes.
- Appointment, service, and joined row mappers expose the new catalog fields while preserving one selected `serviceId` per appointment.

### Phase 2: API, Validation, And Data Client

Status: started early; needs verification and cleanup after Phase 1.

Some Phase 2 work was added before Phase 1 was finished. Keep that work, but treat this phase as a hardening pass rather than a fresh implementation.

- Verify service create/update/list/get APIs require family-backed services and return category/family display names from the new schema.
- Verify manager-only APIs for creating/updating categories and families are wired consistently.
- Verify the starter-template import action is idempotent and uses stable category/family/service names per salon.
- Remove or isolate any remaining request-body dependence on the old hard-coded `category` enum; keep only temporary response compatibility needed by existing UI screens.
- Confirm shared Zod schemas require `familyId` for service variant creation once the catalog UI can supply it.
- Confirm `data-client` service module and pending mutation projection preserve category/family fields offline.
- Done when tests can create a category, family, service variant, list grouped catalog data, import starter templates twice without duplicates, and create offline pending service changes.

### Phase 3: Starter Templates

Status: complete.

- Define editable Persian starter templates in shared code, not in UI-only code.
- Include initial templates for `ناخن`, `مو`, and `پوست`.
- Make import idempotent by stable names per salon: running it twice must not duplicate the same category/family/service rows.
- Done when a fresh salon can click one action and receive editable catalog rows such as `ناخن > کاشت ناخن > کاشت با پودر`.

#### Phase 3 Completion Notes

- Editable Persian starter templates now live in shared salon-core code as `PERSIAN_STARTER_SERVICE_TEMPLATES`.
- Initial templates cover `ناخن`, `مو`, and `پوست`, including `ناخن > کاشت ناخن > کاشت با پودر`.
- The database import action consumes the shared templates and continues to reuse existing category, family, and service rows by stable per-salon names.

### Phase 4: Web Manager Catalog UI

- Replace the flat Settings `خدمات` card with the expandable grouped catalog.
- Add drawers for category, family, and service variant create/edit.
- Add the `افزودن خدمات پیشنهادی` action to import starter templates.
- Keep the variant drawer focused on name, family, duration, price, color, active, optional description, and kind.
- Done when managers can fully maintain the catalog from web Settings without touching seed data or direct database rows.

### Phase 5: Web Booking And Staff UI

Status: complete.

- Update web appointment create/edit drawers to use a searchable grouped service picker.
- Update web availability drawer to use the same picker and still submit one `serviceId`.
- Update web staff service assignment to group variants under category and family.
- Display selected services as `category / variant`, such as `ناخن / کاشت با پودر`.
- Done when booking, availability lookup, appointment edit, and staff capability assignment work with the new catalog UI on web.

#### Phase 5 Completion Notes

- Web appointment create and edit flows now use one searchable grouped picker across category, family, and service variant names.
- Availability lookup uses the same grouped picker while preserving the existing single `serviceId` submission contract.
- Staff service assignment now groups active service variants under category and family while keeping variant-level capability checks.
- Calendar and appointment detail surfaces display compact labels such as `ناخن / کاشت با پودر`.

### Phase 6: Native Parity

Status: complete.

- Update native service management components to match the grouped catalog model.
- Update native appointment create/edit and availability modals to use the grouped picker.
- Update native staff service assignment to group variants under category and family.
- Reuse shared grouping and display-label helpers where possible.
- Done when native can perform the same catalog, booking, availability, and staff assignment flows as web.

#### Phase 6 Completion Notes

- Native Settings now manages the grouped catalog with بخش, گروه, and خدمت flows, including starter-template import.
- Native service create/edit now saves variants against `familyId` and supports description, active state, kind, duration, price, and calendar color.
- Native appointment create/edit and availability flows use searchable grouped service pickers by category and family while still submitting one `serviceId`.
- Native staff service assignment groups active variants under category and family and preserves the unrestricted all-services mode.
- Shared catalog grouping and compact label helpers live in salon-core and are reused by native booking, staff assignment, and appointment display surfaces.

### Phase 7: Reporting And Historical Accuracy

Status: complete.

- Use booked price snapshots for dashboard revenue and retention spend calculations.
- Use booked service snapshot fields in appointment detail and client history where historical accuracy matters.
- Keep current service relation available for current catalog metadata when useful.
- Done when changing a service variant price or duration does not rewrite the meaning of old appointments.

#### Phase 7 Completion Notes

- Dashboard monthly revenue now sums `bookedServicePrice` from completed appointments instead of the current catalog service price.
- Retention queue spend, VIP sorting, client profile estimated spend, favorite service, and last service use booked appointment snapshots.
- Web/native appointment detail, today, upcoming appointment, and client history displays show booked service names and booked prices where the historical appointment meaning matters.
- Joined `service` data remains available on appointment details for live catalog metadata such as category, color, staff eligibility, and edit flows.

### Phase 8: Later Advanced Catalog Features

Do not build these in v1, but leave room for them:

- configurable add-ons such as `دیزاین`, `فرنچ`, `ریموو`, `قد بلند`, `ترمیم ناخن شکسته`
- multi-service appointments
- package composition where combos calculate from component services

## Test Plan

### Catalog

- Create category, family, and service variant.
- Reject a service with a missing or inactive family.
- List services grouped by category and family.
- Hide inactive services from normal booking lists.
- Import Persian starter templates once without creating duplicate rows.

### Appointment And Availability

- Availability uses selected service variant duration.
- Staff capability checks work at variant level.
- Appointment create stores booked service name, duration, and price snapshot.
- Appointment service change refreshes the snapshot.
- Old appointment display does not change when catalog price/duration later changes.

### UI And Offline Data

- Settings catalog renders category, family, and variants correctly.
- Drawers create/edit category, family, and service variant.
- Booking search finds services by category, family, and variant names.
- Selected labels display as `category / variant`.
- Offline service create/update preserves category and family fields.
- Web and native use the same grouping and compact labels.

## Acceptance Scenarios

- Create `ناخن > کاشت ناخن > کاشت با پودر`.
- Create `ناخن > کاشت ناخن > کاشت دست و پا`.
- Assign only `کاشت با پودر` to one staff member.
- Confirm that staff member cannot be booked for `کاشت دست و پا`.
- Book both services with eligible staff.
- Confirm duration, price, compact label, appointment detail, and dashboard spend are correct.
