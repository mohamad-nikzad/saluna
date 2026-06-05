# Onboarding Redesign Plan

Phased, subagent-friendly implementation plan for the new signup + onboarding flow agreed on in the grilling session of 2026-06-01.

The conversation, glossary, and design decisions are captured in `CONTEXT.md` (terms under "Signup & Onboarding") and `docs/adr/0004-salon-level-working-days.md`. Read those first.

---

## Decisions recap (canonical — see `CONTEXT.md` for full definitions)

1. Signup stays a separate atomic POST; one screen, conversational voice, slug collapsed under a "تغییر" affordance.
2. Onboarding becomes a route-per-step wizard under `apps/pwa/src/routes/_authed/onboarding/`.
3. Required steps: `servicesAdded`, `staffAdded`. Everything else optional.
4. Step order: post-signup Welcome → `businessHoursSet` → `servicesAdded` → `staffAdded` → `presenceSet` → `publicPageConfigured` → `notificationsConfigured` → Done.
5. Drop `profileConfirmed` and `firstAppointmentCreated` from `OnboardingStatus.steps`.
6. Presence stored as **typed nullable columns** on `salon_profile` (no JSONB).
7. New salon-level `working_days` mask on `business_settings`, default Sat–Thu. Salon-level wins over per-staff schedules (see ADR-0004).
8. Public-page step writes `salon_public_settings.enabled = true` + `bioText`; theme/layout left to `/public-page` settings.
9. Notifications step links Telegram only; SMS is not surfaced.
10. Public page Persian display = the single `salonName` (no separate `publicTitle`).

---

## Design assets (read-only reference)

Source-of-truth prototype lives at `/Users/mohamad/Downloads/onboarding`:

- `Saloora Onboarding (standalone-offline).html` — open in a browser to view all 7 screens (light + dark). Single self-contained file.
- `Onboarding Flows.html` — CDN-backed version, requires internet.
- `saloora/onboarding-b.jsx` — Prototype B screen components (`B_Welcome`, `B_Name`, `B_Hours`, `B_Services`, `B_Presence`, `B_Staff`, `B_Done`). Subagents implementing UI should match the look (warm Persian copy, one focal control, thin progress bar, big plum hero on welcome/done).
- `saloora/onboarding-kit.jsx` — shared wizard primitives (`PillCTA`, `OnbInputFocus`, `ThinProgress`, `DayPills`, `TimeBox`, `CategoryTile`, `Avatar`, `ColorDots`, `Petals`, `BrandMark`).
- `saloora/shell.jsx` — `OnbShell` mobile shell + UI primitives.
- `saloora/data.jsx` — Persian number helpers + mock data (`SALON`, `ONB_PRESETS`).
- `saloora/icons.jsx` — stroke icon set.
- `brand/saloora-mark-clean.png` — cherry-blossom mark.
- `design-canvas.jsx` — pan/zoom canvas (not relevant to implementation).

**Important:** the prototype uses the "Saloora" brand and `saloora.app` domain. The live product is "Aravira" on `aravira.app`. Use the existing brand tokens in `packages/brand-tokens/` and the existing `SalooraMark` (or whatever the current logo component is — verify before copying). The conversational voice and layout are the part to port; the brand surface stays as-is.

---

## Existing code touchpoints (read before editing)

Backend:
- `packages/database/src/schema.ts` — `salonProfile` (lines ~146), `businessSettings` (~600), `salonOnboarding` (~614), `salonPublicSettings` (~700). Where new columns land.
- `packages/database/src/internal/onboarding-queries.ts` — `getOnboardingStatus` + `updateOnboardingState`. Where step derivation logic changes.
- `packages/database/src/onboarding.ts` — re-export barrel; update types after queries change.
- `apps/api/src/routes/onboarding.ts` + `onboarding.test.ts` — API surface.
- `packages/api-client/src/onboarding.ts` — typed client.
- `packages/auth/src/signup.ts` — atomic salon-creation; **no payload changes**.
- `packages/salon-core/src/forms/auth.ts` — `signupSchema` (untouched).
- `packages/salon-core/src/forms/settings.ts` — `businessSettingsSchema` (extend with `workingDays`).

Frontend (live target — `apps/pwa`):
- `apps/pwa/src/routes/signup.tsx` — current 240-line signup (redesign in place).
- `apps/pwa/src/routes/_authed/onboarding.tsx` — current 1074-line single-route. **Delete after migration.**
- `apps/pwa/src/routes/_authed/public-page.tsx` — surfaces `salon_public_settings` for full editing; onboarding step links here for "customize later".
- `apps/pwa/src/routes/_authed/settings.tsx` — surfaces business settings / presence post-onboarding.

Deprecated (do not touch):
- `retired manager app/**` — Next.js app, deprecated. Mirror changes are not needed.

---

## Phase 0 — Documentation & alignment (DONE)

Already complete in this session:
- `CONTEXT.md` updated with `Signup`, `Onboarding`, `Required Onboarding Step`, `Optional Onboarding Step`, `Top-Level Skip`, `Salon Presence`, `Salon Working Days`, `Salon Name`, `Public Page Onboarding Step`, `Notifications Onboarding Step`, `Onboarding Steps (Order)`, `Onboarding Route Tree`.
- `docs/adr/0004-salon-level-working-days.md` written.

No subagent work required; reference only.

---

## Phase 1 — Database schema migration

**Goal:** all new columns exist, defaults are sane, existing data isn't broken.

**Files to change:**
- `packages/database/src/schema.ts`
- `packages/database/drizzle/` (new migration via `drizzle-kit generate`)

**Tasks:**
1. Add to `salonProfile`:
   - `mapGoogle text` (nullable)
   - `mapNeshan text` (nullable)
   - `mapBalad text` (nullable)
   - `socialInstagram text` (nullable)
   - `socialTelegram text` (nullable)
   - `socialWhatsapp text` (nullable) — phone-shaped, validated at API boundary
   - `website text` (nullable)
2. Add to `businessSettings`:
   - `workingDays smallint not null default 126` (bitmask, Sat–Thu open / Friday closed; Iran-typical). Bit 0 = Saturday, bit 6 = Friday. (`126 = 0b1111110`.)
3. Generate and review the Drizzle migration. Backfill is a no-op — all new columns either nullable or have a default.
4. Run the migration locally; verify `\d salon_profile` + `\d business_settings`.

**Verification:**
- Existing tests in `packages/database/` and `apps/api/` still pass.
- New columns appear in `select *` against both tables.

**Subagent prompt skeleton:**
> Add the columns listed in Phase 1 of `ONBOARDING_REDESIGN_PLAN.md` to `packages/database/src/schema.ts`. Generate a Drizzle migration. Do not change any backend logic in this phase. Verify existing tests still pass.

---

## Phase 2 — Onboarding status & API rewrite

**Goal:** `OnboardingStatus` reflects the new step set; `/api/onboarding` PATCH actions cover the new top-level skip; old `confirm-profile` action removed.

**Files to change:**
- `packages/database/src/internal/onboarding-queries.ts`
- `packages/database/src/onboarding.ts` (re-export)
- `apps/api/src/routes/onboarding.ts`
- `apps/api/src/routes/onboarding.test.ts`
- `packages/api-client/src/onboarding.ts`

**Tasks:**
1. Update `OnboardingStatus.steps` shape:
   - Remove: `profileConfirmed`, `firstAppointmentCreated`.
   - Add: `presenceSet`, `publicPageConfigured`, `notificationsConfigured`.
   - Keep: `businessHoursSet`, `servicesAdded`, `staffAdded`.
2. Derive each step (no new `salon_onboarding` columns needed for step bookkeeping):
   - `businessHoursSet` = `business_settings.working_days != default OR (working_start, working_end) != defaults` (or just keep current "row exists" if you prefer simpler semantics — manager pressing save = done).
   - `presenceSet` = at least one of address / map* / social* / website is not null on `salon_profile`.
   - `publicPageConfigured` = `salon_public_settings.enabled = true`.
   - `notificationsConfigured` = exists a `messaging_link` (or whatever the Phase 1.5 Telegram link table is — verify with `grep -rn "telegram" packages/database/src/schema.ts`) where `user_id = manager AND organization_id = salon`.
3. `OnboardingAction`:
   - Remove `'confirm-profile'`.
   - Keep `'complete' | 'skip' | 'reopen'`.
   - `'skip'` is gated server-side: only allowed if `servicesAdded && staffAdded`.
4. Drop `profile_confirmed_at` from `salon_onboarding` table — or leave it as a dead column (cheaper). Recommend leaving it; remove the read in queries only.
5. Rewrite `onboarding.test.ts` to cover the new shape.
6. Update `packages/api-client/src/onboarding.ts` types so the PWA imports the new shape.

**Verification:**
- `apps/api`'s test suite green.
- Hand-roll a `curl GET /api/onboarding` against a freshly seeded salon → returns the new shape.

**Subagent prompt skeleton:**
> Refactor onboarding status per Phase 2 of `ONBOARDING_REDESIGN_PLAN.md`. The schema additions from Phase 1 are already in place. Do not change frontend code. Land new tests in `apps/api/src/routes/onboarding.test.ts`.

---

## Phase 3 — Shared form schemas

**Goal:** Zod schemas for the new step payloads exist in `@repo/salon-core/forms/`, validated identically on client and server.

**Files to change:**
- `packages/salon-core/src/forms/settings.ts` — extend `businessSettingsSchema` with `workingDays: z.number().int().min(0).max(127)`.
- `packages/salon-core/src/forms/presence.ts` — **new file**. `presenceSchema`: optional URL/handle fields. Instagram accepts `@handle` or URL; Telegram same; WhatsApp accepts Iran phone shape (`09XXXXXXXXX` via existing `phoneSchema` from `salon-core/phone`); maps are HTTPS URLs from known domains (`maps.app.goo.gl`, `neshan.org`, `balad.ir`); website is HTTPS URL.
- `packages/salon-core/src/forms/public-page.ts` — **new file** (or extend existing). `publicPageOnboardingSchema`: `{ enabled: boolean, bioText: z.string().max(280).optional() }`.

**Tasks:**
1. Write the three schemas with Persian error messages via the existing `formMessages` pattern.
2. Export from package barrel.
3. Add a `phone-format-whatsapp.ts` helper if WhatsApp normalisation is non-trivial; otherwise reuse `salon-core/phone`.

**Verification:**
- Unit tests in `packages/salon-core/src/forms/__tests__/`.

**Subagent prompt skeleton:**
> Add the form schemas described in Phase 3 of `ONBOARDING_REDESIGN_PLAN.md`. Match the style of the existing `auth.ts`, `staff.ts`, `service.ts`, `settings.ts` schemas. Land unit tests.

---

## Phase 4 — Backend writes for new fields

**Goal:** API endpoints that the new onboarding steps PATCH actually accept and persist the new fields.

**Files to change:**
- `apps/api/src/routes/settings.ts` (or wherever `PATCH /api/settings/business` lives) — accept `workingDays`.
- `apps/api/src/routes/salon-profile.ts` (or create if missing) — `PATCH /api/salon-profile/presence` accepting the presence payload.
- `apps/api/src/routes/salon-public-settings.ts` — `PATCH /api/salon-public-settings` already exists per `retired Next API routes/salon-public-settings` — verify it's in `apps/api` too; if not, port. Accept `{ enabled, bioText }` partial.
- Telegram-link route — check `apps/api/src/routes/` for existing messaging routes; surface a `GET /api/messaging/telegram/deep-link` if not present (so the onboarding step can hand the manager a `t.me/...?start=` URL).

**Tasks:**
1. Wire each schema from Phase 3 to its corresponding handler.
2. Add API tests for each new write path.
3. Ensure RBAC: only manager role can write these.

**Verification:**
- API tests green.
- Manual curl: write each new field, read back via `GET /api/onboarding` and see the corresponding step flip to `true`.

**Subagent prompt skeleton:**
> Implement Phase 4 of `ONBOARDING_REDESIGN_PLAN.md`. Phases 1–3 are done. Add the API write paths, wire to the new schemas, land tests. Do not touch frontend code.

---

## Phase 5 — Signup screen redesign

**Goal:** `apps/pwa/src/routes/signup.tsx` adopts the prototype's conversational voice in a one-screen layout, with slug collapsed under a "تغییر" toggle.

**Files to change:**
- `apps/pwa/src/routes/signup.tsx`

**Tasks:**
1. Lift the visual language from `/Users/mohamad/Downloads/onboarding/saloora/onboarding-b.jsx` (`B_Name` screen) — eyebrow tag ("بیایید آشنا شویم"), big question header, soft pink background, plum mark.
2. Keep all five fields in one submit — but visually group:
   - Salon name (big focal input).
   - Manager name + phone (paired).
   - Password.
   - URL preview line ("لینک شما: aravira.app/rose-salon") with "تغییر" link; expanding reveals the slug input.
3. The form payload and the POST to `/api/auth/signup` are unchanged.
4. After success, redirect to `/onboarding` (which will land on the Welcome screen — Phase 6).

**Verification:**
- Manual flow: sign up → land at `/onboarding` (Welcome screen once Phase 6 is done; until then the existing single-route still loads).
- Existing Playwright e2e for signup still passes (or updated cautiously if selectors changed).

**Subagent prompt skeleton:**
> Redesign `apps/pwa/src/routes/signup.tsx` per Phase 5 of `ONBOARDING_REDESIGN_PLAN.md`. Reference `/Users/mohamad/Downloads/onboarding/saloora/onboarding-b.jsx` for the visual language (the `B_Name` screen and the shell). Form fields and POST payload stay the same. Slug field collapses under a "تغییر" toggle.

---

## Phase 6 — Onboarding shell: route-per-step skeleton

**Goal:** the route tree exists, the layout reads status and routes the manager to the right place, but step screens are stubs.

**Files to create:**
- `apps/pwa/src/routes/_authed/onboarding/route.tsx` — layout. Reads `/api/onboarding` via the existing TanStack Query setup, exposes status through a context, renders the shared header / progress bar.
- `apps/pwa/src/routes/_authed/onboarding/index.tsx` — `beforeLoad` reads status and `redirect()`s to the first incomplete step (or `/calendar` if completed/skipped). Renders nothing on its own.
- `apps/pwa/src/routes/_authed/onboarding/welcome.tsx` — stub.
- `apps/pwa/src/routes/_authed/onboarding/hours.tsx` — stub.
- `apps/pwa/src/routes/_authed/onboarding/services.tsx` — stub.
- `apps/pwa/src/routes/_authed/onboarding/staff.tsx` — stub.
- `apps/pwa/src/routes/_authed/onboarding/presence.tsx` — stub.
- `apps/pwa/src/routes/_authed/onboarding/public-page.tsx` — stub (route name will conflict with the existing `_authed/public-page.tsx`; rename one — prefer the onboarding child to be `public.tsx` to avoid the clash).
- `apps/pwa/src/routes/_authed/onboarding/notifications.tsx` — stub.
- `apps/pwa/src/routes/_authed/onboarding/done.tsx` — stub.

**Files to delete (after this phase verifies):**
- `apps/pwa/src/routes/_authed/onboarding.tsx` — old single-route.

**Tasks:**
1. Create the layout with `beforeLoad`: redirect rules:
   - Not signed in → `/login`.
   - `completedAt || skippedAt` set → `/calendar`.
   - First step not done in the order Welcome → hours → services → staff → presence → public → notifications → done → redirect to that one.
2. Each step file: `createFileRoute` with `beforeLoad` checking prerequisites (e.g., staff requires services first).
3. Shared header (back arrow, thin progress, brand mark) lifted from `OnbShell` in the prototype.
4. Each stub renders the eyebrow + question + a "ادامه" PillCTA that calls `mutate` + navigates to the next step.

**Verification:**
- Cold-start a fresh salon → `/onboarding` redirects to `/onboarding/welcome`.
- Hit "ادامه" through all stubs → ends at `/calendar`.
- Refresh on `/onboarding/staff` → stays on `/onboarding/staff`.
- Browser back works.

**Subagent prompt skeleton:**
> Build the route-per-step skeleton in Phase 6 of `ONBOARDING_REDESIGN_PLAN.md`. Reference `/Users/mohamad/Downloads/onboarding/saloora/onboarding-kit.jsx` and `shell.jsx` for the shared shell primitives (thin progress, eyebrow, big question, pill CTA). Each step is a stub that just navigates to the next one. Phase 2's `OnboardingStatus` shape is already in place. Do NOT delete the old `onboarding.tsx` yet — that happens after Phase 7.

---

## Phase 7 — Each step screen, in order

Each subphase is one screen. Each subphase can be its own subagent run. All reference the same prototype source for visual fidelity.

### 7a · Welcome screen (`welcome.tsx`)

Plum-hero post-signup screen. Mirror `B_Welcome` from `onboarding-b.jsx`: cherry petals background, brand mark, "سلام 👋" headline, "بیایید با هم سالن‌تان را راه بیندازیم" subhead, "بزن بریم" PillCTA → `/onboarding/hours`. No form. No tracked step.

### 7b · Hours screen (`hours.tsx`)

Mirror `B_Hours`. Day-of-week pills (Sat–Fri) + start/end TimePicker + slot-duration row. PATCHes `/api/settings/business` with `{ workingStart, workingEnd, slotDurationMinutes, workingDays }`. Defaults pre-filled. "ادامه" → `/onboarding/services`. Empty/unchanged submit also advances (= optional step, defaults persisted).

### 7c · Services screen (`services.tsx`)

Mirror `B_Services` (big category tiles, multi-select) + the existing `CatalogPresetPicker` from `apps/pwa/src/components/`. Tiles are visual shortcuts; tapping applies the preset via the existing `/api/catalog-presets/:id/pwaly` route. Required step — cannot advance until at least one service exists. "ادامه" → `/onboarding/staff`.

### 7d · Staff screen (`staff.tsx`)

Mirror `B_Staff`. Name + phone + colour. Optional password (auto-generate if blank? — verify with existing `staffCreateSchema`). Required step. Two paths:
- Submit → POST `/api/staff` → "ادامه" → `/onboarding/presence`.
- "فعلاً فقط خودم هستم" link → marks the salon-owner manager as the first "staff" (creates a `salonMember` row pointing to the manager user, or sets a `manager_is_staff = true` flag — check existing schema before deciding). → `/onboarding/presence`.

### 7e · Presence screen (`presence.tsx`)

Mirror `B_Presence`. Compact stacked `LinkRow` list: address (textarea, RTL), map providers (3 rows), socials (4 rows). Each row expands inline to a single-field editor. PATCH `/api/salon-profile/presence` with the partial. "فعلاً رد کن" advances without saving; "ذخیره و ادامه" saves then advances. Optional. → `/onboarding/public`.

### 7f · Public-page screen (`public.tsx`)

Single `enabled` toggle on top, `bioText` textarea below (placeholder: "یک خط کوتاه درباره سالن‌تان"). Hint at the bottom: "می‌توانید بعداً تم، چیدمان و خدمات قابل نمایش را در «صفحه عمومی» سفارشی کنید." PATCH `/api/salon-public-settings`. Optional. → `/onboarding/notifications`.

### 7g · Notifications screen (`notifications.tsx`)

Single CTA: "اتصال به ربات تلگرام برای دریافت نوبت‌ها". Opens `t.me/<bot>?start=<linkToken>` (token from `GET /api/messaging/telegram/deep-link`). On return / next render, derived `notificationsConfigured` flips on. Optional — secondary "بعداً" link advances without action. → `/onboarding/done`.

### 7h · Done screen (`done.tsx`)

Mirror `B_Done`. Plum hero, big check, "تمام شد! 🌸" headline, "«{salonName}» آماده‌ی پذیرش است." copy, public URL row with copy button (`aravira.app/<slug>`), "بزن بریم سراغ اولین نوبت" PillCTA → `PATCH /api/onboarding { action: 'complete' }` → `/calendar`. No tracked step.

**After 7h is verified:** delete `apps/pwa/src/routes/_authed/onboarding.tsx`.

**Verification (end of Phase 7):**
- New salon: signup → all 8 screens reachable → calendar.
- Refresh at any step → stays there.
- Back button → previous step.
- Skip from optional step → next step, status reflects un-set.
- `appLocked` semantics: visiting `/calendar` mid-flow before services+staff redirects back to onboarding.

**Subagent prompt skeleton (one per subphase):**
> Implement Phase 7{x} of `ONBOARDING_REDESIGN_PLAN.md`. Reference the matching `B_*` component in `/Users/mohamad/Downloads/onboarding/saloora/onboarding-b.jsx` for visual language. Shared shell primitives are already in place from Phase 6. API endpoints from Phase 4 are wired.

---

## Phase 8 — E2E & cleanup

**Goal:** the flow is covered end-to-end and there's no dead code.

**Tasks:**
1. Update / add Playwright e2e in `e2e/` covering: signup → welcome → hours → services (preset) → staff (manager-only) → skip presence → skip public → skip notifications → done → calendar.
2. Update / add Playwright e2e for required-step-block: visit `/calendar` after signup, expect redirect into `/onboarding/services`.
3. Delete `apps/pwa/src/routes/_authed/onboarding.tsx` if not already gone.
4. Remove `'confirm-profile'` references everywhere (grep across repo).
5. Grep for `profileConfirmed` and `firstAppointmentCreated` — both should be gone from runtime code (DB column `profile_confirmed_at` can stay as a dead column).
6. Update `CONTEXT.md`'s "Onboarding Steps (Order)" entry if any ordering shifted during implementation.

**Verification:**
- `pnpm test` green across the monorepo.
- Playwright suite green.
- `pnpm build` for `apps/pwa` succeeds.

**Subagent prompt skeleton:**
> Complete Phase 8 of `ONBOARDING_REDESIGN_PLAN.md`. Land the e2e specs, delete dead code per the grep list, run the full test suite.

---

## Out of scope (deliberately)

- SMS notifications (channel doesn't exist yet).
- Per-event notification toggles, quiet hours.
- Theme / layout pickers in onboarding (live preview required → settings-only).
- A separate `publicTitle` field on the salon (single `salonName` does both roles).
- Migrating `retired manager app/**` (deprecated Next.js app) to match — not maintained.
- Public-page brand domain switch (`saloora.app` in prototype → `aravira.app` in production); the prototype is a visual reference, not a brand cutover.

---

## Open implementation questions to resolve before Phase 7

- **Manager-as-staff representation.** Phase 7d's "فعلاً فقط خودم هستم" path needs a decision: does the salon owner appear as a `salonMember` row with `role='manager'` *and* `active=true` so the calendar can assign appointments to them, or does the schema need a `manager_is_bookable` flag? Verify against `salon_member` shape (`packages/database/src/schema.ts:157`) and existing calendar staff-list queries before implementing 7d. If unclear, raise with the user.
- **Telegram link token table name.** Phase 4 + 7g reference `GET /api/messaging/telegram/deep-link` — check `apps/api/src/routes/messaging*` and `packages/database/src/messaging.ts` for the existing Phase 1.5 implementation; the route may already exist under a different name.
