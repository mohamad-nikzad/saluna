# SMS Delivery Foundation Design

Date: 2026-06-15
Backlog: BL-0008 Add SMS support
Status: proposed

## Goal

Build a provider-swappable SMS delivery foundation for Saluna. The first real provider is sms.ir. This ticket is delivery-only: it does not create OTP challenge storage, auth endpoints, password reset flows, or appointment verification policy. Those belong to BL-0004, BL-0005, and BL-0006.

The foundation must support three delivery shapes:

- OTP/template messages for login, registration, password reset, and public customer verification.
- Single-recipient text messages for existing notification delivery.
- Bulk text batches for future retention and customer follow-up work.

## Existing Context

`@repo/notifications` already owns notification delivery across in-app, SMS, Telegram, Bale, and push paths. `packages/notifications/src/sms.ts` currently reads generic `SMS_*` environment variables and posts a provider-shaped payload to `SMS_API_URL`.

That proves the channel exists, but it is too generic for long-term provider replacement. sms.ir and Kavenegar have different authentication, template, response, and bulk-send contracts. Those differences should live behind provider adapters, not in auth, retention, or notification callers.

## Approach

Create a typed SMS boundary in `@repo/notifications`.

The boundary exposes provider-neutral use cases:

- `sendSmsOtp(input)`
- `sendSmsText(input)`
- `sendSmsBulk(input)`
- existing `sendSmsNotification(notification)`

Callers describe intent and content. They do not build sms.ir request bodies, know sms.ir endpoint paths, or read provider-specific environment variables.

## Public Types

`SmsProvider`:

- `id`: stable provider id such as `sms_ir`.
- `displayName`: human-readable name.
- `isConfigured()`: returns whether required credentials exist.
- `sendOtp(input)`: sends a template/verify message.
- `sendText(input)`: sends one normal SMS.
- `sendBulk(input)`: sends one message to many recipients, or a batch accepted by the provider adapter.

`SmsDeliveryResult`:

- `status`: `sent`, `failed`, or `skipped`.
- `provider`: provider id when known.
- `providerMessageId`: provider message id when one message is sent.
- `providerBatchId`: provider pack/batch id for bulk sends when available.
- `error`: sanitized internal error code or short safe message.

`SmsOtpInput`:

- `phone`
- `code`
- `purpose`: `login`, `signup`, `forgot_password`, `appointment_request`, or another explicit string union added by future tickets.
- `requestId`: optional idempotency/correlation key from the caller.
- `templateParams`: optional extra provider-neutral template parameters.

`SmsTextInput`:

- `phone`
- `message`
- `requestId`

`SmsBulkInput`:

- `recipients`: normalized phone list, capped by service/provider limits.
- `message`
- `purpose`: initially `retention` or `notification`.
- `requestId`

Bulk support in BL-0008 is an interface and adapter capability, not retention campaign scheduling, segmentation, retry queues, or consent management.

## sms.ir Adapter

The sms.ir adapter uses the official REST API:

- Authentication: `X-API-KEY` header.
- OTP/template messages: `POST https://api.sms.ir/v1/send/verify`.
- Normal and bulk text messages: `POST https://api.sms.ir/v1/send/bulk`.

OTP request shape:

- `mobile`
- `templateId`
- `parameters`, including the OTP code parameter.

Bulk request shape:

- `lineNumber`
- `messageText`
- `mobiles`

Response handling:

- Treat HTTP non-2xx as failed.
- Treat `status !== 1` as failed.
- Extract `data.messageId` for OTP/single messages.
- Extract `data.packId` and `data.messageIds` for bulk messages.
- Map provider errors to internal codes such as `sms_ir_http_error`, `sms_ir_rejected`, `invalid_phone`, `missing_template`, and `provider_not_configured`.
- Do not persist or log raw response bodies if they may contain sensitive details.

The adapter must also support sms.ir sandbox usage. The official sandbox supports the same URL structure with sandbox API keys and documents default verify template id `123456`. Development environments can use that template id without sending real SMS.

## Environment

Replace the generic current SMS variables with provider-specific configuration:

- `SMS_ENABLED=false`
- `SMS_PROVIDER=sms_ir`
- `SMS_IR_API_KEY=`
- `SMS_IR_LINE_NUMBER=`
- `SMS_IR_OTP_TEMPLATE_ID=`
- `SMS_IR_API_BASE_URL=https://api.sms.ir/v1`

Optional future per-purpose templates:

- `SMS_IR_LOGIN_TEMPLATE_ID`
- `SMS_IR_SIGNUP_TEMPLATE_ID`
- `SMS_IR_FORGOT_PASSWORD_TEMPLATE_ID`
- `SMS_IR_APPOINTMENT_REQUEST_TEMPLATE_ID`

If a per-purpose template is missing, the adapter falls back to `SMS_IR_OTP_TEMPLATE_ID`. If no usable template exists, OTP sending returns `skipped` with `missing_template`.

## Phone Normalization

The SMS service normalizes Iranian mobile numbers before calling providers:

- Accept `09xxxxxxxxx`, `9xxxxxxxxx`, `+989xxxxxxxxx`, and `989xxxxxxxxx`.
- Emit the provider-compatible value consistently.
- Reject invalid or empty phone numbers with `failed` and `invalid_phone`.

This normalization lives in the SMS boundary so future auth and retention code do not duplicate it.

## Notification Integration

`sendSmsNotification(notification)` remains the compatibility API used by existing notification dispatch. Internally it should call `sendSmsText` after checking notification preferences and loading the recipient phone.

The notification channel continues to record `sms` deliveries in `notification_deliveries`, using the provider id, message id or batch id when available, and a sanitized error code.

## Error Handling And Logging

Errors are explicit and safe:

- Missing config returns `skipped`, not an exception.
- Invalid phone returns `failed`.
- Provider rejection returns `failed`.
- Network or parsing errors return `failed`.

Logs include:

- provider
- purpose
- status
- internal error code
- notification id or request id when available

Logs must not include:

- API keys
- full provider request headers
- raw provider responses containing unpredictable data
- OTP codes

## Testing

Unit tests cover:

- SMS disabled and missing provider config.
- sms.ir verify request shape and `X-API-KEY` header.
- sms.ir bulk request shape.
- sms.ir success parsing for `messageId`, `packId`, and `messageIds`.
- sms.ir rejected responses and HTTP failures.
- malformed provider JSON.
- phone normalization.
- no secrets or OTP codes in returned errors.
- existing notification delivery records the `sms` channel result.

## Non-Goals

This design does not include:

- OTP challenge persistence.
- OTP verification endpoints.
- login/register OTP UX.
- forgot password UX.
- public appointment request OTP UX.
- campaign scheduling or retention automation.
- customer consent/preference rules for marketing messages.
- provider delivery-status polling.

Those features should build on this delivery foundation in later backlog items.

## Rollout

1. Add the typed SMS boundary and fake/test provider support.
2. Add the sms.ir adapter.
3. Wire existing `sendSmsNotification` through the new service.
4. Update env schemas and examples.
5. Add tests.
6. Keep SMS disabled by default until production credentials and templates are configured.
