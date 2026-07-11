# Plan: Provider-agnostic messaging integrations (Telegram, WhatsApp, Bale, Rubika)

> **Status**: Draft — pending owner sign-off on the three open questions at the end.
> **Owner**: Mohamad
> **First provider shipped**: Telegram (manager-only, approval bot)
> **Codebase reference date**: 2026-05-31

---

## 1. Goal

Add a **messaging-app channel family** to Aravira's notification system, starting with
**Telegram** for salon managers. Build the abstraction so the next provider (Bale, Rubika,
WhatsApp) is a localized addition — one provider file, one webhook route, one env block,
one line added to the channel union (no SQL migration) — without re-touching the
dispatcher, the link flow, the registry, or shared UI components.

The first real product win is **one-tap approval of `appointmentRequest`s from Telegram**
for salon managers. Everything else (staff reminders, client confirmations, additional
providers) is sequenced behind it.

### Why now / why this shape

- The existing notification stack already models a multi-channel dispatcher:
  `NotificationChannel` enum, `notificationDeliveries` table, per-user preference flags,
  inline send in `createNotificationForUser` (`packages/notifications/src/notifications.ts:13-25`).
  We extend the same shape — we do **not** redesign it.
- Iran-specific: Telegram, Bale, and Rubika are dominant locally; WhatsApp matters less in
  Iran but is critical for diaspora. SMS stays the universal fallback channel.
- Approval-via-Telegram is the highest-value low-risk slice: managers are tech-savvy, the
  audience is small, and the action is already a one-click API call
  (`apps/api/src/routes/appointment-requests.ts:44`, `:64`).

### Non-goals (explicit, will not creep)

- Replacing SMS. SMS and every messaging provider are **independent opt-in channels**.
- Telegram (or any messaging app) as automatic SMS fallback, or vice versa.
- Per-tenant bots/accounts. One global bot per provider.
- Slash commands or read-only views inside the chat. PWA stays the primary UI.
- Required rejection-reason chat flow (state machine). Optional only.
- Building a job runner just for messaging. Reminders are gated on Phase 2's job-runner work.

---

## 2. Architecture

### 2.1 Mental model

Three layers, from the bottom up:

1. **Provider layer** — one file per provider implementing a `MessagingProvider`
   interface. Pure: takes a `MessagingSendInput`, returns a `MessagingDeliveryResult`.
   Knows nothing about salons, requests, or notifications. Lives in
   `packages/notifications/src/providers/`.
2. **Channel/dispatch layer** — `createNotificationForUser` iterates the provider
   registry and dispatches to every configured + enabled + linked provider for the user.
   Records each result in `notificationDeliveries`.
3. **Inbound/webhook layer** — provider-specific Hono sub-routes mounted under
   `/api/v1/messaging/<provider>/webhook`. Each route verifies the provider's auth
   contract, extracts a normalized `MessagingInboundEvent`, hands it to a shared command
   dispatcher (`handleApprovalCallback`, `handleRejectionCallback`, `handleLinkStart`,
   `handleUnlink`).

The deliberate split: **outbound is a registry-driven loop, inbound is per-provider
routing.** Outbound abstracts well; inbound varies too much (webhook auth, payload shape,
button-data encoding) to force into one shape.

### 2.2 Provider abstraction

```ts
// packages/notifications/src/providers/types.ts

export type MessagingProviderId = 'telegram' | 'whatsapp' | 'bale' | 'rubika'

export type MessagingButton = {
  /** Text shown in the chat. Keep under 30 chars (Telegram limit). */
  label: string
  /** Opaque string the provider echoes back on tap. Format: `<action>:<entityId>`. */
  data: string
}

export type MessagingSendInput = {
  notificationId: string
  externalId: string // chatId / phone / waId — provider-specific
  title: string
  body: string
  /** Optional inline keyboard. Providers without inline buttons IGNORE this and fall back
   *  to plain text + a deep link in the body. Never an error. */
  buttons?: MessagingButton[][]
  /** Provider-agnostic locale hint. */
  locale?: string
}

export type MessagingDeliveryResult = {
  status: 'sent' | 'failed' | 'skipped'
  providerMessageId?: string | null
  error?: string | null
}

export interface MessagingProvider {
  readonly id: MessagingProviderId
  readonly displayName: string
  /** True when env config is sufficient for this provider to send. */
  isConfigured(): boolean
  /** True when this provider supports inline tap-to-act buttons. */
  readonly supportsInlineButtons: boolean
  /** True when this provider needs a separately registered webhook to function. */
  readonly supportsInbound: boolean

  send(input: MessagingSendInput): Promise<MessagingDeliveryResult>
}
```

Outbound is the **only** thing the interface mandates. Inbound contracts vary too much to
unify — each provider owns its webhook route and translates payloads into
provider-agnostic `MessagingInboundEvent`s for the shared command dispatcher.

```ts
// packages/notifications/src/providers/registry.ts

const providers = new Map<MessagingProviderId, MessagingProvider>()

export function registerMessagingProvider(p: MessagingProvider): void
export function getMessagingProvider(
  id: MessagingProviderId,
): MessagingProvider | undefined
export function listMessagingProviders(): MessagingProvider[]
export function listConfiguredMessagingProviders(): MessagingProvider[]
```

Registration is **static at module load** in `providers/index.ts`. No DI container, no
lazy init — the registry is a process-lifetime singleton.

### 2.3 Schema design (chosen path: link-row-as-preference)

We add **two** new tables and **one** column. We do **not** add per-provider booleans
to `notificationPreferences` because that table would balloon as we add providers.

```sql
-- 1. The user's linked messaging accounts. One row per (user, provider).
CREATE TABLE user_messaging_accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL,                  -- 'telegram' | 'whatsapp' | 'bale' | 'rubika'
  external_id   TEXT NOT NULL,                  -- chatId / phone / waId
  display_name  TEXT,                           -- as the provider exposed it ("@mohamad")
  enabled       BOOLEAN NOT NULL DEFAULT true,  -- user's per-account opt-in toggle
  linked_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, external_id),               -- one chat can only be linked to one user
  UNIQUE (user_id, provider)                    -- one user has at most one account per provider
);
CREATE INDEX user_messaging_accounts_user_id_idx ON user_messaging_accounts(user_id);

-- 2. One-time link tokens generated from the PWA. ~10 min TTL.
CREATE TABLE messaging_link_tokens (
  token         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  salon_id      UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL,
  consumed_at   TIMESTAMPTZ
);
CREATE INDEX messaging_link_tokens_user_provider_idx
  ON messaging_link_tokens(user_id, provider) WHERE consumed_at IS NULL;

-- 3. Salon-level toggle: which messaging providers this salon allows at all.
ALTER TABLE salon_public_settings
  ADD COLUMN enabled_messaging_providers TEXT[] NOT NULL DEFAULT '{}';
```

We also extend two existing enums (string unions in Drizzle `.$type<...>()`):

```ts
// packages/database/src/schema.ts
// notifications.type:
type: text('type').notNull().$type<
  | 'appointment_created'
  | 'appointment_request_pending' // NEW (Phase 1)
  | 'appointment_request_approved' // NEW (Phase 3)
  | 'appointment_request_rejected' // NEW (Phase 3)
  | 'appointment_reminder' // NEW (Phase 2/3, gated on job runner)
>()

// notificationDeliveries.channel:
channel: text('channel').notNull().$type<
  | 'in_app'
  | 'local_sync'
  | 'sms'
  | 'android_regional_push'
  | 'telegram' // NEW (Phase 1)
  | 'bale' // NEW (Phase 4)
  | 'rubika' // NEW (Phase 4)
  | 'whatsapp' // NEW (Phase 5)
>()
```

#### Why this schema shape

- **`user_messaging_accounts.enabled`** doubles as the per-provider opt-in toggle (your
  hard requirement). Linking + enabling is the same row; unlinking deletes the row.
  No orphan preferences for providers a user never linked.
- **`enabled_messaging_providers TEXT[]`** on the salon settings row gives the salon owner
  a single per-provider switch. Empty array = no messaging providers for this salon. The
  array form scales without ALTERs as we add providers.
- **Unique `(provider, external_id)`** prevents two Aravira users from claiming the same
  Telegram chat (sanity guard against link-token replay).
- **`(user_id, provider)` unique** keeps the model "one Telegram account per Aravira
  user." A user wanting to migrate to a new chat unlinks the old one first.

### 2.4 Dispatch flow

```
createNotificationForUser(input)
  ├── createNotificationRecordForUser(input)         (existing)
  ├── recordNotificationDelivery(id, 'in_app')       (existing)
  ├── sendSmsNotification(notification)              (existing)
  ├── recordNotificationDelivery(id, 'sms', ...)     (existing)
  └── for each provider in listConfiguredMessagingProviders():
        if salon.enabledMessagingProviders does NOT include provider.id → record 'skipped'
        else:
          account = lookupUserMessagingAccount(userId, provider.id)
          if !account || !account.enabled → record 'skipped'
          else:
            result = provider.send({ notificationId, externalId: account.externalId, ... })
            recordNotificationDelivery(id, provider.id, result.status, { ... })
```

All sends are awaited sequentially (same blocking model as SMS today). When we cross
2–3 providers and latency matters, we revisit with `Promise.allSettled` — not before.

### 2.5 Inbound flow (Phase 1+: Telegram only)

```
POST /api/v1/messaging/telegram/webhook
  ├── verifySecretTokenHeader(X-Telegram-Bot-Api-Secret-Token)
  ├── parse update:
  │     - /start <token>        → handleLinkStart({ provider: 'telegram', token, from })
  │     - callback_query data='approve:<reqId>' → handleApprovalCallback(...)
  │     - callback_query data='reject:<reqId>'  → handleRejectionCallback(...)
  │     - anything else         → no-op, 200
  ├── all handlers:
  │     - resolve provider account → user
  │     - re-check authorization via existing requireTenant logic (manual call, not middleware)
  │     - call the same db functions the HTTP routes use
  └── reply 200 within 1s (Telegram retries on timeout/4xx/5xx)
```

The **command dispatcher** lives in `packages/notifications/src/commands/`. The webhook
route is a thin parser; all business logic and DB writes are in shared functions also
exposed for unit tests and (eventually) other providers' webhooks.

### 2.6 Configuration

Per-provider env vars follow SMS's pattern (`packages/notifications/src/sms.ts:26-36`):
all required, all read at first use, validated via `apps/api/src/env.ts`.

```
# Global
MESSAGING_LINK_TOKEN_TTL_MINUTES=15

# Telegram (Phase 1)
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=...
TELEGRAM_BOT_USERNAME=AraviraSalonBot
TELEGRAM_WEBHOOK_SECRET=...

# Bale (Phase 4) — similar set, Bale's bot API is Telegram-bot-API-compatible
BALE_ENABLED=true
BALE_BOT_TOKEN=...
BALE_BOT_USERNAME=AraviraSalonBot
BALE_WEBHOOK_SECRET=...

# WhatsApp (Phase 5) — Meta Cloud API
WHATSAPP_ENABLED=true
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_VERIFY_TOKEN=...
WHATSAPP_APP_SECRET=...
```

`env.ts` validates required ones only when the matching `*_ENABLED=true`. We add a tiny
`requireWhenEnabled(flag, key)` helper to keep the Zod schema readable.

---

## 3. Phases

Each phase is a shippable, reversible slice. None of phases 1–5 requires the next.

### Phase 0 — Architecture skeleton (no user-visible behavior)

**Goal**: land the provider interface, registry, schema, and dispatcher hooks **without
any provider implementation**. SMS keeps working unchanged. Calling
`listConfiguredMessagingProviders()` returns `[]`.

**Deliverables**

1. New files
   - `packages/notifications/src/providers/types.ts` — interface, types from §2.2.
   - `packages/notifications/src/providers/registry.ts` — registry from §2.2.
   - `packages/notifications/src/providers/index.ts` — registration entry point (empty
     for now; later imports the per-provider modules).
   - `packages/notifications/src/commands/index.ts` — command dispatcher stubs
     (`handleApprovalCallback`, `handleRejectionCallback`, `handleLinkStart`,
     `handleUnlink`). They throw `not_implemented` for now.
   - `packages/database/src/internal/messaging-queries.ts` — CRUD for
     `userMessagingAccounts` and `messagingLinkTokens` (`createLinkToken`,
     `consumeLinkToken`, `findAccountByExternalId`, `findAccountByUserAndProvider`,
     `upsertAccount`, `deleteAccount`, `listAccountsForUser`).
   - `packages/database/src/messaging.ts` — re-exports for app code.

2. Schema migration
   - Edit `packages/database/src/schema.ts`: add the two new tables and the
     `enabledMessagingProviders` column; extend the `notificationDeliveries.channel`
     and `notifications.type` `.$type<>()` unions.
   - Generate the migration via `pnpm --filter @repo/database db:generate` (Drizzle
     produces a numbered, auto-named SQL file under
     `packages/database/src/migrations/`, e.g. `0002_<adjective>_<name>.sql`). Inspect
     the generated DDL; should match §2.3.
   - Do NOT hand-write migrations — the project uses `drizzle-kit generate`.

3. `createNotificationForUser` extension
   - `packages/notifications/src/notifications.ts` — after the existing SMS block, append
     a `for...of listConfiguredMessagingProviders()` loop that dispatches per §2.4. Each
     iteration records a `notificationDeliveries` row.
   - The loop is a no-op until Phase 1 registers a provider, but the wiring is in place.

4. Tests
   - `packages/notifications/src/providers/registry.test.ts` — register/list/get
     contracts.
   - `packages/notifications/src/notifications.test.ts` (new) — `createNotificationForUser`
     records `in_app` + `sms` exactly as before with an empty registry. Add a fake
     provider in this test to verify the new loop dispatches and records.
   - `packages/database/src/internal/messaging-queries.test.ts` — CRUD round-trips,
     UNIQUE constraint violations, token consumption + idempotency.

**Acceptance criteria**

- All existing tests pass with zero changes.
- New tests pass.
- `pnpm typecheck` clean across the workspace.
- No new env vars are required to run the API.
- No user-visible UI change.

**Risks / mitigations**

- _Drizzle enum widening could surprise downstream code._ Search for any `switch` on
  `NotificationChannel` and add `default` arms before widening
  (`grep -rn "in_app\|local_sync" --include='*.ts'`).
- _Migration ordering_: Drizzle numbers migrations from the highest existing file.
  Before generating, `ls packages/database/src/migrations/` to confirm what's already
  there; rebase your branch on the latest `main` to avoid a number collision with a
  concurrent migration PR.

---

### Phase 1 — Telegram for managers (the MVP)

**Goal**: a salon manager links their Telegram account once, then receives a DM with
**Approve / Reject / Open in app** buttons every time an `appointmentRequest` is created
for any salon they manage. Tapping a button executes the same DB action the PWA does.

**Deliverables**

1. New files
   - `packages/notifications/src/providers/telegram.ts` — implements `MessagingProvider`.
     - `isConfigured()` reads `TELEGRAM_ENABLED + TELEGRAM_BOT_TOKEN`.
     - `send()` posts to `https://api.telegram.org/bot<TOKEN>/sendMessage` with
       `parse_mode: 'HTML'`, optional `reply_markup.inline_keyboard` built from
       `MessagingButton[][]`. Handles HTTP error mapping into `MessagingDeliveryResult`.
     - `supportsInlineButtons = true`, `supportsInbound = true`.
   - `apps/api/src/routes/messaging-telegram.ts` — Hono route exporting
     `messagingTelegramRoute`. Two endpoints:
     - `POST /webhook` (public; verifies `X-Telegram-Bot-Api-Secret-Token` against
       `TELEGRAM_WEBHOOK_SECRET`). Parses `update`, routes to commands.
     - `POST /set-webhook` — admin-only utility (gated behind tenant=`admin` role or env
       flag `MESSAGING_ADMIN_ROUTES=true`). Optional; CLI alternative below.
   - `apps/api/src/routes/messaging.ts` — Hono route for authenticated link flow:
     - `POST /api/v1/messaging/link` — body `{ provider: 'telegram' }`. Creates a
       `messagingLinkToken`, returns `{ deepLink, expiresAt }`.
     - `GET /api/v1/messaging/accounts` — returns the user's linked accounts.
     - `DELETE /api/v1/messaging/accounts/:id` — unlink (verifies ownership).
   - `apps/api/src/cli/messaging-set-webhook.ts` — sets the Telegram webhook URL on
     startup/redeploy. Follows the existing CLI pattern
     (`apps/api/src/cli/expire-requests.ts:1-21`).
   - `packages/notifications/src/commands/approval.ts` — `handleApprovalCallback`
     implementation. Reuses `approveAppointmentRequest` from
     `@repo/database/appointment-requests`. Returns a structured result for the route to
     translate into a "message edit" call back to Telegram.
   - `packages/notifications/src/commands/rejection.ts` — same pattern, calls
     `rejectAppointmentRequest`. Rejection reason is `'rejected via Telegram'` (literal
     string; phase 2 can prompt for one).
   - `packages/notifications/src/commands/link.ts` — `handleLinkStart` consumes the
     token, calls `upsertAccount`, returns a friendly localized confirmation message.

2. Approval-message templating
   - `packages/notifications/src/templates/appointment-request.ts` — produces
     `{ title, body, buttons }` for the new
     `'appointment_request_pending'` notification type. Persian copy, Jalali date
     formatting (use the project's existing date helper if present in `salon-core`).

3. Wire the trigger
   - `apps/api/src/routes/public.ts` (the public booking submit handler at line 68-92) —
     after `createAppointmentRequest`, look up all managers of the salon (members with
     role `'owner'|'admin'`) and call `createNotificationForUser` once per manager with
     `type: 'appointment_request_pending'`. **Each manager gets one notification record.**
     The dispatcher routes each to in-app + (if enabled) SMS + (if linked + enabled)
     Telegram.

4. Mount routes
   - `apps/api/src/app.ts`: `.route('/api/v1/messaging', messagingRoute)` and
     `.route('/api/v1/messaging/telegram', messagingTelegramRoute)`. Public webhook does
     **not** go through `requireTenant` or `cors` (or, if CORS is mounted globally,
     the route is fine — Telegram does not preflight). Confirm via curl test.

5. Manager PWA changes (`apps/pwa`)
   - Settings page: a "Connect Telegram" panel.
     - State: not linked → big button opening `deepLink` returned from `POST /messaging/link`.
     - State: linked → shows `displayName`, toggle for `enabled`, "Unlink" button.
   - Notification settings panel: add "ارسال در تلگرام" toggle wired to the same
     `user_messaging_accounts.enabled` field (single source of truth).
   - **No SMS-style separate `telegramAlertsEnabled` row in `notificationPreferences`** —
     the link-row is the toggle.

6. Schema additions
   - **None.** All tables/columns landed in Phase 0. Phase 1 is code + UI only.

7. Env (`apps/api/src/env.ts`)
   - Add `TELEGRAM_ENABLED`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`,
     `TELEGRAM_WEBHOOK_SECRET`, `MESSAGING_LINK_TOKEN_TTL_MINUTES`.
   - Required when `TELEGRAM_ENABLED=true`; otherwise optional.

8. Tests
   - `packages/notifications/src/providers/telegram.test.ts` — `send()` happy path,
     not-configured skip, HTTP-error path, inline-keyboard serialization.
   - `packages/notifications/src/commands/approval.test.ts` — race (request already
     approved) returns idempotent message, not throw.
   - `apps/api/src/routes/messaging-telegram.test.ts` — webhook signature verification
     (good + bad secret), `/start <token>` flow, callback approve/reject flow,
     unknown-update no-op.
   - `apps/api/src/routes/messaging.test.ts` — link token creation, listing, deletion,
     auth boundary (other user cannot delete your account).
   - E2E (Playwright, if your suite covers manager flows): "manager links Telegram, gets
     notification, taps approve, request shows approved in PWA." Mock the Telegram API.

9. Documentation
   - Add a section to `CONTEXT.md` (or wherever ops procedures live) for BotFather setup,
     `TELEGRAM_WEBHOOK_SECRET` rotation, and how to manually re-register the webhook
     (`pnpm cli:messaging-set-webhook`).

**Acceptance criteria**

- Manager links Telegram from the PWA in < 30 seconds.
- A new `appointmentRequest` produces a Telegram DM to every linked-and-enabled manager
  of the target salon within ~3 seconds.
- Tapping **Approve** writes the same DB rows as the PWA approve flow; the original
  message is edited to "✅ Approved by @name at 14:32".
- Tapping **Reject** writes the same DB rows as the PWA reject flow; message edited to
  "❌ Rejected".
- Race: if the request is already non-pending, the callback edits the message to
  "⚠️ Already handled" and does not duplicate state.
- A manager who has NOT linked Telegram is unaffected: same in-app + SMS behavior as
  before.
- Salon owner can disable Telegram for their salon via
  `salonPublicSettings.enabledMessagingProviders` (UI for this can land later — DB
  toggle is sufficient for v1).

**Risks / mitigations**

- _Webhook reachability_: Telegram requires public HTTPS. The API is already public on
  VPS; verify port 443 and a valid cert. Test with `curl` against the public URL before
  calling `setWebhook`.
- _Secret token rotation_: rotating `TELEGRAM_WEBHOOK_SECRET` requires re-calling
  `setWebhook`. Document this in the ops section.
- _Auto-staff-assignment on approve_: the existing API requires `staffId` in the body
  (`appointment-requests.ts:44`). Phase 1 decision: **on Telegram approve, auto-assign
  using the same slot-availability logic the PWA uses to pre-fill**. If no
  unambiguous match, the callback edits the message to "👉 Open in app to pick staff"
  and does not approve. This keeps the bot honest and avoids surprise assignments.
- _Telegram outage_: send failures record `failed` in `notificationDeliveries`; in-app
  and SMS are unaffected because they ran first. We do not retry — Telegram delivers
  push within the chat, not the message; missing one approval DM is recoverable via the
  PWA.

---

### Phase 1.5 — Finish Phase 1 properly: inline approve/reject callbacks

**Status (2026-06-01)**: Phase 1 actually shipped as "link + notify with deep-link only".
The template renders a single `مشاهده در برنامه` URL button
(`packages/notifications/src/templates/appointment-request.ts:40-42`) and the webhook
stubs `callback_query` handling (`apps/api/src/routes/messaging-telegram.ts:106-109`).
The original Phase 1 promise — one-tap approve/reject from inside Telegram — was deferred.
Phase 1.5 closes it.

**Goal**: managers can tap **تأیید** / **رد** on the DM and have the underlying
`appointmentRequest` transition exactly as if they had used the PWA. The original message
edits in place to reflect the new state.

**Deliverables**

1. Template change
   - `packages/notifications/src/templates/appointment-request.ts` — add two
     `callback_data` buttons above the existing URL button:
     - `{ label: '✅ تأیید', data: 'approve:<requestId>' }`
     - `{ label: '❌ رد', data: 'reject:<requestId>' }`
     - Keep `مشاهده در برنامه` as a third URL button row (escape hatch when auto-assign
       can't pick a staff).
   - `MessagingButton` already supports `data` (callback) and `url` (deep link) — no
     interface change.

2. Command implementations
   - `packages/notifications/src/commands/approval.ts` (new):
     `handleApprovalCallback({ provider, externalId, requestId })` returns a
     `CommandResult` with the message text the route should write back to the chat.
     - Resolve account → user via `findAccountByExternalId`.
     - Re-authorize: caller must be a manager (`'owner'|'admin'`) of the request's salon
       via the existing `member` lookup. **Chat session is never trusted as tenant
       context.** On failure: `{ status: 'error', code: 'forbidden', message: '...' }`.
     - Look up the request. If not `pending` → `{ status: 'ok', message: '⚠️ این درخواست قبلاً رسیدگی شده است.' }` (race-safe; never throws, never duplicates state).
     - Auto-staff-assign decision (Phase 1 open question #2 — confirmed): try the same
       unambiguous-slot match the PWA uses to pre-fill staff. If exactly one staff matches,
       call `approveAppointmentRequest({ requestId, staffId, approvedBy: userId })`. If
       zero or multiple match, return `{ status: 'ok', message: '👉 لطفاً برای انتخاب آرایشگر در برنامه باز کنید.', code: 'needs_app' }` — the message edit keeps the URL button alive.
     - On success: `{ status: 'ok', message: '✅ تأیید شد توسط <name> در <HH:MM>' }`.
   - `packages/notifications/src/commands/rejection.ts` (new):
     `handleRejectionCallback({ provider, externalId, requestId })` — same shape; calls
     `rejectAppointmentRequest({ requestId, rejectedBy: userId, reason: 'rejected via Telegram' })`. On success: `'❌ رد شد توسط <name> در <HH:MM>'`.
   - Both commands export from `packages/notifications/src/commands/index.ts`.

3. Webhook wiring
   - `apps/api/src/routes/messaging-telegram.ts`:
     - Parse `update.callback_query.data` against the format `^(approve|reject):(.+)$`.
     - Dispatch to `handleApprovalCallback` / `handleRejectionCallback`.
     - Always call `answerTelegramCallback` first (stops the spinner) — pass the success
       text as the toast.
     - Call `editTelegramMessageText` with the new body. Keep the URL button when the
       command returned `code: 'needs_app'`; drop the inline keyboard otherwise.
     - Unknown `data` payload → `answerTelegramCallback` no-op, 200.

4. Tests
   - `packages/notifications/src/commands/approval.test.ts` — happy path, race
     (already-non-pending), forbidden (caller not a manager), needs-app (ambiguous staff
     match). Mock `approveAppointmentRequest`.
   - `packages/notifications/src/commands/rejection.test.ts` — same shape.
   - `apps/api/src/routes/messaging-telegram.test.ts` — extend with: approve callback
     happy path edits the message; bad-signature path still 200; unknown `data` no-op.

5. Diagnostic improvement (worth doing here)
   - `packages/notifications/src/providers/telegram.ts` — on `!res.ok`, log
     `{ event: 'messaging.send.failed', provider: 'telegram', status, body: res.text.slice(0, 1024) }` to stdout in addition to recording in `notification_deliveries.error`. Local-test pain point: Telegram's HTML-parse errors are explicit (`"can't parse entities: Unsupported start tag …"`) but currently invisible without querying the DB.

**Acceptance criteria**

- Tapping **تأیید** in Telegram writes the same DB rows as the PWA approve flow when
  auto-assign matches; otherwise edits the message to "open in app" and keeps the URL
  button.
- Tapping **رد** writes the same DB rows as the PWA reject flow.
- Race: if the request is already non-pending, the message edits to "Already handled"
  and no state changes.
- Forbidden case (manager unlinks from one salon but the message is from another) edits
  to a friendly "you no longer manage this salon" — never throws.

**Risks / mitigations**

- _Auto-assign mis-pick_: the matcher must be the **same** function the PWA uses to
  pre-fill staff. If we don't have one extractable, this phase extracts it from the PWA
  approve dialog into `@repo/salon-core`.
- _Callback data length_: Telegram limits `callback_data` to 64 bytes. `approve:<uuid>`
  is 44 bytes — fine. If we ever encode more (e.g. salon id), use a short opaque token.

---

### Phase 1.6 — Telegram UX layer: grammY + commands menu + persistent keyboard + Mini-App

**Goal**: tighten the Telegram-side UX. Replace hand-rolled fetch+types with **grammY**
behind the existing provider abstraction (no PWA changes), add discoverable bot commands
(blue `/` menu), a persistent reply keyboard, and a Telegram Mini-App menu button that
opens the PWA inside Telegram.

The provider interface (`MessagingProvider`) does **not** change. grammY lives entirely
inside `telegram.ts` and the webhook route.

**Deliverables**

1. Dependency
   - `apps/api`: add `grammy` (and `@grammyjs/types` if needed for inbound typing).
   - No other workspaces touched.

2. Provider refactor
   - `packages/notifications/src/providers/telegram.ts` — replace `postToTelegram`,
     `extractMessageId`, and ad-hoc fetch with a single `Api` instance constructed
     lazily from the resolved config. `send()` calls `api.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup })`.
   - `editTelegramMessageText`, `answerTelegramCallback`, `sendTelegramMessage` keep
     their current signatures (Phase 1.5 callers depend on them) but delegate to the
     grammY `Api`.
   - Delete the hand-rolled `TelegramMessage` / `TelegramCallbackQuery` types in
     `messaging-telegram.ts`; use grammY's typed `Update`.

3. Webhook refactor
   - `apps/api/src/routes/messaging-telegram.ts` — keep raw-secret verification via
     `X-Telegram-Bot-Api-Secret-Token` (grammY's `webhookCallback` supports passing
     the secret, but we already verify and have a route shape; keep our own
     verification + manual `update` parsing for now). Switch the local `TelegramUpdate`
     type to grammY's `Update` type. Net effect: types tighten, behavior unchanged.

4. Discoverable commands (`setMyCommands`)
   - Extend `apps/api/src/cli/messaging-set-webhook.ts` to also call `setMyCommands`
     in a single startup script (or split into a sibling
     `messaging-bootstrap.ts` — pick the simpler one). Commands:
     - `/start` — اتصال یا راهنما
     - `/pending` — درخواست‌های در انتظار
     - `/today` — قرارهای امروز
     - `/unlink` — قطع اتصال
     - `/help` — راهنما
   - Persian descriptions via `setMyCommands({ commands, language_code: 'fa' })`.
   - Implement `/pending` and `/today` as text replies that list items with inline
     approve buttons per row (`/pending` reuses Phase 1.5's callback dispatcher).
     `/unlink` calls `handleUnlink`. `/help` is a static message.

5. Persistent reply keyboard
   - After successful `/start <token>` link, send a follow-up message with a persistent
     `ReplyKeyboardMarkup`:
     ```
     [ 📋 درخواست‌های در انتظار ]  [ 📅 امروز ]
     [ ⚙️ تنظیمات اعلان‌ها ]
     ```
     `is_persistent: true, resize_keyboard: true`. Each button is plain text that the
     webhook routes to the corresponding command handler (text-equality match before
     falling through to the `/command` parser). Tapping "تنظیمات اعلان‌ها" replies with
     a deep link into the PWA settings.

6. Mini-App menu button (`setChatMenuButton`)
   - In the bootstrap script: set a per-bot default menu button of type `web_app`
     pointing at the manager PWA URL (`MESSAGING_PWA_BASE_URL` env var, falls back to
     the existing public app URL).
   - In the PWA: read `window.Telegram.WebApp.initData` if present and exchange it for
     a session at `POST /api/v1/auth/telegram/webapp` (verifies HMAC against
     `TELEGRAM_BOT_TOKEN`, looks up the linked user, issues a Better Auth session).
     This is **opt-in for v1** — works even if the PWA ignores `initData`; the Mini-App
     just opens the normal login flow. The auth endpoint is a follow-up if we want
     SSO; do **not** block 1.6 on it.

7. Tests
   - `packages/notifications/src/providers/telegram.test.ts` — adapt to grammY's `Api`.
     Mock at the `fetch` level (grammY uses fetch under the hood) or via
     `Bot.api.config.use` middleware. Keep assertions on outbound payloads identical to
     today.
   - `apps/api/src/routes/messaging-telegram.test.ts` — add cases: reply-keyboard text
     ("📋 درخواست‌های در انتظار") routes to the pending handler; menu button setup is
     covered by a bootstrap-script test, not the webhook route.

**Acceptance criteria**

- Existing approve/reject (Phase 1.5) keeps working with zero behavior change.
- The blue `/` button shows the five Persian-labeled commands.
- After link, the user sees a persistent 3-button keyboard.
- The Telegram chat header shows a "Open Aravira" menu button that launches the PWA
  inside Telegram.
- `pnpm typecheck` clean; no hand-rolled Telegram type defs remain.

**Risks / mitigations**

- _grammY API surface drift across versions_: pin major. We touch a small subset
  (`Api.sendMessage`, `Api.editMessageText`, `Api.answerCallbackQuery`,
  `Api.setMyCommands`, `Api.setChatMenuButton`); regressions surface in unit tests.
- _Mini-App on non-Telegram browsers_: `window.Telegram` is undefined → the PWA path
  is a no-op fallback. Safe.
- _Provider abstraction leak_: keep all grammY references inside `telegram.ts`.
  Bale/WhatsApp providers do **not** depend on grammY. If a future Bale provider also
  wants grammY-style ergonomics (it's API-compatible), copy — don't share — same rule
  as Phase 4.

---

### Phase 2 — Staff notifications + introduce a job runner

**Goal**: staff get a "shift starting" DM 60 minutes before their first appointment of
the day; managers get a daily 09:00 digest of pending requests. **Requires a real job
runner** — this is the gate.

**Deliverables**

1. **Job-runner decision** (must be settled before code)
   - Option A: extend the existing CLI-cron pattern (`apps/api/src/cli/*`) with a few
     new scripts triggered by system cron at fixed times. **Recommended** for v1 —
     zero new infra, matches `expire-requests.ts:1-21`.
   - Option B: `pg-boss` (Postgres-backed queue). Better if we later need per-event
     scheduling (T-24h reminders relative to each appointment).
   - **Pick A for Phase 2's specific events** (daily digest, shift-starts-soon evaluated
     hourly). Defer B to Phase 3 where per-appointment relative reminders need it.

2. New CLI scripts (Phase 2)
   - `apps/api/src/cli/messaging-shift-starting.ts` — hourly cron. Selects
     `appointments` starting in 55–65 minutes for staff with linked+enabled Telegram (or
     other messaging providers), dispatches `'appointment_reminder'` notifications.
   - `apps/api/src/cli/messaging-daily-digest.ts` — daily cron (09:00 Asia/Tehran).
     Selects pending `appointmentRequests` per salon; for each manager with a linked
     messaging account, sends a single digest notification with counts and a deep link.

3. New notification type
   - `'appointment_reminder'` already added in Phase 0's union; this phase activates it.
   - A new `'manager_daily_digest'` type — add to the `.$type<>()` union.

4. New template module
   - `packages/notifications/src/templates/shift-reminder.ts`
   - `packages/notifications/src/templates/daily-digest.ts`

5. Idempotency
   - The shift-starting cron must not double-send. Approach: maintain a tiny
     `notification_dedup` key on the `notifications.data` JSONB
     (`{ dedupKey: 'shift-starting:<appointmentId>' }`), and the query that selects
     candidates LEFT JOINs `notifications` filtering out same-dedupKey hits in the last
     24h. No new table; cheap.

**Acceptance criteria**

- Cron at the top of each hour: staff with appointments starting in ~60 min get a
  Telegram DM and SMS (if enabled). No double-sends across cron runs.
- Cron at 09:00 daily: managers with linked Telegram and at least one pending request
  get a digest message with the count and a link to the PWA approvals page.
- Operations: `pnpm cli:messaging-shift-starting` and `pnpm cli:messaging-daily-digest`
  exit 0 when there is nothing to do (idempotent and safe to re-run).

**Risks / mitigations**

- _Cron drift / missed runs_: log every run start/end to stdout (captured by VPS
  journald); a missed digest is recoverable next day.
- _Quiet-hours / spam_: explicit out-of-scope. Document this. Salon owners can disable
  per-salon if they need.

---

### Phase 3 — Client-side messaging + per-appointment reminders

**Goal**: clients who opt in receive a Telegram (or Bale/Rubika in later phases)
confirmation when an `appointmentRequest` is approved/rejected, plus a reminder T-24h
and T-2h before the appointment. **Introduces `pg-boss`** for relative-time scheduling.

**Deliverables**

1. Client linking
   - Clients are not Better Auth users. Their handle is `clients` table (existing).
   - Approach: after a successful `appointmentRequest` submission, the public status page
     (`/r/:token`) gets a "Get notifications on Telegram" CTA that hands them a deep link
     into the bot with a token tied to the **client** id, not a user id.
   - New table `client_messaging_accounts` (mirrors `user_messaging_accounts` but
     references `clients`). Or: generalize the table with a `subject_type` enum
     (`'user' | 'client'`). **Recommendation**: separate table, keep boundaries crisp.
   - Reuse the same `messaging_link_tokens` table by widening it to support either
     `user_id` or `client_id` (one nullable, one set), or by adding `subject_type`. Land
     this decision when Phase 3 starts; both work.

2. Job runner upgrade: `pg-boss`
   - Add `pg-boss` to `apps/api` deps. Bootstrap a `apps/api/src/jobs/queue.ts` that
     starts a worker process. Separate process from the HTTP server
     (`apps/api/src/jobs.ts` entrypoint), launched by the same `docker-compose.yml` /
     systemd unit on the VPS.
   - Schedule jobs at `appointmentRequest` approval time:
     `queue.send('appointment-reminder', { appointmentId }, { startAfter: T-24h })` and
     another at `T-2h`.
   - On appointment cancellation, `queue.cancel(jobId)` (we store `jobId`s on the
     appointment row, new column `reminder_job_ids JSONB`).

3. New notification types
   - `'appointment_request_approved'` (already in Phase 0 union; activated here)
   - `'appointment_request_rejected'` (same)
   - `'appointment_reminder_client'` — distinct from staff reminder

4. Templates
   - `packages/notifications/src/templates/client-approval.ts`
   - `packages/notifications/src/templates/client-rejection.ts`
   - `packages/notifications/src/templates/client-reminder.ts`

5. Trigger wiring
   - In `approveAppointmentRequest` (`packages/database/src/internal/
appointment-request-queries.ts:102-178`), **after** the conditional flip succeeds,
     fire two side effects: - `createNotificationForUser` (or its `forClient` sibling) for the client. - Schedule the two reminder jobs.
   - These side effects happen **outside the DB transaction** — log failures, never
     fail the approval because a notification couldn't send.

**Acceptance criteria**

- Client submits a request → opts into Telegram on the status page → gets a Telegram DM
  when the manager approves/rejects → gets reminders at T-24h and T-2h.
- Cancellation cancels pending reminder jobs (no zombie reminders for cancelled
  appointments).
- A client who does not opt in still gets SMS (if SMS is configured), exactly as today.

**Risks / mitigations**

- _Job runner adds a new failure mode and a new process to monitor._ Mitigation: keep
  the worker stateless, restart-on-failure via systemd, basic stdout logs.
- _Time-zone correctness_: appointments store local time and date strings, not
  timestamps (`schema.ts:726-728`). Reminder scheduling must combine
  `requested_date + requested_start_time + salonProfile.timezone` into UTC. Hide this
  behind a helper in `salon-core` to avoid scattered conversions.

---

### Phase 4 — Bale (Iranian Telegram-compatible)

**Goal**: prove the abstraction by adding Bale (a popular Iranian messaging app whose
bot API is largely Telegram-bot-API-compatible) as a second provider. Expect zero
changes to the dispatcher, registry, or PWA UI — only a new provider file, a webhook
route, and env config.

**Deliverables**

1. `packages/notifications/src/providers/bale.ts` — implements `MessagingProvider`.
   - Bale's API base is `https://tapi.bale.ai/bot<TOKEN>/...`. Method shapes match
     Telegram closely. We **copy** `telegram.ts`, swap the base URL and any field
     differences, and ship a separate file rather than parameterize the Telegram
     provider — keeping providers independent matters more than DRY here.
2. `apps/api/src/routes/messaging-bale.ts` — webhook + setWebhook helper. Same shape
   as Telegram's.
3. Env: `BALE_ENABLED`, `BALE_BOT_TOKEN`, `BALE_BOT_USERNAME`, `BALE_WEBHOOK_SECRET`.
4. PWA: add a "Connect Bale" panel — same component as Telegram's, parameterized by
   provider id.
5. Tests: mirror Phase 1's test suite, against the Bale provider.
6. `packages/database/src/schema.ts` — add `'bale'` to the
   `notificationDeliveries.channel` `.$type<>()` union (TypeScript-only; no SQL
   migration needed because the column type is `text`). Run
   `pnpm --filter @repo/database db:generate` and confirm the diff is empty.

**Acceptance criteria**

- Manager can link Bale instead of, or in addition to, Telegram.
- A notification fires to **all** linked providers; tapping approve on Bale or Telegram
  is equivalent and race-safe (see Phase 1 race handling).
- Zero changes to `notifications.ts`, `registry.ts`, or any PWA component except the
  per-provider panel.

**Risks / mitigations**

- _Bale API drift from Telegram_: keep `bale.ts` independent; never inherit from
  `telegram.ts`. If we hit 3+ Telegram-style providers, **then** extract a
  `bot-api-style` shared helper — not earlier.

---

### Phase 5 — WhatsApp Business Cloud API

**Goal**: support WhatsApp for diaspora and salons that serve non-Iran clients.

**Deliverables**

1. `packages/notifications/src/providers/whatsapp.ts`
   - Uses Meta's Cloud API (`https://graph.facebook.com/v20.0/<phoneNumberId>/messages`).
   - **Important**: WhatsApp business messaging requires pre-approved **message
     templates** for messages outside the 24-hour customer-service window. Provider
     keeps a `templateName` → template-id mapping; `MessagingSendInput` grows an
     optional `templateRef?: string` (we keep this provider-specific via a typed
     "extras" field on the input, not in the base interface).
   - Buttons in WhatsApp are **interactive list/button messages**, not Telegram-style
     inline keyboards. The provider maps `MessagingButton[][]` into WhatsApp's
     interactive button object (max 3 buttons, single row).

2. `apps/api/src/routes/messaging-whatsapp.ts`
   - Webhook: WhatsApp uses an `App Secret` signed-payload model (`X-Hub-Signature-256`).
     The route verifies HMAC-SHA256 against `WHATSAPP_APP_SECRET`.
   - `verify_token` GET challenge handler (Meta's webhook verification step).

3. Linking flow
   - Different from Telegram. WhatsApp does **not** support deep-link bot tokens. We
     link by phone number: client/manager enters their WhatsApp number → we send a
     6-digit OTP via WhatsApp template message → user enters OTP in PWA → linked.
     **This is the only provider where linking is two-step instead of deep-link.**

4. Env: `WHATSAPP_ENABLED`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`,
   `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`.

5. Templates: pre-register approval, rejection, reminder templates with Meta and store
   their names in `WHATSAPP_TEMPLATES_*` env vars.

**Acceptance criteria**

- Manager / client can link a WhatsApp number via OTP.
- Same notifications fire on WhatsApp as on Telegram, using the approved templates.
- Webhook signature verification rejects unsigned/forged payloads.

**Risks / mitigations**

- _Template approval is a Meta process and can take days/weeks._ Start the approvals in
  parallel with Phase 0 work if WhatsApp is on the roadmap.
- _Cost_: Meta charges per conversation in some regions. Acceptable; document for
  finance.
- _Per-provider linking flow_: this is the corner that breaks the "uniform link flow"
  fantasy. Solve by treating linking flow as **per-provider in code** while the PWA
  surface area is still uniform ("Connect WhatsApp" button → different next-step UI).

---

## 4. Rubika

Slot Rubika anywhere between Phase 4 and Phase 5 based on demand. Rubika's bot API is
its own shape (not Telegram-compatible); expect a slightly heavier provider
implementation than Bale, but the abstraction holds. No additional planning here until
we commit to it.

---

## 5. Cross-cutting concerns

### 5.1 Testing strategy

- **Unit**: provider `send()` happy/failure paths, command dispatcher idempotency,
  template rendering, schema query layer.
- **Integration**: webhook signature verification, link-token lifecycle (create →
  consume → expire), cross-provider race (request approved via PWA while DM is in
  flight).
- **E2E (Playwright)**: manager links provider → approve flow round-trips. Mock the
  outbound HTTP to provider APIs; assert on the requests we make.
- **Manual smoke** before each phase rollout: real account, real chat, real send.

### 5.2 Observability

- Every send writes a `notification_deliveries` row. Failures include the provider's
  error body (truncated to 1KB).
- Add structured log lines in `telegram.ts`, `bale.ts`, etc.:
  `{ event: 'messaging.send', provider, status, latencyMs, notificationId }`.
- Webhook routes log `{ event: 'messaging.webhook', provider, action, durationMs }`.
- No new metrics infra — VPS journald + a query against `notification_deliveries`
  status counts is the dashboard for now.

### 5.3 Security

- **Webhook auth**: every provider's webhook MUST verify a provider-specific signature
  before doing anything else. Phase 1 = Telegram secret token header. Phase 5 = HMAC.
- **Tenant authorization**: every command (approve/reject/digest) re-resolves the
  user's permission on the target salon at execution time via the existing
  `member` table lookup. The chat session is **not** trusted as a tenant context.
- **Link tokens**: 15-minute TTL, single-consume (set `consumed_at`), bound to one
  user and one provider. Replay attempts return a friendly "expired or already used."
- **External-id confusion**: `(provider, external_id)` is unique. A linked chat
  belongs to exactly one Aravira user.
- **Rate limiting**: webhook routes share the API's existing global limits. Per-chat
  abuse (someone hammering callback buttons) is bounded by the conditional flip
  pattern — second tap finds non-pending state.
- **Secret rotation playbook**: documented in `CONTEXT.md`. Rotating bot tokens and
  webhook secrets is a two-step (env update → setWebhook re-call) — no DB changes.

### 5.4 Privacy / data minimization

- Bodies sent over messaging carry: client first name (no surname), service name,
  date/time, salon name. **Never**: phone numbers, addresses, prices unless the
  salon explicitly opts in. Make this a template-level decision, not a runtime
  toggle, so it's auditable.
- `notification_deliveries.error` may capture provider error bodies; ensure we don't
  log message body content there. The current SMS code already does this correctly.

### 5.5 Backwards compatibility

- Phase 0 is purely additive. SMS preference flags on `notificationPreferences`
  remain. No existing user is impacted.
- The `salon_public_settings.enabled_messaging_providers` default `'{}'` means
  every existing salon starts with messaging fully disabled — opt-in by design.

### 5.6 Rollout & feature gating

- Per-salon gate: `salon_public_settings.enabled_messaging_providers`. We can enable
  Telegram for one pilot salon, observe for a week, then roll out by updating that
  column for the rest.
- Per-env gate: `*_ENABLED` env vars. Provider modules `isConfigured()` returns
  `false` if disabled and the dispatcher skips them entirely.
- Per-user gate: `user_messaging_accounts.enabled`. User can self-disable without
  unlinking.

### 5.7 Operations runbook (additions to CONTEXT.md, Phase 1)

1. BotFather setup: create `@AraviraSalonBot`, `/setprivacy` → Disabled (so bot sees
   button taps in groups, though we use DMs only), `/setjoingroups` → Disabled,
   `/setdescription`, `/setabouttext`.
2. Set env vars on VPS.
3. Run `pnpm cli:messaging-set-webhook` once after deploy and on every URL/secret
   change.
4. Smoke test: link the dev account, hit the test endpoint, observe DM.

---

## 6. What this brings (business value summary)

| Capability                                           | Phase    | Benefit                                                                                          |
| ---------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------ |
| One-tap approval from Telegram for managers          | 1        | Drops approval latency from minutes to seconds. Higher conversion on incoming requests.          |
| Per-user, per-provider opt-in                        | 1 onward | Users keep control. SMS stays default, messaging is a free upgrade.                              |
| Multi-channel delivery (in-app + SMS + Telegram + …) | 1 onward | Redundancy; survives carrier flakiness without changing app logic.                               |
| Salon-level provider toggle                          | 1 onward | Salon owners can disable messaging entirely for their tenant — privacy concern absorbed cleanly. |
| Staff shift reminders                                | 2        | Reduces no-show staff and late starts.                                                           |
| Daily manager digest                                 | 2        | Manager wakes up to "you have 3 pending requests" — pulls them into the app at the right moment. |
| Client confirmations & reminders                     | 3        | Reduces client no-show rate (the single biggest revenue leak in salons).                         |
| Bale support                                         | 4        | Reaches Iranian users who use Bale over Telegram.                                                |
| WhatsApp support                                     | 5        | Reaches diaspora and non-Iran clientele.                                                         |

The architectural payoff: **each new provider after Bale is a one-PR addition**, not a
re-design. The hard work is in Phases 0–1.

---

## 7. Open questions (owner sign-off needed before Phase 1 code starts)

1. **Bot username**: confirming `@AraviraSalonBot` (or pick another). Whoever owns the
   BotFather account is the long-term ops dependency.
2. **Auto-staff-assignment on Telegram approve**: confirm the Phase-1 stance that we
   auto-assign when there's an unambiguous slot match and fall back to "open in app"
   otherwise. Alternative: never auto-assign, always link to PWA.
3. **Pilot salon**: which org gets `enabled_messaging_providers = ['telegram']` first?
   Or do we want an admin UI to flip this before Phase 1 ships?

---

## 8. Appendix: file-by-file change map (Phases 0–1)

> Concrete delta for the first two phases. Phases 2+ are sketched at the same level when
> they are scheduled.

### Phase 0

| File                                                  | Change                                                                                                                                                                                                                                                |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/database/src/schema.ts`                     | Add `userMessagingAccounts`, `messagingLinkTokens` tables. Widen `notificationDeliveries.channel` and `notifications.type` unions. Add `enabledMessagingProviders` column on `salonPublicSettings`.                                                   |
| `packages/database/src/migrations/<auto-named>.sql`   | Generated by `pnpm --filter @repo/database db:generate` after editing `schema.ts`. Contains the two `CREATE TABLE` statements and the `ALTER TABLE salon_public_settings` column add. The `.$type<>()` widenings are TypeScript-only and emit no SQL. |
| `packages/database/src/internal/messaging-queries.ts` | New: CRUD per §3 Phase 0.                                                                                                                                                                                                                             |
| `packages/database/src/messaging.ts`                  | New: re-exports for app code.                                                                                                                                                                                                                         |
| `packages/database/package.json` exports              | Add `./messaging` entry.                                                                                                                                                                                                                              |
| `packages/notifications/src/providers/types.ts`       | New: interface from §2.2.                                                                                                                                                                                                                             |
| `packages/notifications/src/providers/registry.ts`    | New: registry from §2.2.                                                                                                                                                                                                                              |
| `packages/notifications/src/providers/index.ts`       | New: empty registration (no providers yet).                                                                                                                                                                                                           |
| `packages/notifications/src/commands/index.ts`        | New: stubs.                                                                                                                                                                                                                                           |
| `packages/notifications/src/notifications.ts`         | Add `for...of listConfiguredMessagingProviders()` loop in `createNotificationForUser`.                                                                                                                                                                |
| `packages/notifications/src/index.ts`                 | Export new types and registry functions.                                                                                                                                                                                                              |
| `apps/api/src/env.ts`                                 | Add `MESSAGING_LINK_TOKEN_TTL_MINUTES`.                                                                                                                                                                                                               |
| Tests                                                 | Per Phase 0 §1.4.                                                                                                                                                                                                                                     |

### Phase 1

| File                                                          | Change                                                                |
| ------------------------------------------------------------- | --------------------------------------------------------------------- |
| `packages/notifications/src/providers/telegram.ts`            | New: provider impl.                                                   |
| `packages/notifications/src/providers/index.ts`               | Register Telegram if `isConfigured()`.                                |
| `packages/notifications/src/commands/approval.ts`             | New.                                                                  |
| `packages/notifications/src/commands/rejection.ts`            | New.                                                                  |
| `packages/notifications/src/commands/link.ts`                 | New.                                                                  |
| `packages/notifications/src/templates/appointment-request.ts` | New: copy + buttons.                                                  |
| `apps/api/src/routes/messaging.ts`                            | New: link/list/unlink endpoints.                                      |
| `apps/api/src/routes/messaging-telegram.ts`                   | New: webhook + set-webhook.                                           |
| `apps/api/src/cli/messaging-set-webhook.ts`                   | New CLI.                                                              |
| `apps/api/src/app.ts`                                         | Mount the two new routes.                                             |
| `apps/api/src/routes/public.ts`                               | After `createAppointmentRequest`, dispatch notifications to managers. |
| `apps/api/src/env.ts`                                         | Add Telegram env block.                                               |
| `apps/pwa` settings page                                      | "Connect Telegram" panel + notification preferences toggle.           |
| Tests                                                         | Per Phase 1 §8.                                                       |
| `CONTEXT.md`                                                  | Ops/runbook section for messaging providers.                          |

---

_End of plan. Section 7 must be answered before Phase 1 code lands._
