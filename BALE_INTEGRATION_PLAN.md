# Bale Integration Plan

## Summary

Add Bale in two delivery modes:

- **Bale Bot API** for Telegram-parity features: user account linking, `/pending`,
  `/today`, `/unlink`, `/help`, reply keyboard, inline approve/reject/staff-picker
  callbacks, message edits, and per-user bot notifications.
- **Bale Safir phone delivery** for no-connection outbound messages: staff
  appointment-added notifications and manager-triggered client retention messages.

The implementation should treat Bale as a first-class messaging provider, not as a
Telegram alias. Bale's bot API is intentionally Telegram-like, but the docs show
important differences around webhook verification, message formatting, mini-app
runtime, and Safir phone delivery errors.

## Read Before Implementing

- Bale bot docs: https://docs.bale.ai/
  - Read "Creating requests", "Receiving updates", `setWebhook`,
    `sendMessage`, `InlineKeyboardMarkup`, `CallbackQuery`,
    `answerCallbackQuery`, `editMessageText`, and `editMessageReplyMarkup`
    before implementing the bot provider or webhook route.
  - Key facts from docs: API base is
    `https://tapi.bale.ai/bot<token>/METHOD_NAME`; requests must use HTTPS;
    supported webhook ports are `443` and `88`; responses use `{ ok, result,
    description, error_code, parameters }`; `callback_data` is 1 to 64 bytes;
    `sendMessage` text is 1 to 4096 characters.
- Bale Safir docs: https://docs.bale.ai/safir
  - Read `send_message`, `MessageData`, `ReplyMarkup`, phone-number format,
    response shape, and error codes before implementing staff/client phone sends.
  - Key facts from docs: Safir sends to `phone_number` using
    `https://safir.bale.ai/api/v3/send_message`; auth is via `api-access-key`;
    destination numbers must be normalized to Iranian `98...` format; error
    code `17 NotBaleUser` means not every stored phone is guaranteed reachable.
- Bale mini-app docs: https://docs.bale.ai/miniapp
  - Read only if adding a Bale in-app PWA/Mini-App flow. This is out of v1
    scope, but useful for future work.
  - Key facts from docs: runtime object is `window.Bale.WebApp`; mini-app auth
    validates `Bale.WebApp.initData` with HMAC-SHA-256 and the constant
    `WebAppData`; Bale supports direct `startapp`, menu-button, inline-button,
    and reply-keyboard mini-app entry points.
- Bale gateway/OTP docs: https://docs.bale.ai/gateway
  - Read only if adding OTP/auth messaging later. This is out of v1 scope.
- Existing local roadmap: `MESSAGING_INTEGRATION_PLAN.md`
  - Read the Telegram and Phase 4 Bale sections to understand why the repo
    already has provider ids, account tables, and delivery channels for Bale.
- Existing local implementation references:
  - `packages/notifications/src/providers/telegram.ts`
  - `apps/api/src/routes/messaging-telegram.ts`
  - `apps/api/src/routes/messaging.ts`
  - `packages/notifications/src/commands/approval.ts`
  - `packages/notifications/src/commands/bot-text.ts`
  - `packages/notifications/src/notifications.ts`
  - `apps/pwa/src/components/settings/messaging-accounts-section.tsx`
  - `apps/api/src/routes/retention.ts`

## Goals

- Managers can connect Bale from the PWA and receive the same bot experience
  currently available in Telegram.
- New appointment requests fan out to all configured messaging providers,
  including Bale bot accounts.
- Staff can receive "appointment added" notifications through Bale without
  connecting a bot account, using Safir phone delivery.
- Managers can send client retention messages manually from the existing
  retention queue using Safir phone delivery.
- Bale failures do not block in-app, SMS, push, or database writes.

## Non-Goals

- No automatic retention campaigns in v1. Retention sends are manager-triggered.
- No Bale payments, invoices, wallet flows, OTP auth, or mini-app login in v1.
- No assumption that every Iranian phone number is reachable in Bale. Safir
  `NotBaleUser` must be a normal delivery outcome.
- No shared Telegram/Bale superclass yet. Keep `bale.ts` independent; extract a
  shared bot-api-style helper only after a third compatible provider creates
  real duplication pressure.

## Public Interfaces

### Environment

Add API env fields and validation:

- `BALE_ENABLED`
- `BALE_BOT_TOKEN`
- `BALE_BOT_USERNAME`
- `BALE_WEBHOOK_SECRET`
- `BALE_WEBHOOK_URL`
- `BALE_SAFIR_ENABLED`
- `BALE_SAFIR_API_ACCESS_KEY`
- `BALE_SAFIR_BOT_ID`

`BALE_WEBHOOK_SECRET` should be a generated high-entropy value. Bale docs do not
document Telegram's `X-Telegram-Bot-Api-Secret-Token`, so the webhook route
should verify a secret path segment or similarly unguessable URL component.

### API Routes

- `POST /api/v1/messaging/bale/webhook/:secret`
  - Public route for Bale bot updates.
  - Verify `:secret` against `BALE_WEBHOOK_SECRET` before parsing or mutating.
  - Always return `{ ok: true }` quickly after verification/no-op handling.
- `POST /api/v1/retention/:id/bale-message`
  - Manager-only route.
  - Sends one Safir message for an open retention item.
  - Records delivery status and returns the delivery result.
  - Refuses missing/invalid client phone numbers.

### Provider Registration

Use existing provider id `bale`.

- Register Bale bot provider in `apps/api/src/bootstrap-messaging.ts`.
- Keep existing `POST /api/v1/messaging/link` API unchanged; it already accepts
  `bale` in the provider enum.
- Keep existing `user_messaging_accounts` schema for linked Bale bot accounts.

### Delivery Metadata

Record Bale bot notification deliveries on channel `bale`.

For Safir phone delivery, record enough metadata to distinguish it from bot
delivery:

- `provider: "bale_safir"`
- `providerMessageId` from Safir when available
- `error` containing a normalized error code such as `not_bale_user`,
  `invalid_phone`, `rate_limited`, `payment_required`, or `safir_send_error`

## Implementation Plan

### 1. Bale Bot Provider

Add `packages/notifications/src/providers/bale.ts`.

Behavior:

- `isConfigured()` returns true only when Bale bot env is complete.
- `buildAccountLinkUrl(token)` returns the Bale bot deep link.
  - Prefer `https://ble.ir/<bot_username>?start=<token>`.
  - Before shipping, verify the exact deep-link behavior with a real Bale bot or
    a maintained Bale bot library reference, because the main Bale docs document
    mini-app `startapp` links more explicitly than bot `start` links.
- `send(input)` posts to
  `https://tapi.bale.ai/bot${BALE_BOT_TOKEN}/sendMessage`.
- Convert shared `MessagingButton[][]` into Bale inline keyboards.
  - Buttons with `data` become `callback_data`.
  - Buttons with `url` become URL buttons.
  - Keep callback payloads under 64 bytes.
- Add helper functions used by the route:
  - `sendBaleMessage`
  - `editBaleMessageText`
  - `editBaleMessageReplyMarkup`
  - `answerBaleCallback`
- Escape/render text for Bale's documented Markdown behavior. Do not reuse
  Telegram HTML output blindly.
- Log send/edit failures with `provider: "bale"` and a truncated response body
  or normalized error.

Testing:

- Send success returns `sent` and provider message id.
- Missing config returns `skipped`.
- Bale `{ ok: false }` returns `failed` with a useful error.
- Inline data/url buttons map correctly.
- Markdown escaping handles names/services containing markup characters.

### 2. Bale Webhook Route

Add `apps/api/src/routes/messaging-bale.ts` and mount it in `apps/api/src/app.ts`.

Webhook behavior:

- Verify `:secret` before reading the JSON body.
- Parse Bale `Update` JSON with local types or a thin provider-local type file.
- For `message.text`:
  - `/start <token>` calls `messagingCommands.handleLinkStart({ provider:
    "bale", token, externalId, displayName })`.
  - Bare `/start` explains that users should connect from inside the app.
  - `/pending`, `/today`, `/unlink`, `/help`, and reply-keyboard labels call
    the same command handlers used by Telegram with `provider: "bale"`.
- For `callback_query`:
  - Parse existing callback payloads: `approve:<requestId>`,
    `reject:<requestId>`, `back:<requestId>`, `asg:<requestId>:<index>`.
  - Call the existing approval command handlers with `provider: "bale"`.
  - Always answer the callback query first where possible, then edit message
    text or markup based on the command outcome.
- Unknown updates are no-op 200 responses.

Testing:

- Wrong secret causes no command calls and returns 200.
- Invalid JSON returns 200.
- Link token is consumed and account is linked.
- Commands resolve caller by Bale external id.
- Approve/reject callbacks mutate appointment requests exactly like Telegram.
- Staff-picker and back callbacks edit markup correctly.

### 3. Webhook Setup CLI

Extend or add a CLI:

- Option A: extend `apps/api/src/cli/messaging-set-webhook.ts` with
  `--provider=telegram|bale`.
- Option B: add `apps/api/src/cli/bale-set-webhook.ts`.

For Bale:

- Call `setWebhook` at
  `https://tapi.bale.ai/bot<token>/setWebhook` with
  `url = BALE_WEBHOOK_URL`.
- Ensure `BALE_WEBHOOK_URL` includes the secret route segment and uses HTTPS on
  port `443` or `88`, matching Bale docs.
- Add an ops note to `docs/VPS_AIRGAPPED_DEPLOYMENT.md` or the API deploy docs
  covering Bale outbound host allowlist needs:
  - `https://tapi.bale.ai`
  - `https://safir.bale.ai`

Testing:

- CLI refuses missing/incomplete Bale config.
- CLI builds the expected setWebhook payload.

### 4. PWA Messaging Settings

Generalize the current Telegram-only settings UI.

Implementation:

- Rename `useTelegramConnect` to a provider-parameterized hook, for example
  `useMessagingConnect(provider)`.
- Rename `TelegramConnectCard` to a generic provider card if still needed.
- Update `MessagingAccountsSection` to render Telegram and Bale cards for
  managers.
- Keep staff bot account linking out of v1 UI unless needed for future staff
  bot commands. Staff appointment-added notifications use Safir phone delivery.

Testing:

- Manager sees Telegram and Bale connection rows when providers are configured.
- Existing Telegram connect/toggle/unlink behavior is unchanged.
- Bale connect calls `api.messaging.createLink({ provider: "bale" })`.

### 5. Safir Phone Delivery

Add a Safir sender module, for example `packages/notifications/src/providers/bale-safir.ts`.

Behavior:

- Normalize phones to Bale's required `98...` format.
- Send `POST https://safir.bale.ai/api/v3/send_message`.
- Include `api-access-key` header.
- Include deterministic `request_id` for idempotency.
- Include `bot_id = BALE_SAFIR_BOT_ID`.
- Use only Safir-supported inline buttons: `url`, `web_app`, or `copy_text`.
  Safir docs do not show `callback_data`, so do not use Safir for approve/reject
  interactions.
- Map Safir errors:
  - `8 InvalidPhone` -> `invalid_phone`
  - `17 NotBaleUser` -> `not_bale_user`
  - `3 RateLimitExceeded` -> `rate_limited`
  - `20 PaymentRequired` -> `payment_required`
  - unknown -> `safir_send_error`

Testing:

- Phone normalization accepts `0912...`, `912...`, `+98912...`, and
  `98912...`.
- Invalid phone fails before network call.
- Successful response records provider message id.
- Each documented Safir error maps to the expected local status/error.

### 6. Staff Appointment-Added Notifications

Current appointment creation already calls `createNotificationForUser` for staff
when a manager creates an appointment for someone else. Extend delivery behavior
for `appointment_created`.

Behavior:

- Existing in-app, SMS, and push behavior remains unchanged.
- If the staff user has a linked and enabled Bale bot account, send through the
  Bale bot provider via the existing messaging fan-out.
- If no linked Bale bot account exists and Safir is configured, send one Safir
  phone message to the staff member's stored phone/username.
- Do not double-send both bot and Safir to the same staff user for the same
  appointment.
- Record skipped delivery when phone is missing, invalid, salon disabled, Safir
  disabled, or user is not reachable in Bale.

Implementation notes:

- Staff phone is currently stored on the user username/display username path in
  staff creation/update flows. Reuse that source; do not add schema just to find
  staff phone.
- Keep the message short and Persian-first:
  - Title: "نوبت جدید"
  - Body: client, service, Jalali/Gregorian date as existing app convention,
    start time, and optional app URL.

Testing:

- Linked Bale bot account takes precedence over Safir.
- No linked account plus valid staff phone sends Safir.
- `NotBaleUser` records a failed/skipped Bale delivery but appointment creation
  still succeeds.

### 7. Manager-Triggered Retention Messages

Add manual client retention sending from the existing retention queue.

Database:

- Add a delivery/audit table for client follow-up messages, for example
  `client_follow_up_message_deliveries`.
- Suggested fields:
  - `id`
  - `salon_id`
  - `follow_up_id`
  - `client_id`
  - `provider`
  - `phone`
  - `request_id`
  - `status`
  - `provider_message_id`
  - `error`
  - `sent_by_user_id`
  - `created_at`
  - `sent_at`
- Add a uniqueness guard for successful sends per `follow_up_id` and provider,
  or enforce idempotency via deterministic `request_id`.

API:

- Add `POST /api/v1/retention/:id/bale-message`.
- Require manager permission.
- Load the retention item, client, salon name/profile, and client phone.
- Refuse already-sent follow-ups unless the previous status was failed and the
  request is an explicit retry.
- Send through Safir.
- Return delivery result.

PWA:

- Add a "Send Bale message" action to each open retention item.
- Show confirmation before sending.
- Show sent/failed state after send.
- Keep "reviewed" and "dismissed" flows unchanged.

Template:

- Use a conservative, manager-reviewed Persian message.
- Include salon name and a short reason-aware invitation.
- Include a booking/public page URL button only when a valid HTTPS public URL is
  available.
- Do not include approve/reject callback buttons; Safir does not support them.

Testing:

- Manager-only auth.
- Missing client phone returns a clear error.
- Successful Safir response records delivery.
- Repeat send is deduped or requires explicit retry.
- Safir `NotBaleUser` is shown as a normal failed delivery.

## Acceptance Criteria

- A manager can connect a Bale bot account from settings in under 30 seconds.
- New appointment requests produce Bale bot DMs to linked/enabled managers when
  the salon has Bale enabled.
- Bale approve/reject/staff-picker buttons update appointment requests with the
  same database effects as Telegram callbacks.
- Staff receive appointment-added Bale Safir messages by phone when no linked
  Bale account exists and Safir is configured.
- Managers can send one client retention Bale message from the retention queue.
- Bale failures are visible in delivery records and never block core app flows.
- Existing Telegram behavior remains unchanged.

## Verification

Run targeted tests first:

- `pnpm --filter @repo/notifications test`
- `pnpm --filter @repo/database test`
- `pnpm --filter api test`
- `pnpm --filter pwa test`

Then run:

- `pnpm typecheck`

If the implementation touches the PWA settings or retention UI, also run a local
browser smoke test for:

- Settings messaging account connect/toggle/unlink rows.
- Retention queue send action, confirmation, and delivery result states.

## Assumptions

- Full Telegram feature parity requires Bale bot linking because Safir phone
  messages do not document `callback_data`.
- Staff appointment-added messages should not require staff to connect a bot
  account; Safir phone delivery is the default no-connection path.
- Client retention messages are manager-triggered in v1.
- The exact Bale bot deep-link URL should be verified before implementation
  freeze. The planned default is `https://ble.ir/<bot_username>?start=<token>`.
- Payments, invoices, OTP, mini-app login, and automatic campaigns are future
  follow-ups, not part of this implementation.
