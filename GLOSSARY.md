# Saluna glossary

Saluna helps salons manage services, appointments, staff, and client relationships.
These are the canonical domain terms; [ADRs](docs/adr/) record decisions and
[the backlog](backlog/INDEX.md) records delivery status.

## Appointments

**Appointment**:
A scheduled service for a validated Client, with a BookedServiceSnapshot and staff assignments sharing one time window.
_Avoid_: booking as an entity name; "booking" is acceptable in customer-facing copy.

**Appointment Staff Assignment**:
One Staff Profile's participation in an Appointment, including its lead role and Work Allocation. Assignments are the only roster: exactly one lead, optional extras for multi-staff services, and each profile occupies the full time window.
_Avoid_: assistant shift, separate appointment, independent lead ID.

**Appointment Intake**:
The server validation gate for creating or updating an Appointment, including AppointmentRequest approval.
_Avoid_: using the name for a UI drawer or form.

## Appointment requests

**AppointmentRequest**:
A customer- or manager-recorded proposal awaiting salon approval, kept off-calendar without reserving availability. Manager-recorded requests identify a Client; customer-recorded requests may carry raw contact until approval.
_Avoid_: pending appointment, confirmed booking, separate Draft aggregate.

**Rejected / cancelled AppointmentRequest**:
A rejected request was declined by the salon; a cancelled request was withdrawn by the customer. Approved, rejected, cancelled, and expired requests are terminal history; renewed demand is a new request.

**Flexible AppointmentRequest**:
A manager-recorded request for one Client and one ServiceVariant, with acceptable dates and one Time Preference. Its Client and BookedServiceSnapshot stay fixed; it expires after the last acceptable Salon-local Date ends.

**Request Horizon**:
The inclusive period from Salon-local today through 90 days ahead in which a Flexible AppointmentRequest may specify acceptable dates.

**Time Preference**:
A start-time band shared by all acceptable dates: Morning before 12:00, Afternoon from 12:00 to before 17:00, Evening from 17:00, or Any time. Appointment end time is unconstrained by the band.
_Avoid_: custom time window, salon-defined band.

## Service catalog

**ServiceCategory**:
A salon's broad service grouping, such as nails, hair, or skin care. Persian UI: `دسته`.

**ServiceVariant**:
One sellable, bookable salon service within a ServiceCategory. Ordinary product copy uses "service"; Persian UI: `خدمت`.
_Avoid_: package, family, subtype, offering.

**ServiceFamily**:
A legacy grouping retained for historical catalog data. New workflows use ServiceCategory and ServiceVariant directly.

**Multi-Staff ServiceVariant**:
A ServiceVariant permitting multiple Staff Profiles on one Appointment. Extra assignments are optional; other services allow exactly one.
_Avoid_: required staff count, multi-staff appointment type.

**Service Package**:
A sellable bundle of PackageComponents, scheduled by a manager as same-day Package Tasks with one booked package price. Tasks may have gaps or run in parallel; public booking remains service-only.
_Avoid_: combo service, service group.

**PackageComponent**:
A ServiceVariant included in a Service Package's catalog definition, before staff or calendar times are assigned.
_Avoid_: Package Task, scheduled appointment, combo component.

**Package Task**:
The scheduled realization of one PackageComponent, with its own Appointment, staff assignments, and time window.

**ServiceAddon**:
An optional extra selected with a ServiceVariant, contributing duration and price.

## Catalog presets

**CatalogPreset**:
A product-maintained starter catalog imported by a salon, with curated category and service defaults. It is not sellable and imports neither packages nor legacy families; Persian UI: `قالب خدمات`.
_Avoid_: package, bundle, template service.

**PresetCategory / PresetVariant**:
Reusable product-maintained category and service definitions used to assemble a CatalogPreset.

**Preset Catalog**:
The library of preset categories, preset services, and CatalogPresets maintained by platform staff.

## Booked snapshots

**BookedServiceSnapshot**:
The request- or Appointment-owned copy of a selected ServiceVariant's name, duration, and price. Later catalog changes do not rewrite it.

**BookedAddonSnapshot**:
The Appointment-owned copy of a selected ServiceAddon's name, additional duration, and additional price.

**AppointmentTotalsSnapshot**:
An Appointment's booked duration and price including add-ons. A Package Task's allocated share of the booked package price determines its report and commission amounts.
_Avoid_: collected payment, current catalog price.

## Calendar

**Salon-local Date**:
A calendar day in `Asia/Tehran`, used for operational "today".
_Avoid_: UTC today, server-local date, browser-local date.

**Salon Week**:
Saturday through Friday in Salon-local Dates. "Next week" is the immediately following Salon Week.
_Avoid_: Sunday-start week, ISO week.

**Jalali Month**:
The Jalali calendar month containing a Salon-local Date, used for operational "this month" and "next month".
_Avoid_: Gregorian month, JavaScript month.

**Reporting Period**:
An inclusive range of Salon-local Dates for operational reports, using Salon Weeks, Jalali Months, or explicit dates. A yearly period uses the Jalali year containing today.
_Avoid_: subscription term, SMS Allowance period.

**Salon Working Days**:
The weekdays on which a salon intends to open, independently of individual staff schedules.

**Salon Closure**:
Salon-local Dates explicitly closed to new Appointment intake, overriding Salon Working Days and staff schedules. Existing Appointments remain valid.
_Avoid_: staff time off, recurring closure.

## Clients and retention

**Client**:
A salon-owned customer record for appointments, retention, and messaging. Persian UI: `مشتری`.
_Avoid_: Device Contact; "customer" is acceptable in public-facing copy.

**Client Birth Date**:
An optional complete Jalali birth date containing year, month, and day. A birthday on ۳۰ اسفند recurs on ۲۹ اسفند in non-leap years.
_Avoid_: month/day-only birthday, stored age.

**Client Follow-Up**:
A salon's actionable reason to contact one Client, with its own status and outreach history.

**Retention Queue**:
The shared manager queue of actionable Client Follow-Ups.
_Avoid_: separate birthday queue, customer-moments queue.

**Birthday Follow-Up**:
A distinct Client Follow-Up for one Jalali birthday year, actionable from seven Salon-local days before through seven days after the birthday. It closes on handling or dismissal and expires after that window.
_Avoid_: reopening last year's follow-up, automatic birthday message.

**Device Contact**:
A phone address-book entry that may be imported as a Client.

**Client Import**:
Creating Clients from VCF, CSV, or Device Contacts with duplicate-phone checks. Assisted imports require confirmation of the preview.

## Salon ownership and setup

**Salon**:
The business owning its catalog, Clients, Staff Profiles, Appointments, and commercial balances.

**Salon Owner**:
The person whose verified identity assumes salon ownership through signup or Salon Handoff.
_Avoid_: admin-created owner, account owner.

**Assisted Salon Setup**:
Preparation of a Setup Salon by authorized platform staff before handoff to its verified Salon Owner.
_Avoid_: impersonation, admin-owned salon.

**Setup Salon**:
A non-public salon prepared for an intended owner who has not completed Salon Handoff.
_Avoid_: Setup Case, active salon, draft workspace.

**Setup Page**:
A focused preparation page for one part of a Setup Salon within its Salon Workspace.

**Salon Handoff**:
The one-time transfer of a Setup Salon to its intended, phone-verified Salon Owner. It activates the salon and ends ordinary platform setup access.
_Avoid_: owner approval, setup review, identity transfer.

**Salon Workspace**:
The per-salon platform admin area for its overview, operational pages, and setup pages.

**Platform Owner**:
A platform role authorized to override active-salon setup boundaries and grant internal commercial access or SMS Credits.
_Avoid_: Salon Owner, impersonated manager.

**Platform Owner Override**:
An attributable Platform Owner action on an active salon after handoff. It grants neither authentication secrets nor session takeover or another user's identity.
_Avoid_: unrestricted access, impersonation.

**Salon Presence**:
A salon's public address, map links, social links, and contact details. Persian UI: `حضور آنلاین`.

## Staff and commissions

**Staff Profile**:
A salon-owned service provider record with a display identity, schedule, and capabilities. It may exist and earn commissions without login access.
_Avoid_: staff account, employee user.

**Staff Invite**:
A phone-bound invitation connecting a verified staff identity to one Staff Profile only after explicit acceptance.
_Avoid_: manager-created account, access transfer.

**Staff Profile Access**:
A revocable link from one verified staff identity to one Staff Profile. An identity may have access in several salons, with at most one active link per salon.
_Avoid_: profile ownership, shared staff account.

**Staff Access Revocation**:
Ending Staff Profile Access by manager revocation or staff departure while preserving the Staff Profile and operational history.
_Avoid_: delete staff, deactivate profile, transfer identity.

**Work Allocation**:
An Appointment Staff Assignment's percentage of its Appointment's booked amount before commission rates apply. Allocations total 100%, default to equal shares, and use the allocated package amount for Package Tasks.
_Avoid_: commission rate, duplicated Appointment price.

**Eligible Commission Basis**:
A Staff Profile's Work Allocation of an Appointment's booked amount. For a Package Task, that amount is its deterministic proportional share of the booked package price.
_Avoid_: collected revenue, catalog component price.

**Commission Agreement**:
One Staff Profile's salon-specific default commission percentage and optional Service Commission Overrides, with at most one active agreement per salon and profile. It applies to completions while active without backfilling earlier earnings.

**Service Commission Override**:
A ServiceVariant-specific percentage replacing the default in a Staff Profile's Commission Agreement.
_Avoid_: category commission, separate Commission Agreement.

**Staff Commission**:
An assigned Staff Profile's earnings from a completed Appointment, calculated from its Eligible Commission Basis and applicable Commission Agreement. The earned percentage is retained when the agreement changes.
_Avoid_: salary, wage, staff cut.

**Salon Retained Amount**:
A completed Appointment's booked amount remaining after all assigned Staff Commissions.
_Avoid_: collected revenue, profit, salon commission.

**Salon Money Report**:
A Reporting Period view of completed Appointment booked amounts, Staff Commissions, and Salon Retained Amount. A Staff Profile filter selects their Appointments without reducing full booked amounts or excluding other staff's commissions from the retained amount.
_Avoid_: payment collection report, profit report.

## Commercial access

**Salon-Funded SaaS**:
Saluna's model in which the Salon pays for software and related services and retains its relationship with each Client.
_Avoid_: consumer marketplace, lead broker, advertising network.

**Trial**:
A verified Salon Owner's one-time 30-day full-access period on the first Salon they activate, with [ADR-0024](docs/adr/0024-existing-salons-transition-through-the-trial.md) granting a launch-transition Trial to every already-active Salon. Setup preparation consumes no Trial time; unpaid expiry grants Read-Only Access without grace.
_Avoid_: free plan, freemium tier.

**Salon Subscription**:
A prepaid access term for exactly one Salon, priced by its active Staff Profile limit. Core features remain available across tiers; limits and SMS balances are not pooled between salons.
_Avoid_: per-user plan, feature tier.

**Staff Profile Limit**:
The maximum active Staff Profiles permitted by a Salon Subscription. Exceeding it blocks creation, reactivation, or downgrade rather than automatically removing profiles.
_Avoid_: login limit, automatic staff removal.

**Subscription Purchase**:
One paid Salon Subscription term with a preserved price and limits.
_Avoid_: lifetime price, grandfathered plan.

**Subscription Renewal**:
An explicit Subscription Purchase for another prepaid term using the current offer.
_Avoid_: automatic charge, stored payment mandate.

**Verified Payment**:
Payment Provider confirmation of the exact Subscription Purchase and snapshotted amount, required for customer paid access.
_Avoid_: browser return, receipt image, manual paid activation.

**Payment Provider**:
The external gateway for checkout and verification. Zarinpal is the launch provider; commercial records remain provider-neutral.

**Grace Period**:
Three days of operational access after a paid Salon Subscription ends, with existing SMS Credits usable but no new allowance. Trials have no grace; unpaid grace expiry grants Read-Only Access.

**Read-Only Access**:
Readable retained salon data and public contact presence after unpaid access expires, with operational writes, salon-funded SMS, and new AppointmentRequests blocked. Nonpayment does not delete data or prevent owner export or explicit deletion requests.
_Avoid_: deleted account, suspended Salon.

**Unlimited Access**:
Permanent access for an internal or test Salon without a subscription, staff limit, or expiry. It does not grant unlimited SMS.
_Avoid_: customer paid purchase, temporary override.

**Client Payment**:
Money a Client pays a Salon for services, including deposits. The Salon is the merchant and beneficiary; Saluna does not hold, pool, or settle the funds.
_Avoid_: Subscription Purchase, platform-held funds.

## SMS credits

**SMS Credit**:
Permission to send one provider-billable segment for a salon-funded purpose during Trial, paid access, Grace Period, or Unlimited Access. Authentication, recovery, and identity-verification messages are Saluna-funded and consume no Salon SMS Credits.
_Avoid_: message count, unlimited SMS.

**SMS Allowance**:
A capped monthly grant of plan SMS Credits while a Salon Subscription is active. Unused credits expire at each boundary; annual subscriptions also refresh monthly.
_Avoid_: rollover balance, annual upfront allowance.

**SMS Credit Bundle**:
Separately purchased, prepaid SMS Credits held in a non-expiring balance.
_Avoid_: SMS subscription.

**SMS Credit Grant**:
Finite non-expiring SMS Credits added by a Platform Owner to the purchased-credit balance, with the grant source preserved.
_Avoid_: unlimited SMS.

**SMS Billing Profile**:
A provider's replaceable rules for estimating billable segments and reconciling actual send cost.
_Avoid_: global character limit, provider-specific subscription.

## Product support

**Support Ticket**:
A salon manager's conversation with platform support, visible to that salon's managers. Resolving a feature request closes the conversation, not a promise to deliver the feature.
_Avoid_: engineering issue, AppointmentRequest.

**Support Message**:
A manager- or platform-support-authored entry in a Support Ticket, including its initial description.

**Support Ticket Category**:
The classification `problem`, `question`, `feature_request`, or `other` within one support workflow.
_Avoid_: department, separate ticket type.

## Public content

**Blog Article**:
A public editorial page about a salon-management problem or related topic.
_Avoid_: Product Guide, release note.

**Product Guide**:
A maintained public how-to page for one Saluna task, reviewed when that product flow changes.
_Avoid_: Blog Article, Support Ticket, in-app hint.

## Ambiguous labels

- "Income" can mean booked amounts, Staff Commission, collected Client Payments,
  or profit. Use the exact term.
- "Month" can mean a Jalali Month or an SMS Allowance period. Name the period.
- "Staff" can mean a Staff Profile, login identity, or Appointment Staff
  Assignment. Name the entity.
