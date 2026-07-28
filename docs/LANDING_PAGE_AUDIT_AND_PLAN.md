# Landing Page Audit and Improvement Plan

Status: planning reference  
Reviewed: 2026-07-24  
Scope: `apps/web` landing page content and its coverage of the shipped Saluna product

## Purpose

This document records what the current landing page communicates, what it
misses or describes incorrectly, and a practical plan for improving it later.
It is not an implementation specification and does not authorize claims about
features that are not shipped.

## Executive summary

The landing page has a strong, recognizable salon aesthetic and works well in
Persian on desktop and mobile. It successfully identifies Saluna as salon
management software and covers its basic areas: appointments, clients, staff,
services, the public salon page, and customer appointment requests.

It does not yet communicate Saluna's strongest operational advantages. The
hero describes a software category instead of a distinctive workflow, the page
does not show the real product, and several valuable shipped capabilities are
missing or understated. Some visible copy also exposes internal SEO/pricing
notes or legacy catalog terminology.

Indicative audit scores:

| Area                | Score | Summary                                                 |
| ------------------- | ----: | ------------------------------------------------------- |
| Visual identity     |  8/10 | Memorable, cohesive, and appropriate for the market     |
| Product clarity     |  6/10 | The category is clear; the distinctive value is not     |
| Feature coverage    |  6/10 | Core areas are present; important workflows are missing |
| Conversion strength |  5/10 | Clear CTA, but little product proof or trust            |

## Sources reviewed

- `apps/web/src/pages/index.astro`
- `apps/web/src/content/landing.ts`
- `apps/web/src/content/public-site.ts`
- `apps/web/src/components/landing/*`
- The rendered landing page at desktop and mobile viewport sizes
- Manager and staff routes under `apps/pwa/src/routes`
- Manager navigation and settings surfaces
- Relevant API routes and service-package UI
- `CONTEXT.md` and the applicable ADRs under `docs/adr`

## What the current page communicates well

The following capabilities are present and reasonably understandable:

- Appointment management and the salon calendar
- Client profiles, notes, tags, and visit history
- Staff capabilities and working schedules
- Service catalog, prices, durations, and add-ons
- Daily overview, dashboard, and customer follow-up
- Public salon page
- Customer-created appointment requests
- Manager review before a request becomes a confirmed appointment
- Notifications and connected messaging in broad terms
- Persian, right-to-left, mobile and desktop use
- Free experimental access

The request flow is one of the strongest parts of the page. It correctly
explains that a customer request does not automatically occupy the salon
calendar and must first be reviewed by the manager.

## Important capabilities missing or understated

These shipped capabilities have meaningful customer value and should be
considered for the improved page:

### High priority

- Staff commission reporting and each staff member's own earnings view
- Service packages with component tasks, staff assignment, and scheduling
- Bulk client import with duplicate/error preview
- Manager-recorded requests originating from phone calls or messages
- Flexible request dates and time preferences
- Schedule and capability validation when assigning appointments
- Actual dashboard reporting, including popular services and staff workload

### Medium priority

- Salon address, map links, and social presence
- Staff invitations and individual staff access
- Ready-made service catalog presets during onboarding
- Client retention signals and follow-up actions
- In-app support for salon managers

Not every shipped feature belongs on the landing page. OTP authentication,
platform administration, assisted salon setup, internal support state
transitions, and other implementation details should remain outside the
primary marketing story.

## Copy problems to correct

### 1. Legacy catalog language

Current copy uses terms such as:

> دسته، گروه، خدمت ... خدمات ترکیبی

The current domain language should not expose the legacy family/group layer or
call packages "combined services." Prefer:

> دسته، خدمت، افزودنی و پکیج خدمات

Affected content includes:

- `apps/web/src/content/landing.ts`
- `apps/web/src/content/public-site.ts`

### 2. Internal SEO commentary is visible

The following sentence is written for the team, not the customer:

> این محتوا هم برای مشتری سالن خواناست و هم برای موتورهای جست‌وجو دقیق و قابل فهم است.

Replace it with a customer outcome. Search topics should appear naturally in
useful headings and prose rather than as visible keyword chips.

### 3. Pricing uncertainty is overemphasized

Experimental access and unfinished pricing are repeated in the hero, pricing
section, FAQ, and final CTA. This makes uncertainty a dominant part of the
message.

The following visible bullet is an internal policy note and should be removed:

> قبل از اعلام پلن‌ها، از بیان قیمت ثابت یا تعهد دائمی رایگان بودن خودداری می‌کنیم.

One short statement is enough:

> استفاده از نسخه آزمایشی فعلاً رایگان است. پیش از شروع پلن‌های پولی اطلاع‌رسانی می‌کنیم.

### 4. OTP is presented like a product benefit

The services page combines "SMS confirmation" with notifications. Login OTP is
a security mechanism, not a salon-management feature. Marketing copy should
describe actual in-app or connected-messenger notifications and avoid implying
customer reminder behavior that is not implemented.

### 5. The broad headline overclaims

> همه چیز برای مدیریت روزانه سالن

This is less credible than a precise promise. Prefer:

> کارهای اصلی سالن، در یک جریان منظم

### 6. Footer language is inconsistent

`Tehran, Iran` should be presented as `تهران، ایران` on the Persian page.

## Positioning problem

The current hero says what category Saluna belongs to, but not why a salon
should choose it instead of a paper calendar, spreadsheet, notes app, or
message threads.

The differentiating story supported by the product is:

1. Collect online, phone, and message-originated demand in one place.
2. Check the requested service against staff capability and availability.
3. Keep the manager in control of approval.
4. Put only confirmed appointments on the calendar.
5. Preserve client, service, staff, and financial history for later follow-up.

This workflow should become the spine of the landing page.

## Suggested hero direction

Suggested headline:

> نوبت‌ها، مشتری‌ها و تیم سالن؛ بدون دفتر و پیام‌های پراکنده

Suggested supporting copy:

> درخواست‌های آنلاین، تلفنی و پیام‌رسان را یک‌جا ثبت کنید، زمان مناسب را با برنامه پرسنل هماهنگ کنید و نوبت‌های تأییدشده را وارد تقویم سالن کنید.

Suggested primary CTA:

> ساخت رایگان سالن

Suggested CTA reassurance:

> ثبت‌نام با شماره موبایل • مناسب موبایل و دسکتاپ • نسخه آزمایشی رایگان

This is more concrete than "test Saluna" and accurately reflects the signup
flow.

## Visual and structural findings

### What works

- The cherry-blossom art creates a distinctive and coherent visual identity.
- The Persian display typography gives the page character.
- Desktop and mobile layouts remain readable and structurally sound.
- CTA buttons are prominent and easy to identify.
- The design feels relevant to beauty salons rather than generic business SaaS.

### What should improve

- The hero background is decorative but provides no product proof.
- The current "DashboardPreview" is a marketing card composition, not a real
  dashboard preview.
- Some mobile hero text sits over detailed artwork and could use stronger
  contrast.
- Mobile navigation exposes only login; visitors cannot quickly jump to
  features or pricing.
- Six equal feature cards flatten the product into a generic checklist.
- There are no real screenshots, customer examples, testimonials, or other
  trust signals.
- The page does not show the relationship between requests, staff schedules,
  confirmed appointments, clients, and reporting.

Do not fabricate salon counts, testimonials, time savings, or performance
statistics. Add social proof only when genuine evidence exists.

## Recommended page structure

1. Outcome-focused hero with a real product screenshot
2. Request-to-confirmed-appointment workflow
3. Daily calendar and operational control
4. Client records, import, and retention
5. Staff schedules, access, and commissions
6. Services, add-ons, and service packages
7. Public salon page and online presence
8. Real dashboard/reporting screenshots
9. Short experimental-pricing statement
10. FAQ and final CTA

## Implementation plan

### Phase 1: Correct inaccurate and internal-facing copy

Goal: make every current claim accurate without redesigning the page.

- Replace legacy catalog terminology.
- Remove the internal SEO sentence and visible keyword chips.
- Remove internal pricing-policy language.
- Consolidate free-access messaging.
- Separate OTP/security copy from notification benefits.
- Translate the footer location.
- Replace overly broad claims with precise language.

Acceptance criteria:

- No public copy exposes `ServiceFamily`/group as a current catalog concept.
- Packages are called service packages, not combined services.
- No visible sentence discusses SEO strategy or internal pricing policy.
- Every notification/messaging claim maps to a shipped behavior.
- The same corrected terminology is used on both `/` and `/services`.

### Phase 2: Reposition the hero and feature narrative

Goal: explain the problem Saluna solves within the first viewport.

- Replace the category-only headline with an outcome-focused promise.
- Explain the request-to-calendar workflow in the hero or immediately below it.
- Change the primary CTA to a concrete action such as "ساخت رایگان سالن."
- Add concise signup reassurance.
- Group capabilities into customer workflows rather than equal generic cards.

Acceptance criteria:

- A new visitor can identify the intended user, primary problem, and workflow
  without scrolling past the first two sections.
- Customer requests are clearly distinguished from confirmed appointments.
- Copy explains why Saluna is better than fragmented calendars and messages.

### Phase 3: Add real product evidence

Goal: let visitors see that the product exists and understand how it works.

- Capture current, representative product screens using safe demo data.
- Show a mobile calendar/dashboard screen near the hero.
- Show a three-step sequence: request, manager review, confirmed appointment.
- Add focused screenshots for client follow-up and commissions/packages if they
  remain part of the marketing narrative.
- Use concise captions that state the outcome, not the UI control names.

Acceptance criteria:

- At least one real product screen appears above or directly below the fold.
- Screens contain no real client, phone, salon, or financial data.
- Screens remain legible on mobile and have meaningful alternative text.
- Visuals match the current shipped interface.

### Phase 4: Add trust and conversion support

Goal: reduce uncertainty before signup.

- Add real testimonials or pilot-salon feedback when available.
- Explain what experimental access includes in one place.
- Add accurate privacy/security reassurance near the CTA.
- Explain expected setup steps: phone verification, salon creation, and guided
  onboarding.
- Add a compact mobile navigation path to features and pricing.

Acceptance criteria:

- No fabricated metrics or testimonials.
- Visitors know what happens after pressing the primary CTA.
- Pricing/access language is consistent across hero, FAQ, and CTA.
- Primary CTA clicks can be measured without collecting unnecessary personal
  data.

### Phase 5: Validate after implementation

- Review all copy against `CONTEXT.md` and relevant ADRs.
- Verify desktop and mobile rendering.
- Check heading hierarchy, keyboard use, reduced motion, contrast, and image
  alternative text.
- Run the web app's format, lint, typecheck, build, and smoke commands.
- Verify metadata and structured FAQ data match visible copy.
- Compare CTA engagement before and after the change when real analytics are
  available.

## Content selection rule

The landing page should not enumerate every API or screen. A capability earns
prominent space when it:

1. solves a problem salon managers recognize,
2. differentiates Saluna from simpler tools,
3. is currently shipped and reliable, and
4. can be explained as an outcome rather than an implementation detail.

Everything else can live on the detailed services page, in the FAQ, or remain
inside the product.

## Recommended first implementation slice

The smallest high-impact slice is Phases 1 and 2 plus one real mobile product
screenshot. This corrects misleading copy, clarifies the product's distinctive
workflow, and adds proof without requiring a full visual redesign.
