# BL-0004 Phone OTP Auth Implementation Plan

## Summary

Build phone-first auth with Better Auth's `phoneNumber` plugin, while keeping
password login as the default low-cost sign-in path. Signup becomes: phone OTP
-> authenticated minimal user -> required password/name step -> salon-name step
creates workspace -> existing onboarding continues.

This ticket is also the compatibility bridge from the current
`username-as-phone` model to Better Auth's `phoneNumber` model. During rollout,
writes must keep both fields in sync and reads must prefer `phoneNumber` with a
`username` fallback until all clients and prod data are verified.

Decisions locked:

- OTP length: `6` digits.
- Dev/test bypass: `AUTH_OTP_BYPASS_ENABLED=true` disables real SMS and accepts
  `AUTH_OTP_BYPASS_CODE`, default `123456`.
- Scope: PWA/API only; native is deprecated and out of scope for this ticket.
  Do not change native code, add native compatibility wrappers, or spend test
  effort on native auth in this plan.
- Production safety: existing prod/test salons must keep working throughout
  rollout.
- Staff policy: manager-created staff accounts are treated as
  manager-attested phone numbers for this ticket, so their `phoneNumberVerified`
  value is `true` when the manager creates or changes the staff phone. A
  self-service staff invite/OTP verification flow is a separate ticket.

References:

- Better Auth phone plugin: https://better-auth.com/docs/plugins/phone-number
- Better Auth users/accounts: https://better-auth.com/docs/concepts/users-accounts
- shadcn Input OTP: https://ui.shadcn.com/docs/components/radix/input-otp
- sms.ir REST API docs: https://sms.ir/rest-api/

## Key Changes

- Add Better Auth `phoneNumber` plugin:
  - `otpLength: 6`, `expiresIn: 300`, `allowedAttempts: 3`.
  - Real mode sends through `sendSmsOtp`.
  - Bypass mode skips SMS and verifies only the configured bypass code.
  - Configure `signUpOnVerification` with `getTempEmail(phoneNumber)` and a
    temporary name so OTP signup can create the minimal pre-workspace user.
  - Keep `emailAndPassword.enabled` because phone + password login still relies
    on Better Auth credential accounts.
  - Use Better Auth `sign-in/phone-number` for the new PWA password login.
  - Keep placeholder email internally; phone becomes the user-facing identity.
  - Keep the username plugin and `/sign-in/username` endpoint during rollout for
    web rollback compatibility and existing production data only.
  - Do not hand-roll password hashes. Any new or changed credential password
    must be created through Better Auth APIs or a single Better Auth-configured
    password hasher/verifier shared by all credential writes.

- Add schema/migration support:
  - Add `user.phone_number` and `user.phone_number_verified`.
  - Backfill existing prod users from valid `user.username` phone values and set
    `phone_number_verified=true` for existing loginable users because their
    phone is already the production username.
  - Keep `username` fields/plugin during this ticket for compatibility.
  - Update all legacy user shape readers to prefer `user.phone_number` and fall
    back to `user.username` until the compatibility path is removed.
  - Staff create/update, legacy signup, seed scripts, and test fixtures must
    populate both `username/displayUsername` and
    `phone_number/phone_number_verified`.

- SMS/template setup:
  - Production sms.ir requires an approved Verify template/pattern in the panel.
  - Configure `SMS_IR_OTP_TEMPLATE_ID`, plus optional purpose-specific IDs.
  - Recommended OTP template should include the code placeholder and, if sms.ir
    allows, WebOTP-friendly domain text for autofill.
  - Sandbox can use sms.ir template id `123456`; bypass mode needs no sms.ir
    template.

- Replace PWA auth UX:
  - Login defaults to phone + password via Better Auth phone-number sign-in.
  - Add secondary "ورود با کد پیامکی".
  - Signup becomes phone OTP first.
  - OTP UI uses existing `@repo/ui/input-otp`: 6 slots, digit-only,
    `autocomplete="one-time-code"`, `inputMode="numeric"`, `dir="ltr"`,
    paste/autofill support, mobile-first touch sizing.
  - Add resend countdown: 60 seconds client cooldown; server also rate-limits
    OTP sends.

- Update auth state:
  - `/api/v1/auth/me` must not use `requireTenant()` directly. It first reads
    the Better Auth session, then tries to resolve a salon membership.
  - `/api/v1/auth/me` returns either `needs_workspace` or `ready`.
  - `needs_workspace`: verified user has no salon membership.
  - `ready`: current tenant user shape plus onboarding flags.
  - Unauthenticated users still receive `401`.
  - PWA route guards route `needs_workspace` users into pre-workspace onboarding.

- Add pre-workspace onboarding:
  - Account step collects manager name and required password using Better Auth
    server `setPassword`.
  - Workspace step collects salon name and creates organization, owner
    membership, `salon_profile`, `salon_member`, default `business_settings`,
    and onboarding row.
  - Workspace creation must be idempotent for a session that already has a
    membership: return the existing workspace state instead of creating a second
    organization.
  - Existing tenant-protected onboarding continues after workspace creation.

- Update staff auth compatibility:
  - `POST /api/v1/staff` continues to create login-capable staff accounts.
    Create the Better Auth user with placeholder email, credential password,
    `username`, `displayUsername`, `phoneNumber`, and
    `phoneNumberVerified=true`, then add the salon membership and
    `salon_member` sidecar.
  - `PATCH /api/v1/staff/:id` keeps `username/displayUsername`,
    placeholder email, `phoneNumber`, and `phoneNumberVerified=true` in sync
    when a manager changes a staff phone.
  - `PATCH /api/v1/staff/:id/password` must stop writing a local password hash
    directly unless the app configures Better Auth to use exactly that shared
    hasher. Prefer a server-side Better Auth password-setting helper for the
    target user or a small internal credential writer built from Better Auth's
    configured password hash function.
  - Staff login must work through both the old username/password endpoint during
    rollout and the new phone-number/password endpoint after backfill.
  - Deactivated staff remain unable to access tenant routes because membership
    resolution continues to exclude inactive `salon_member` rows.

## Phased Rollout

1. **Database First**
   - [x] Deploy additive phone columns and backfill existing users.
   - [x] Add temporary read fallbacks so `phoneNumber ?? username` is the displayed
         and tenant phone everywhere.
   - [ ] Verify prod/test salon users still log in with current password flow.

2. **Auth Foundation**
   - [x] Add phone plugin, `signUpOnVerification`, bypass envs, sms.ir send hook,
         phone validation, OTP expiry, and allowed-attempt limits.
   - [x] Add/verify server rate limits for OTP send requests before broad UI
         rollout.
   - [x] Keep old username/password endpoint operational during transition.
   - [x] Add a single credential password-writing strategy; remove or replace local
         ad-hoc password hashing for staff password updates.

3. **API State + Workspace**
   - [x] Rework `/me` to resolve Better Auth session first, then optional
         membership, so `needs_workspace` can be returned.
   - [x] Add session-only account/password and workspace creation endpoints.

4. **Staff + Legacy Compatibility**
   - [x] Update staff create/update/password flows to sync phone fields and keep
         staff loginable.
   - [x] Update legacy signup, seed scripts, tests, row mappers, tenant context, and
         generated API/OpenAPI contracts as needed.
   - [x] Do not update native callers; native is deprecated and excluded from this
         rollout.

5. **PWA UI**
   - [x] Add phone/password default login via Better Auth phone-number sign-in.
   - [x] Add phone-first OTP signup.
   - [x] Add secondary OTP-only login for existing users.
   - [x] Add OTP resend timer and mobile-first OTP screen.
   - [x] Route `needs_workspace` users through the pre-workspace signup flow.

6. **Compatibility Pass**
   - [x] Update e2e/helper coverage to prefer phone-number password login.
   - [x] Confirm rollback path: existing username/password login still works.

7. **Production Enablement**
   - [ ] Create/approve sms.ir OTP template.
   - [ ] Set production `SMS_IR_OTP_TEMPLATE_ID`.
   - [ ] Smoke test existing prod/test salons before enabling OTP UI broadly.

## Progress Log

### 2026-06-15 backend compatibility slice

Completed:

- Added `user.phone_number` and `user.phone_number_verified` to the Drizzle
  schema.
- Added migration `0007_phone_number_auth_columns.sql`:
  - Adds the two phone-number columns.
  - Backfills `phone_number` from valid legacy `username` values matching
    `^09[0-9]{9}$`.
  - Marks those backfilled phone numbers verified.
  - Adds a unique index on `phone_number`.
- Updated legacy user row mapping and tenant member lookup to read
  `phoneNumber ?? username`.
- Updated legacy signup, staff creation, staff phone updates, and seed helpers
  to keep `username`, `displayUsername`, `phoneNumber`, and
  `phoneNumberVerified` in sync.
- Left existing username/password auth paths operational. No PWA or native auth
  UX was changed in this slice.

Verified locally:

- `pnpm --filter @repo/database typecheck`
- `pnpm --filter @repo/auth typecheck`
- `pnpm --filter @repo/api typecheck`
- `pnpm --filter @repo/api test -- auth.test.ts staff.test.ts`

Remaining notes for the next agent:

- Superseded by later slices: the Better Auth `phoneNumber` plugin is now
  configured, and OTP send rate limiting has been added.
- Superseded by later slices: `/api/v1/auth/me` now returns `needs_workspace`
  for authenticated users without a salon membership.
- OpenAPI/generated API contracts were not regenerated because this slice did
  not change external API response shapes.

### 2026-06-15 Better Auth phone OTP foundation slice

Completed:

- Added the Better Auth `phoneNumber` plugin to `packages/auth/src/server.ts`
  while keeping the existing `username` plugin and username/password paths.
- Configured OTP settings from the plan:
  - `otpLength: 6`
  - `expiresIn: 300`
  - `allowedAttempts: 3`
- Added `packages/auth/src/phone-otp.ts` for:
  - Iranian mobile normalization/validation.
  - temporary OTP-created user email/name generation.
  - `AUTH_OTP_BYPASS_ENABLED` and `AUTH_OTP_BYPASS_CODE` parsing, defaulting to
    `123456`.
  - bypass mode that skips SMS and accepts only the configured bypass code.
  - real mode that sends through the existing `sendSmsOtp` sms.ir delivery
    path with purpose `signup`.
- Added API env parsing for `AUTH_OTP_BYPASS_ENABLED` and
  `AUTH_OTP_BYPASS_CODE`.
- Added workspace/package TypeScript resolution and lockfile metadata for
  `@repo/auth` -> `@repo/notifications`.

Verified locally:

- `pnpm --filter @repo/auth test -- phone-otp.test.ts`
- `pnpm --filter @repo/auth typecheck`
- `pnpm --filter @repo/api test -- env.test.ts src/cli/messaging-set-webhook.test.ts`
- `pnpm --filter @repo/api typecheck`

### 2026-06-15 API `/me` pre-workspace state slice

Completed:

- Reworked `GET /api/v1/auth/me` so it reads the Better Auth session directly
  before attempting salon membership resolution.
- Added the authenticated pre-workspace response:
  - `status: "needs_workspace"`
  - minimal session user payload `{ id, name, phone }`
- Kept existing ready tenant users compatible by continuing to return the full
  legacy `user` shape, now with `status: "ready"`.
- Updated the legacy API client type for the new discriminated `/me` response.
- Kept current PWA auth behavior stable by treating `needs_workspace` as no
  tenant user until the pre-workspace route guard/onboarding UI slice is built.
- Added route tests for unauthenticated, `needs_workspace`, and `ready` `/me`
  states.

Verified locally:

- `pnpm --filter @repo/api test -- auth.test.ts`

### 2026-06-15 staff credential password strategy slice

Completed:

- Added `packages/database/src/auth-password.ts` as the single Better
  Auth-compatible credential password helper for this codebase.
- Configured Better Auth `emailAndPassword.password.hash/verify` to use that
  helper explicitly, so credential account writes and Better Auth sign-in verify
  share the same strategy.
- Updated `updateStaffPassword` to use the shared helper instead of its private
  local scrypt implementation.
- Exported the helper as `@repo/database/auth-password`.
- Added a focused unit test for hash format, successful verification, and failed
  verification.

Verified locally:

- `pnpm --filter @repo/database test -- auth-password.test.ts`
- `pnpm --filter @repo/database typecheck`
- `pnpm --filter @repo/auth typecheck`
- `pnpm --filter @repo/api test -- staff.test.ts`
- `pnpm --filter @repo/api typecheck`

### 2026-06-15 pre-workspace account/workspace API slice

Completed:

- Added shared `preWorkspaceAccountSchema` and `preWorkspaceSchema` validation
  in `@repo/salon-core/forms/auth`.
- Added `POST /api/v1/auth/signup/account` for OTP-created authenticated users:
  - Requires an active Better Auth session.
  - Sets the credential password through `auth.api.setPassword`.
  - Updates the temporary Better Auth user name to the real manager name.
  - Maps Better Auth password errors to localized API errors.
- Added `POST /api/v1/auth/signup/workspace` for authenticated users without a
  salon membership:
  - Creates the Better Auth organization with the chosen or generated slug.
  - Creates the salon sidecars: `salon_profile`, owner `salon_member`,
    `business_settings`, and `salon_onboarding`.
  - Is idempotent once the session already has a salon membership: returns the
    existing workspace state instead of creating a second organization.
- Added route tests for account setup, auth guarding, workspace creation, and
  existing-workspace idempotency.

Verified locally:

- `pnpm --filter @repo/api test -- auth.test.ts`
- `pnpm --filter @repo/api typecheck`
- `pnpm --filter @repo/salon-core typecheck`

Remaining notes for the next agent:

- PWA routes still need to call the OTP signup continuation endpoints and route
  `needs_workspace` users through pre-workspace onboarding.
- OpenAPI/generated API contracts were not regenerated in this slice because the
  current auth wrapper endpoints are not represented in the existing OpenAPI
  route set.

Additional remaining notes from the OTP foundation slice:

- Real OTP mode depends on the existing SMS delivery bootstrap and a configured
  sms.ir template. Bypass mode is the path for local/dev tests.
- The PWA login/signup screens still call the old flows; no UI work was done in
  this slice.

### 2026-06-15 OTP send rate-limit slice

Completed:

- Added explicit OTP send rate-limit constants in `@repo/auth/phone-otp`:
  - `AUTH_OTP_SEND_WINDOW_SECONDS = 60`
  - `AUTH_OTP_SEND_MAX_PER_WINDOW = 1`
- Enabled Better Auth rate limiting explicitly instead of relying on the
  production-only default.
- Added a Better Auth `customRules` entry for `/phone-number/send-otp` so OTP
  sends are limited to one request per 60 seconds per client/path, matching the
  PWA resend cooldown policy.
- Kept the phone-number plugin's broader `/phone-number/*` fallback rule in
  place for other phone-number endpoints.
- Added `packages/auth/src/server.test.ts` to verify the configured OTP send
  rate-limit rule.

Verified locally:

- `pnpm --filter @repo/auth test -- phone-otp.test.ts server.test.ts`
- `pnpm --filter @repo/auth typecheck`

Remaining notes for the next agent:

- Better Auth's memory rate limiter keys by client IP and path, not by phone
  number. This is acceptable as a server-edge cooldown for the PWA rollout, but
  a future abuse-hardening pass may want persistent or phone-keyed throttles if
  traffic patterns require it.
- The test emits Better Auth's expected warning about missing
  `BETTER_AUTH_URL` in the mocked unit-test environment.

### 2026-06-15 PWA phone-first signup slice

Completed:

- Updated the legacy PWA API client auth wrapper to call Better Auth's
  `/sign-in/phone-number` endpoint for phone/password login instead of the
  rollout-only username sign-in endpoint.
- Added client wrapper methods for:
  - sending phone OTPs,
  - verifying phone OTPs,
  - completing the pre-workspace account/password step,
  - creating the signup workspace.
- Updated the shared API client error parsing so Better Auth `{ message }`
  responses surface in PWA forms.
- Changed PWA auth state from `User | null` to the `/me` discriminated session
  shape while preserving the existing `user` convenience value for the rest of
  the app.
- Updated root/login/authed route guards so authenticated
  `needs_workspace` users are sent to `/signup` instead of being treated as
  logged out.
- Replaced the PWA signup form with a phone-first flow:
  - phone number step sends the OTP,
  - 6-slot mobile OTP input verifies the code,
  - account step sets manager name and required password,
  - workspace step creates the salon and continues to existing onboarding.
- Added a 60-second client resend countdown matching the server OTP send
  cooldown.
- Kept the existing legacy one-shot `/api/v1/auth/signup` endpoint available
  for compatibility; the PWA no longer uses it for signup.

Verified locally:

- `pnpm --filter @repo/pwa typecheck`
- `pnpm --filter @repo/api-client typecheck`

Remaining notes for the next agent:

- Superseded by the later PWA OTP-only login slice: `/login` now exposes
  "ورود با کد پیامکی".
- This slice did not run browser or e2e verification against a live API. A local
  stack smoke with `AUTH_OTP_BYPASS_ENABLED=true` is still needed.

### 2026-06-15 PWA OTP-only login slice

Completed:

- Added a secondary "ورود با کد پیامکی" path to the PWA `/login` screen while
  keeping phone/password as the default login path.
- Reused the Better Auth phone-number OTP endpoints already exposed by the
  legacy PWA API wrapper:
  - validates and normalizes the entered phone number before sending OTP,
  - verifies the 6-digit OTP with digit-only, LTR, `one-time-code` input,
  - refreshes `/api/v1/auth/me` after verification and routes ready users to
    their role home or `redirect`,
  - routes verified users without a workspace to `/signup` so they continue the
    existing pre-workspace flow.
- Added resend support with the existing 60-second client cooldown policy and
  localized OTP error messages for invalid, expired, missing, rate-limited, and
  too-many-attempt states.
- Fixed the shared resend countdown hook pattern in `/login` and `/signup` so
  the countdown resets immediately from the current time when a new resend
  target is set.
- Fixed the PWA auth `refresh()` helper to force a fresh `/me` request instead
  of returning a recent cached unauthenticated result after OTP verification.

Verified locally:

- `pnpm --filter @repo/pwa typecheck`
- `pnpm db:migrate:local`
- Browser smoke with PWA on `http://localhost:3000`, API on
  `http://localhost:3002`, and `AUTH_OTP_BYPASS_ENABLED=true`: `/login` renders
  phone/password controls, the secondary OTP button switches to the OTP screen,
  resend starts disabled at 60 seconds, OTP `123456` verifies, and the demo
  staff user routes to `/today`.

Remaining notes for the next agent:

- The PWA UI checklist is now complete. Compatibility/local-stack verification
  is still open for password login, OTP signup, e2e helper updates, and rollback
  confirmation. OTP login itself has been smoked against the local API with
  `AUTH_OTP_BYPASS_ENABLED=true`.

### 2026-06-15 PWA OTP shared UI cleanup

Completed:

- Extracted shared PWA OTP helpers into `apps/pwa/src/lib/auth-otp.ts`:
  - OTP code length and resend cooldown constants,
  - digit normalization for Persian/Latin input,
  - localized Better Auth OTP error mapping,
  - resend countdown hook.
- Extracted the shared 6-slot OTP field into
  `apps/pwa/src/components/auth/otp-code-input.tsx`.
- Updated `/login` and `/signup` to use the shared OTP helpers/component while
  keeping their flow-specific mutation and navigation behavior local.

Verified locally:

- `pnpm --filter @repo/pwa typecheck`

### 2026-06-15 compatibility helper and rollback coverage slice

Completed:

- Added focused coverage for the legacy PWA API auth wrapper to prove password
  login now uses Better Auth's `/sign-in/phone-number` endpoint and resolves the
  legacy `User` through `/api/v1/auth/me`.
- Kept the old rollback endpoint constant
  `/api/v1/auth/sign-in/username` explicitly covered for callers that still need
  the rollout compatibility path.
- Added app-level API route tests proving both
  `/api/v1/auth/sign-in/phone-number` and `/api/v1/auth/sign-in/username`
  pass through to the Better Auth handler.

Verified locally:

- `pnpm --filter @repo/api-client test -- src/legacy/auth.test.ts`
- `pnpm --filter @repo/api test -- auth.test.ts`

Remaining notes for the next agent:

- There is no existing Playwright e2e suite in this repo, so this slice used
  focused helper/API route coverage rather than introducing a new e2e harness.
- Production enablement remains open: sms.ir template approval/env setup and
  smoke testing existing prod/test salons before broad OTP UI enablement.

### 2026-06-15 OTP signup wrapper coverage slice

Completed:

- Added focused coverage for the legacy PWA API auth wrapper methods used by
  the phone-first signup flow:
  - `sendPhoneOtp` posts `{ phoneNumber }` to Better Auth's
    `/api/v1/auth/phone-number/send-otp` endpoint.
  - `verifyPhoneOtp` posts `{ phoneNumber, code }` to
    `/api/v1/auth/phone-number/verify`.
  - `completeSignupAccount` posts manager name/password to
    `/api/v1/auth/signup/account`.
  - `createSignupWorkspace` posts salon name to
    `/api/v1/auth/signup/workspace`.
- This is a test-only slice; no runtime auth behavior changed.

Verified locally:

- `pnpm --filter @repo/api-client test -- src/legacy/auth.test.ts`

Remaining notes for the next agent:

- Production enablement remains open: sms.ir template approval/env setup and
  smoke testing existing prod/test salons before broad OTP UI enablement.
- A full local-stack smoke of OTP signup/password login is still useful if the
  next agent has the API/PWA stack already running.

## Test Plan

- Unit/API:
  - Env parsing for bypass code and sms.ir template config.
  - Real mode calls `sendSmsOtp`; bypass mode does not.
  - Wrong OTP fails; too many attempts fail.
  - `/me` returns `needs_workspace` for phone-verified users without membership.
  - `/me` returns `401` for no session and `ready` for users with active salon
    membership.
  - Workspace creation is idempotent and waits for salon name.
  - Existing users backfilled from username can log in by phone/password.
  - Legacy signup still works and populates phone fields.
  - Staff creation populates username, displayUsername, phoneNumber, and
    phoneNumberVerified, then staff can log in with phone/password.
  - Staff phone update keeps username/email/phoneNumber in sync.
  - Staff password update produces a credential account accepted by Better Auth
    phone-number sign-in.
  - Deactivated staff cannot access tenant routes after login/session refresh.
  - Legacy username/password endpoint remains operational during rollout.

- PWA:
  - Existing password login works after migration.
  - New OTP signup with bypass code lands in account/password step.
  - User cannot complete onboarding without password and workspace.
  - OTP input is LTR, 6 digits, paste/autofill friendly, invalid-state aware.
  - Resend timer disables/enables correctly.
  - Route guards send `needs_workspace` users to pre-workspace onboarding and
    `ready` users to their role-based home/onboarding route.

- Local stack:
  - Run migration/seed locally.
  - Start with:

    ```sh
    AUTH_OTP_BYPASS_ENABLED=true AUTH_OTP_BYPASS_CODE=123456 pnpm dev:local
    ```

  - Verify new signup, existing password login, OTP login, refresh/resume,
    resend timer.
  - Run targeted unit tests and relevant e2e against local stack.

## Assumptions

- Production sms.ir OTP will use an approved Verify template; sandbox/bypass
  cover local testing.
- Bypass is intentionally env-controlled and should log a loud startup warning
  when enabled.
- Existing prod/test salons are protected by additive migrations, backfill, and
  keeping old auth paths until new phone login is verified.
- Native is deprecated and out of scope for this ticket; no native refresh or
  compatibility work is planned.
- Staff invite/self-verification is a separate ticket; this one preserves the
  current manager-created staff account model.
