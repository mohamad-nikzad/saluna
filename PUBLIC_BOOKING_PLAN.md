# Public Salon Page & Appointment Requests

> Terminology, status enums, and aggregate boundaries in this plan are governed by `CONTEXT.md` and `docs/adr/0001-appointment-request-as-distinct-aggregate.md`, `docs/adr/0002-no-soft-hold-on-pending-requests.md`. Read those before editing this plan.

## Context

Today, only authenticated managers/staff can create appointments via the dashboard. There is no customer-facing surface. Salons want to share a single URL (Instagram bio, WhatsApp) where customers can browse services, see real availability, and request an appointment — without the salon team handing out phone numbers.

We need:
1. A **public, unauthenticated page** per salon at `saloora.com/salons/[slug]` showing services and live availability.
2. **Customizable** by the manager (logo, banner, bio, accent color, which services are visible & their order).
3. An **AppointmentRequest** flow for customers that does **not** appear on the staff calendar — requests land in a separate "Requests" inbox for manager review. On approval, the request is converted into an `Appointment` by re-running `Appointment Intake`.
4. Architectural room for **deposits/full prepayment** later (schema hooks only; no payment integration now). Deposits are the planned throttle that replaces today's "no hold" model — see ADR-0002.

## Approach

### 1. Database — new tables (in `/packages/database/src/schema.ts`)

**`salon_public_settings`** — one row per salon, drives the public page:
- `salonId` (PK, FK → salons)
- `enabled` boolean (default false — manager must opt in before slug is reachable)
- `logoUrl`, `bannerUrl`, `bioText` (nullable text)
- `accentColor` (hex, nullable)
- `appointmentRequestsEnabled` boolean (default true) — kill switch
- `depositPolicy` jsonb nullable — placeholder for future (`"none"` | `{ type: "fixed" | "percent", value: number }`); not used in v1 logic
- `updatedAt`

**`service_public_visibility`** — per-service overrides:
- `salonId`, `serviceId` (composite PK)
- `visible` boolean
- `sortOrder` integer
- Services without a row default to visible (sorted by name) — avoids backfill.

**`appointment_requests`** — customer-submitted proposals, awaiting manager review (see CONTEXT.md → `AppointmentRequest`):
- `id`, `salonId`, `serviceId`
- `staffId` (FK → users, nullable; always `null` at submit; set by manager at approval time)
- `requestedDate` (YYYY-MM-DD), `requestedStartTime`, `requestedEndTime` (HH:MM)
- `customerName`, `customerPhone` (canonical `09XXXXXXXXX`, validated via `phoneSchema`)
- `notes` (nullable)
- `bookedServiceName`, `bookedServiceDuration`, `bookedServicePrice` — immutable snapshot mirroring the `BookedServiceSnapshot` shape on `appointments`. Binding on approval (see "Snapshot binding" below).
- `status` enum: `pending` | `approved` | `rejected` | `cancelled` | `expired`
- `paymentStatus` enum: `none` | `pending` | `paid` (default `none`) — schema hook for deposits
- `depositAmount` numeric nullable — schema hook for deposits
- `confirmationToken` uuid notnull unique — customer's status URL key (lifetime: forever)
- `reviewedByUserId` nullable FK → users
- `reviewedAt` nullable, `rejectionReason` nullable
- `appointmentId` nullable FK → appointments (set when approved)
- `createdAt`, `updatedAt`
- Indexes: `(salonId, status, requestedDate)`, `(salonId, customerPhone)`

**`public_submit_rate_limits`** — counter for IP throttling (5 submits per IP per 10 min):
- `ip` text, `createdAt` timestamptz
- Index on `(ip, createdAt)`
- Rows older than 10 min are noise; purge opportunistically or via the daily cron.

Migration: new Drizzle migration via `pnpm db:generate` in `packages/database`.

### 2. Availability — reuse as-is

`getDayAvailability` / `getNearestAvailability` in `/packages/salon-core/src/availability.ts` already do the right thing and have no auth dependency. Use them unchanged for the public endpoint:
- Only **approved appointments** (status `scheduled` | `confirmed`) block slots.
- `AppointmentRequest`s never block availability — multiple `pending` requests may stack on the same slot. See ADR-0002.
- Public availability is the **union of free slots across all staff capable of the service**. Customers never see, pick, or filter by staff in v1.
- On approval, `Appointment Intake` re-validates and may 409 if the slot was taken in the meantime — manager rejects or picks a different slot. This is acceptable because manager review is the throttle.

### 3. Public API — Hono routes, registered in both surfaces

Business logic lives in `@repo/database` so both Hono and the legacy Next.js route handlers can wrap it thinly. The Next handlers exist only for the Vercel testing window while the Hono worker is unstable; they will be deleted after the Hono migration.

**Implementation locations**
- `@repo/database/src/public.ts` — `getPublicSalon(slug)`, `getPublicAvailability(...)`, `createAppointmentRequest(...)`, `getAppointmentRequestByToken(token)`, `cancelAppointmentRequestByToken(token)`.
- `@repo/database/src/rate-limit.ts` — `checkAndRecordPublicSubmit(ip)`.
- `apps/api/src/routes/public.ts` — Hono routes, mounted at `/api/v1/public` **without** `requireTenant`. Tested.
- `apps/app/app/api/public/**` — bare-minimum Next route handlers calling the same `@repo/database` functions. No tests.
- `apps/app/next.config.mjs` — add `'public'` and `'appointment-requests'` to `HONO_DOMAINS`.

**Endpoints** — all resolve the salon by `slug` and 404 if missing or `enabled=false`:

- `GET /public/salons/:slug` → `{ salon, publicSettings, services (filtered+ordered by visibility) }`. **No `staff` field** — staff is not exposed publicly.
- `GET /public/salons/:slug/availability?serviceId&date` → slot list for that day, union across capable staff. `date` must fall within `[salonToday, salonToday + 30]` in `Asia/Tehran` (use `salonTodayYmd`). Optionally `mode=nearest&days=14`.
- `POST /public/salons/:slug/appointment-requests` → validates via `publicAppointmentRequestSchema` (Zod, enforces `09XXXXXXXXX` phone and the 30-day window), runs `checkAndRecordPublicSubmit(ip)`, inserts `appointment_requests` row with `status='pending'`, `staffId=null`, `confirmationToken=uuid()`. Returns `{ token }`.
- `GET /public/salons/:slug/appointment-requests/:token` → status view. Returns `status`, service name/duration/price (snapshot), requested slot, salon contact phone. **Hides customer name and phone** — token authorizes "view status," not "view identity."
- `POST /public/salons/:slug/appointment-requests/:token/cancel` → flips `pending` → `cancelled`. 409 if not currently `pending`.

### 4. Manager API — approval inbox

- `@repo/database/src/appointment-requests.ts` — `listAppointmentRequests(salonId, filter)`, `approveAppointmentRequest(...)`, `rejectAppointmentRequest(...)`, `lookupClientByPhone(salonId, phone)`.
- `apps/api/src/routes/appointment-requests.ts` — mounted under `requireTenant('manage_appointments')`. Tested.
- `apps/app/app/api/appointment-requests/**` — bare-minimum Next handlers, no tests.

**Endpoints**:
- `GET /appointment-requests?status=pending` → list for the tenant's salon. Inbox query filters `status='pending' AND requestedDate >= salonToday`, orders by `requestedDate ASC, requestedStartTime ASC`. An optional `status` filter exposes the other tabs (rejected, cancelled, expired).
- `POST /appointment-requests/:id/approve` body `{ staffId }`: atomically conditional-update from `pending`, run `validateCreateAppointmentIntake` with the request's **snapshot** (binding — see below) and the supplied `staffId`, `createAppointment`, set request `status='approved'` and `appointmentId`. On any conflict (slot taken, no longer pending, staff no longer capable/free), return 409 with reason.
- `POST /appointment-requests/:id/reject` body `{ reason? }` → `status='rejected'`.
- `POST /appointment-requests/:id/reschedule` → v1.1.

**Snapshot binding**: on approval, `Appointment Intake` uses the request's `bookedServiceName/Duration/Price` rather than re-reading the live service row. The customer is honored at the terms they saw. If the underlying `ServiceVariant` has since been archived or edited, the inbox row shows a warning but the request is still approvable — the manager always decides; nothing auto-rejects.

**Existing-client hint**: the list response includes a precomputed `existingClient: { id, name } | null` per row, via `lookupClientByPhone(salonId, customerPhone)`. UI shows a badge; the actual client lookup-or-create happens inside `validateCreateAppointmentIntake` on approve.

### 5. Manager UI — PWA only in v1 (native deferred)

Native (`apps/native`) work is **out of scope for v1**. Without push notifications (unusable in Iran), the native inbox offers no advantage over the PWA, which already runs as a home-screen installable app. Defer to v1.1 once the workflow has stabilized.

**PWA (`apps/app`)**:
- New route `/apps/app/app/(app)/requests/page.tsx` — pending list with badge count (mirrors `/today/page.tsx`). Row content: service · date/time · phone (with `tel:` and `wa.me/` action buttons) · existing/new client badge. Row actions: Assign staff (dropdown of capable, free staff for the slot) + Approve · Reject. Tabs for `rejected | cancelled | expired` for history.
- Sidebar nav entry gated by `manage_appointments`. Staff role: nav hidden, calendar/today untouched, no `AppointmentRequest`s ever surface.
- Extend `/apps/app/app/(app)/settings/page.tsx` with a "Public page" tab: enable toggle, logo URL, banner URL, bio textarea, accent color picker, services table (drag-reorder + visible toggle → writes `service_public_visibility`), and a "Copy public link" button.

Notifications: in-app badge on the Requests nav entry only. SMS is the planned future channel; status-transition handlers in `@repo/database/src/appointment-requests.ts` are the single chokepoint to wire it into later. No schema changes required for SMS.

### 6. Public UI — `apps/web`

- `/apps/web/app/salons/[slug]/page.tsx` — salon header (logo/banner/bio), service list grouped by family/category, "Book" CTA per service.
- `/apps/web/app/salons/[slug]/book/[serviceId]/page.tsx` — date picker (today + next 30 days only) + slot grid + customer form (name, phone, notes). **No staff picker.** Submits to public API.
- `/apps/web/app/salons/[slug]/requests/[token]/page.tsx` — confirmation/status page. Copy: *"درخواست شما ثبت شد. سالن با شما تماس می‌گیرد."* + salon phone (from `salons.phone`). For `expired`: *"درخواست شما در زمان مقرر بررسی نشد. لطفاً برای رزرو با سالن تماس بگیرید."* For `pending`: a "Cancel my request" button calling the cancel endpoint.

All RTL/Persian, matching existing `apps/web` styling. Accent color injected via CSS variable from `publicSettings`.

Server components fetch via direct `fetch()` to the API (no auth header). Slot grid is a client component that re-fetches when date changes.

### 7. Stale-request expiry (daily cron)

A `pending` `AppointmentRequest` whose `requestedDate < salonToday` is auto-moved to `expired`. Customers see the honest "we didn't get to you" status; the inbox doesn't accumulate dead entries.

- New CLI: `apps/api` exposes a script `expire-requests` (`pnpm --filter @repo/api expire-requests`) that runs a single `UPDATE appointment_requests SET status='expired', reviewedAt=now() WHERE status='pending' AND requestedDate < CURRENT_DATE`.
- Invocation in v1: manual or via a temporary scheduled CF Worker hitting an authenticated `POST /internal/cron/expire-requests`. In prod (VPS), wire it to system cron at 03:00 `Asia/Tehran`.

### 8. Future payment hook (no implementation)

- `salon_public_settings.depositPolicy` and `appointment_requests.paymentStatus` / `depositAmount` columns exist now, unused.
- API response shapes include these fields as optional from day one so future client code doesn't need a breaking change.
- Document in a schema code comment only — no UI, no provider integration. See ADR-0002 for why deposits are the eventual throttle.

## Implementation phases

The work is split into five phases. Each phase leaves the tree in a coherent, type-checking state and is sized for a single focused session.

### Phase 1 — Foundation (DB + shared schemas)
- `packages/database/src/schema.ts`: 3 new tables (`salon_public_settings`, `service_public_visibility`, `appointment_requests`, `public_submit_rate_limits`) + 2 enums (`appointment_request_status`, `appointment_request_payment_status`).
- Generate Drizzle migration via `pnpm --filter @repo/database db:generate`.
- `packages/salon-core/src/forms/`: add `publicAppointmentRequestSchema`, `publicSettingsSchema`.
- `packages/database/src/`: new modules `public.ts`, `appointment-requests.ts`, `rate-limit.ts` (pure business logic, no transport).

### Phase 2 — API surface
- Hono routes: `apps/api/src/routes/public.ts` (no auth) and `apps/api/src/routes/appointment-requests.ts` (under `requireTenant('manage_appointments')`), with tests.
- Thin Next.js wrappers under `apps/app/app/api/public/**` and `apps/app/app/api/appointment-requests/**` (no tests).
- `apps/app/next.config.mjs`: add `'public'` and `'appointment-requests'` to `HONO_DOMAINS`.
- `apps/api/src/cli/expire-requests.ts` + `expire-requests` script in `apps/api/package.json`.

### Phase 3 — Manager PWA (`apps/app`)
- `/apps/app/app/(app)/requests/page.tsx` + row/list components: pending inbox with badge, phone `tel:`/`wa.me/` actions, assign-staff dropdown, approve/reject, and history tabs.
- Sidebar nav entry gated by `manage_appointments` (hidden for staff role).
- Extend `/apps/app/app/(app)/settings/page.tsx` with a "Public page" tab (enable toggle, logo/banner/bio, accent color, service visibility & order, copy-link button).

### Phase 4 — Public web (`apps/web`)
- `/apps/web/app/salons/[slug]/page.tsx` — salon header + service list.
- `/apps/web/app/salons/[slug]/book/[serviceId]/page.tsx` — date picker (today + 30 days) + slot grid + customer form. No staff picker.
- `/apps/web/app/salons/[slug]/requests/[token]/page.tsx` — status page with cancel button for `pending`.
- RTL/Persian, accent color via CSS variable from `publicSettings`.

### Phase 5 — Verification pass
- Walk through every item in §Verification below (schema migration, public API smoke, stacked requests, approval round-trip, customer self-cancel, staff invisibility, snapshot binding, expiry CLI, rate limit, dual API surface, end-to-end manual, `pnpm -w typecheck && pnpm -w test`).

## Critical files

**Modify**
- `/packages/database/src/schema.ts` — add 3 tables + enums (`appointment_request_status`, `appointment_request_payment_status`)
- `/packages/database/src/` — new modules `public.ts`, `appointment-requests.ts`, `rate-limit.ts`
- `/packages/salon-core/src/forms/` — add `publicAppointmentRequestSchema`, `publicSettingsSchema`
- `/apps/api/src/app.ts` — mount `/public` (no auth) and `/appointment-requests` (auth)
- `/apps/api/package.json` — add `expire-requests` script + CLI entry
- `/apps/app/next.config.mjs` — add `'public'`, `'appointment-requests'` to `HONO_DOMAINS`
- `/apps/app/app/(app)/settings/page.tsx` — add "Public page" tab
- `/apps/app/app/(app)/layout.tsx` (or wherever the sidebar lives) — add "Requests" link

**Create**
- `/apps/api/src/routes/public.ts`
- `/apps/api/src/routes/appointment-requests.ts`
- `/apps/api/src/cli/expire-requests.ts`
- `/apps/app/app/api/public/**/route.ts` — thin Next wrappers, no tests
- `/apps/app/app/api/appointment-requests/**/route.ts` — thin Next wrappers, no tests
- `/apps/app/app/(app)/requests/page.tsx` + components
- `/apps/web/app/salons/[slug]/page.tsx`
- `/apps/web/app/salons/[slug]/book/[serviceId]/page.tsx`
- `/apps/web/app/salons/[slug]/requests/[token]/page.tsx`
- New Drizzle migration in `/packages/database/drizzle/`

## Verification

1. **Schema**: `pnpm --filter @repo/database db:generate` then `db:migrate` against local Postgres; confirm 3 tables + enums created.
2. **Public API smoke**: `GET /api/v1/public/salons/<slug>` returns 200 with `services` but no `staff`; `GET …/availability?serviceId=…&date=…` returns slots and rejects dates outside the 30-day window with 400; `POST …/appointment-requests` inserts a `pending` row with `staffId=null`.
3. **Stacked requests allowed**: submit two requests for the same slot — both land as `pending` (no 409 at submit).
4. **Approval round-trip**: from the inbox, approve one of the two with `{ staffId }` → row appears in `appointments` using the request's snapshot values; slot disappears from public availability. Approving the second now returns 409; manager rejects.
5. **Customer self-cancel**: from the status URL, cancel a `pending` request → status flips to `cancelled`; cancelling again returns 409.
6. **Staff invisibility**: log in as staff in `apps/app`; confirm "Requests" nav is hidden and no `AppointmentRequest`s surface on the calendar/today views.
7. **Snapshot binding**: edit a `ServiceVariant`'s price after a `pending` request exists; approve → the resulting `Appointment` carries the original price, not the new one.
8. **Expiry**: insert a `pending` request with `requestedDate = yesterday`; run `pnpm --filter @repo/api expire-requests` → row flips to `expired`; customer status URL shows the expired copy.
9. **Rate limit**: POST 6 times from the same IP within 10 min → 6th returns 429.
10. **Dual API surface (transitional)**: with `USE_HONO_API=1`, hit each endpoint via `apps/app`'s `/api/...` path and confirm the rewrite routes to Hono.
11. **End-to-end manual**: enable public page in settings, copy URL, open in private window, browse services, pick slot within 30 days, submit as fake customer, see inbox badge increment, approve from manager view, see appointment on calendar.
12. **Type-check & tests**: `pnpm -w typecheck` and `pnpm -w test` green. Hono routes have tests; Next handlers do not.
