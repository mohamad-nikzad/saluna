# Context

## Language

### Appointments

**Appointment**:
A scheduled service on the staff calendar, with a validated client, one or more assigned `Staff Profiles`, one shared time window, and `BookedServiceSnapshot`.
_Avoid_: booking (verb only, customer UI copy)

**Appointment Staff Assignment**:
One `Staff Profile` assigned to an `Appointment`. An Appointment has one lead assignment and may have additional assignments only when its `ServiceVariant` allows multiple staff; every assignment occupies the Appointment's entire time window.
_Avoid_: separate appointment, assistant shift

**AppointmentRequest**:
A proposal for an `Appointment` or `Service Package`, recorded by a customer or manager and awaiting manager review. Carries customer contact, desired timing, and snapshot-shaped service/package fields. Lifecycle: `pending` → `approved` | `rejected` | `cancelled` | `expired`. Never on the staff calendar.
_Avoid_: booking request, public booking, pending appointment

An **AppointmentRequest** is **rejected** when the salon declines it and **cancelled** when the customer withdraws it; closing it never deletes its history.

An approved, rejected, cancelled, or expired **AppointmentRequest** is terminal and cannot be reopened; renewed demand becomes a new **AppointmentRequest**.

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

**Multi-Staff ServiceVariant**:
A `ServiceVariant` that permits a manager to assign more than one `Staff Profile` to an `Appointment`. Multiple staff are optional rather than required; a service that does not allow multiple staff has exactly one Appointment Staff Assignment.
_Avoid_: multi-staff appointment type, required staff count

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
The request- or appointment-owned copy of the selected `ServiceVariant`: name, duration, price. Binding even if the underlying service is later edited or archived.

**BookedAddonSnapshot**:
The appointment-owned copy of a selected `ServiceAddon`: name, duration delta, price delta.

**AppointmentTotalsSnapshot**:
The appointment-owned total duration and price after applying the `BookedServiceSnapshot` and any `BookedAddonSnapshot`s. Authoritative for revenue and retention spend.

### Clients

**Client**:
A salon's customer record — name, phone, notes, tags — used for appointments, retention, and messaging. Persian UI: `مشتری`.
_Avoid_: contact (phone address book), customer (public booking copy)

**Client Birth Date**:
An optional, complete Jalali calendar date—year, month, and day—recorded manually on a `Client`. It may be used to determine the age the Client reaches on an annual birthday; a month/day-only birthday is not a Client Birth Date. In a non-leap Jalali year, a birth date of ۳۰ اسفند recurs on ۲۹ اسفند.
_Avoid_: Gregorian birth date, age (derived and changes over time)

**Birthday Follow-Up**:
A distinct annual `Client` follow-up for one Jalali birthday year. A daily check at 07:00 Salon-local time opens it seven days before the birthday; it remains actionable through seven days after the birthday and then expires if the manager has not handled or dismissed it. Each year's follow-up keeps its own status and outreach history.
_Avoid_: reusable birthday reminder, reopening last year's follow-up

A manager-recorded **AppointmentRequest** belongs to exactly one **Client**; a customer-recorded **AppointmentRequest** may remain unlinked until approval.

For an **AppointmentRequest**, “next week” means the Saturday–Friday calendar week immediately following the current Salon-local week.

**Flexible AppointmentRequest**:
A manager-recorded **AppointmentRequest** constrained by one or more acceptable dates and one **Time Preference**, instead of an exact start time.

Each **Flexible AppointmentRequest** names exactly one **ServiceVariant** and binds its **BookedServiceSnapshot** when recorded.

**Request Horizon**:
The rolling period from Salon-local today through 90 days ahead, inclusive, in which a **Flexible AppointmentRequest** may specify acceptable dates.

A pending **Flexible AppointmentRequest** expires after its final acceptable date has fully ended in Salon local time.

Elapsed acceptable dates remain part of a **Flexible AppointmentRequest**'s history, while only current or future acceptable dates remain schedulable.

While an **AppointmentRequest** is pending, only its acceptable dates, **Time Preference**, and notes may change; its **Client** and **BookedServiceSnapshot** remain fixed.

The saved acceptable dates and **Time Preference** are the current customer agreement; Saluna keeps no separate consent record.

**Time Preference**:
A fixed, system-defined part of a day that limits an **Appointment** start time: Morning (00:00–12:00), Afternoon (12:00–17:00), Evening (17:00–24:00), or Any time; the Appointment may end after the band.
_Avoid_: custom time window, salon time band

One **Time Preference** applies to every acceptable date in an **AppointmentRequest**.

**Device Contact**:
An entry from the manager's phone address book. May become a `Client` after import or pick; not tenant-scoped until created on the server.
_Avoid_: client, مخاطب (use only in UI copy for the phone picker, not in domain language)

**Client Import**:
Bulk or single flow that turns owner-supplied VCF or CSV data, or `Device Contact` data from Contact Picker, into new `Client` rows, with dedup against existing salon phones. Assisted imports begin with a duplicate/error preview and create records only after explicit confirmation.

### Salon

**Salon-Funded SaaS**:
Saluna's commercial model: the `Salon Owner` pays Saluna for software and related services, while the salon retains its relationship with each `Client`. Customer-facing Saluna features act on behalf of the salon; Saluna is not a consumer marketplace, lead broker, or advertising network, and its core revenue does not depend on taking a share of salon transactions.
_Avoid_: marketplace, consumer platform

**Trial**:
A verified `Salon Owner`'s one-time, 30-day period of full commercial access, applied to the first Salon they activate. Preparing a `Setup Salon` does not consume Trial time, and activating another Salon does not grant another Trial. When an unpaid Trial ends, the Salon keeps read access to its data but cannot perform ordinary operational writes until it pays. The billing-launch transition for already-active Salons is a one-time exception.
_Avoid_: free plan, freemium tier

**Salon Subscription**:
A paid term that grants exactly one Salon commercial access to Saluna. Public Salon Subscription tiers differ by their maximum number of active `Staff Profiles`, not by login identities, Appointments, Clients, revenue, or access to existing core product features. Subscription limits and SMS balances are not pooled across Salons.
_Avoid_: per-user plan, feature tier

**Staff Profile Limit**:
The maximum active `Staff Profiles` permitted by a Salon Subscription. Creating or reactivating a profile cannot exceed the limit. A downgrade cannot take effect until the manager deactivates enough profiles; Saluna never automatically deactivates or deletes them.
_Avoid_: user limit, automatic staff removal

**Subscription Purchase**:
One paid Salon Subscription term with an immutable snapshot of its price and limits. A renewal is a new Subscription Purchase using the currently published offer; buying once does not grant lifetime pricing.
_Avoid_: lifetime price, grandfathered plan

**Subscription Renewal**:
A Salon-initiated Subscription Purchase that extends commercial access for another prepaid term. Saluna stores no payment mandate and does not automatically charge the Salon.
_Avoid_: auto-renewal, recurring charge

**Grace Period**:
The three days after a paid Salon Subscription ends in which the Salon retains normal operational access but receives no new plan SMS Allowance. An unpaid Trial has no Grace Period. When the Grace Period ends without renewal, the Salon becomes read-only.
_Avoid_: extended Trial

**Read-Only Access**:
Commercial access after an unpaid Trial expires or a Grace Period ends. Existing Salon data remains readable and is never automatically deleted for nonpayment, while ordinary operational writes and salon-funded SMS are blocked. The public Salon page and contact information remain visible, but it cannot accept new `AppointmentRequests`. The `Salon Owner` may still export data or explicitly request account deletion.
_Avoid_: suspended Salon, deleted account

**Verified Payment**:
A payment provider's server-to-server confirmation for the exact snapshotted amount of a Subscription Purchase. Only a Verified Payment activates customer paid access; a browser return, receipt image, bank-transfer claim, or manual admin action does not.
_Avoid_: manual activation, payment screenshot

**Payment Provider**:
The external gateway that creates checkout and verifies payment. Zarinpal is Saluna's launch Payment Provider, while Subscription Purchases store a provider identifier and opaque provider references so commercial records are not Zarinpal-specific.
_Avoid_: multi-gateway router

**Unlimited Access**:
A permanent commercial entitlement for an internal Salon, such as Saluna's own Salon or a test Salon. It requires no Salon Subscription, has no active Staff Profile limit, has no expiry, and is not accompanied by a recorded justification.
_Avoid_: Complimentary Access, temporary override

**SMS Credit**:
Permission for a commercially active Salon to send one provider-billable SMS segment for a salon-funded purpose. A retained balance does not let a read-only Salon send; it becomes usable again after renewal. Authentication, account recovery, and identity-verification SMS are Saluna-funded and do not consume SMS Credits.
_Avoid_: message count, unlimited SMS

**SMS Allowance**:
A capped monthly grant of plan SMS Credits included with a Salon Subscription. Unused plan credits expire at the end of that monthly allowance period and are replaced by a fresh allowance only while the Salon Subscription remains active. Annual Salon Subscriptions also grant the allowance monthly rather than upfront.

**SMS Credit Bundle**:
Prepaid SMS Credits purchased separately when a Salon needs more than its SMS Allowance. Purchased SMS Credits are held in a separate balance and never expire.
_Avoid_: SMS subscription

**SMS Credit Grant**:
Non-expiring SMS Credits added directly by a `Platform Owner` without a Salon purchase, including credits for a Salon with `Unlimited Access`. They join the same non-expiring balance as purchased SMS Credits while the ledger records their grant source.
_Avoid_: unlimited SMS

**SMS Billing Profile**:
The active SMS provider's replaceable rules for estimating how final message text becomes provider-billable segments and for reconciling the provider's reported cost after sending. Subscription and SMS Credit rules do not depend on a particular provider's character limits.
_Avoid_: global SMS character limit

**Client Payment**:
Money a `Client` pays a Salon for salon services, including a deposit or full payment. The Salon is the merchant and beneficiary. Saluna may facilitate the payment flow but does not take custody of, pool, or settle Client Payments.
_Avoid_: Saluna payment, platform-held funds

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

**Salon Closure**:
The salon-wide set of Salon-local calendar dates intentionally made unavailable by a manager. A manager may add or remove one date or an inclusive range; overlapping selections unify as date state rather than separate range ownership. A Salon Closure overrides Salon Working Days and Staff Profile schedules for new Appointment intake but does not cancel or change existing Appointments.
_Avoid_: Staff Profile time off, recurring closure

**Salon Presence**:
Public contact surface: address, map links, and social links. DB: typed nullable columns on `salon_profile`. Persian UI: `حضور آنلاین`.
_Avoid_: contact info, social block

### Staff

**Staff Profile**:
A salon-owned record for a person who provides services, including their display identity, schedule, and capabilities. A Staff Profile may exist without login access.
_Avoid_: staff account, employee user

**Staff Invite**:
A salon manager's phone-bound invitation to connect a verified staff identity to one salon-owned `Staff Profile`. It grants no access until the invited person explicitly accepts it.
_Avoid_: staff claim, manager-created account, access transfer

**Staff Profile Access**:
The revocable permission link between one verified staff identity and one salon-owned `Staff Profile`. One identity may hold active Staff Profile Access in several salons, with at most one active link per salon.
_Avoid_: staff membership, profile ownership, shared staff account

**Staff Access Revocation**:
Ending one Staff Profile Access link without deleting or deactivating the salon-owned `Staff Profile`, its appointments, schedule, capabilities, or history. A manager may revoke access and staff may leave a salon themselves.
_Avoid_: delete staff, transfer staff, deactivate profile

**Staff Commission**:
The share of a completed `Appointment`'s Eligible Commission Basis earned by one assigned `Staff Profile` under the applicable commission agreement.
_Avoid_: staff cut, salary, wage

**Work Allocation**:
The percentage of a multi-staff `Appointment`'s authoritative total attributed to one Appointment Staff Assignment before applying that Staff Profile's Commission Agreement. Allocations total 100% and default to an equal split; a single-staff Appointment has a 100% allocation.
_Avoid_: commission rate, duplicated appointment price

**Eligible Commission Basis**:
The value used to calculate a `Staff Commission`: an assigned Staff Profile's Work Allocation of a regular `Appointment`'s authoritative total, or a `Service Package` task's deterministic proportional allocation of the booked package price.
_Avoid_: collected revenue, task price, package component price

**Commission Agreement**:
A salon-specific agreement for one `Staff Profile`, containing one default percentage and optional `Service Commission Overrides`.
_Avoid_: commission rule, appointment commission

**Service Commission Override**:
An optional percentage in a `Commission Agreement` for one `ServiceVariant`. It replaces the agreement's default percentage when that Staff Profile completes an Appointment for the specified service.
_Avoid_: separate commission agreement, category commission

**Salon Retained Amount**:
The remainder of an eligible completed `Appointment`'s authoritative total after all of its Staff Commissions, without implying payment collection or profit.
_Avoid_: salon profit, salon commission, salon income

A completed **Appointment** may produce one **Staff Commission** for each assigned **Staff Profile** with an applicable Commission Agreement.
Each **Commission Agreement** belongs to exactly one salon and one **Staff Profile**.
One salon and **Staff Profile** may have at most one active **Commission Agreement**.
A **Service Commission Override** belongs to one Commission Agreement and one **ServiceVariant**; services without an override use the agreement's default percentage.
A **Commission Agreement** applies only to appointments completed while it is active; activation does not backfill earlier completions.
A disabled **Commission Agreement** produces no Staff Commissions; disabling it preserves its Service Commission Overrides and existing commissions.
A **Staff Commission** retains the percentage that produced it when the agreement or its Service Commission Overrides later change.
Active **Staff Profile Access** reveals only that profile's own Commission Agreement and commission history; it is not required for the profile to earn commissions.

**Example dialogue**:

> **Manager:** “I activated a 20% Commission Agreement for Mina today.”
>
> **Developer:** “Her appointments completed from now on can earn Staff Commission. Earlier completions are not backfilled, and a later rate change will not rewrite these earnings.”
>
> **Manager:** “Mina earns 30% for coloring.”
>
> **Developer:** “Coloring appointments use her 30% Service Commission Override; her other services continue to use the 20% default.”

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

## Flagged ambiguities

- “staff cut” could mean either **Staff Commission** or **Salon Retained Amount** — use the exact term.
- “income” could mean an appointment total, an earned **Staff Commission**, collected payment, or profit — Saluna must not use it alone in financial labels.
