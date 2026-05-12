# Native Notifications Plan — Iran-Ready

The native app currently ships only a local preferences UI for notifications
(`apps/native/app/push-settings.tsx`). The toggle stores `native:push-enabled`
in `AsyncStorage` and opens OS notification settings, but it does not create a
server-side notification, register any delivery channel, or provide a durable
in-app inbox.

Because this app is shipped in Iran, Expo Push / FCM / APNS should not be the
production foundation for native notifications. The production-safe v1 should be
server-owned notifications with an in-app inbox and local device alerts after
sync. SMS and Android regional push providers should be pluggable later, but not
required for the first implementation.

## Current State

- **Native app**: Local-only notification toggle. No real permission workflow,
  no server registration, no notification inbox, and no tap routing.
- **Backend push pipeline**: Web Push (VAPID) only. `/api/push/config` and
  `/api/push/subscribe` are browser/PWA-specific and use `web-push`.
- **Database**: `push_subscriptions` is shaped for browser Web Push only:
  `endpoint`, `p256dh`, and `auth`.
- **Notification trigger**: Appointment creation currently sends web push to the
  assigned staff member when the creator is a different user.

## Direction

Build a self-hosted notification layer that treats the database as the source of
truth. Delivery channels are adapters layered on top.

V1 channels:

- **In-app inbox**: Required. Every native notification is stored and can be
  fetched, listed, read, and routed inside the app.
- **Local notifications after sync**: Required for native. The app can show a
  local notification for newly synced unread items while the app is installed and
  able to sync.

Later channels:

- **SMS**: Deferred until a provider is chosen. Add adapter interfaces and
  database delivery tracking now, but do not require SMS credentials or provider
  implementation for v1.
- **Android regional push**: Deferred. Providers such as Pushe/Push-Pole can be
  evaluated later behind the same adapter interface.
- **iOS remote push**: Deferred unless APNS legal/distribution constraints are
  explicitly cleared.

Keep the existing PWA web push pipeline working for web users, but do not use it
as the native production strategy.

## Data Model

Add notification tables instead of expanding `push_subscriptions` for native:

- `notifications`
  - `id`
  - `salon_id`
  - `user_id`
  - `type` (`appointment_created` for v1)
  - `title`
  - `body`
  - `route`
  - `data` JSON payload
  - `read_at`
  - `created_at`
- `notification_deliveries`
  - `id`
  - `notification_id`
  - `channel` (`in_app`, `local_sync`, later `sms`, later `android_regional_push`)
  - `status` (`pending`, `sent`, `failed`, `skipped`)
  - `provider`
  - `provider_message_id`
  - `error`
  - `created_at`
  - `sent_at`
- `notification_preferences`
  - `salon_id`
  - `user_id`
  - `appointment_alerts_enabled`
  - `local_alerts_enabled`
  - `sms_alerts_enabled` default `false`
  - `created_at`
  - `updated_at`

SMS preference exists now so the UI/API shape is ready, but it should be disabled
or marked unavailable until an SMS provider is configured.

## Phased Implementation

### Phase 1 — Notification Foundation

Goal: create the durable, self-hosted notification backbone without changing
native UX yet.

- Add the notification tables described above.
- Add `apps/app/lib/notifications` as the orchestration layer:
  - `createNotificationForUser(...)`
  - `listNotificationsForUser(...)`
  - `markNotificationRead(...)`
  - `getNotificationPreferences(...)`
  - `updateNotificationPreferences(...)`
  - `dispatchNotification(...)`
- Implement v1 dispatch as database delivery tracking only:
  - create an `in_app` delivery row when a notification is created.
  - leave `local_sync` delivery logging optional unless we need client-side
    auditability.
- Add typed API client support in `packages/api-client`:
  - `GET /api/notifications?unreadOnly=true`
  - `POST /api/notifications/:id/read`
  - `POST /api/notifications/read-all`
  - `GET /api/notification-preferences`
  - `PATCH /api/notification-preferences`
- Ensure all routes use tenant request helpers and scope by both `salon_id` and
  `user_id`.

Acceptance:

- A user can list only their own salon-scoped notifications.
- A user can mark only their own notifications as read.
- Preferences can be read and updated per user.
- Existing PWA web push behavior is unchanged.

### Phase 2 — Appointment-Created Trigger

Goal: create real server-side notifications for the first production event.

- Update appointment creation so it creates one `appointment_created`
  notification for the assigned staff member when the creator is a different
  user.
- Route payload:
  - `/(tabs)/calendar?date={date}&appointmentId={appointmentId}`
- Copy:
  - short Persian title/body.
  - suitable for inbox now and future SMS later.
- Existing web push can continue separately for PWA subscribers.

Acceptance:

- Manager-created appointment for another staff member creates exactly one
  unread notification.
- Self-created appointment does not notify the same user.
- Notification data includes the appointment id, date, route, title, and body.

### Phase 3 — Native Inbox And Settings

Goal: make notifications visible and controllable in the native app.

- Replace `apps/native/app/push-settings.tsx` with notification settings that
  reflect real channels:
  - appointment alerts on/off.
  - local device alerts on/off.
  - SMS alerts shown as unavailable until configured.
- Add a notification inbox screen/list:
  - unread and recent notifications.
  - read/read-all actions.
  - tap routes to the relevant app destination.
- Add an unread badge in the settings area or bottom navigation.
- Add native API client wiring for notifications and preferences.

Acceptance:

- Staff can see unread and recent notifications.
- Tapping an appointment notification opens the calendar appointment.
- Read/read-all updates are persisted on the server.
- SMS controls are visible only as unavailable/future-ready, not as a working
  toggle.

### Phase 4 — Local Device Alerts After Sync

Goal: provide native device-level alerts without relying on Expo Push, FCM, or
APNS remote delivery.

- Add local notification support in the native app.
- Add a lightweight sync hook:
  - fetch unread notifications on launch.
  - fetch on foreground.
  - fetch after today/calendar refresh.
  - detect newly seen unread notification ids.
  - show a local notification for new unread items when local alerts are enabled.
- Route local notification taps to the stored notification route.

Acceptance:

- A newly synced unread appointment notification can display a local device alert.
- Local alerts respect `local_alerts_enabled`.
- Re-syncing the same unread notification does not repeatedly alert.
- Tap routing works from the local notification.

### Phase 5 — Development Test Path

Goal: make QA possible without creating real appointment data every time.

- Add `POST /api/notifications/test` for development/staging only.
- Gate the route with an env flag such as `ENABLE_NOTIFICATION_TEST=1`.
- Create a test notification for the current user using the same in-app/local
  sync path as production notifications.

Acceptance:

- Test route is unavailable in production by default.
- Test notification appears in the inbox.
- Local alert can be verified from the test notification when enabled.

### Phase 6 — SMS Provider Adapter Later

Goal: prepare for SMS without committing to a provider now.

- Keep SMS disabled until a provider is chosen.
- Add an SMS adapter interface when we are ready to integrate:
  - `sendSmsNotification(...)`
  - returns `skipped` when no provider is configured.
  - records provider response/error in `notification_deliveries`.
- Add env placeholders only when implementing the adapter:
  - `SMS_PROVIDER=`
  - `SMS_API_URL=`
  - `SMS_API_KEY=`
  - `SMS_SENDER=`
  - `SMS_ENABLED=false`
- Do not hard-code an Iranian provider in the notification core.

Acceptance:

- With no provider configured, SMS delivery is skipped cleanly.
- With a provider configured later, appointment-created notifications can be sent
  through SMS without changing appointment routes or native inbox APIs.

### Phase 7 — Android Regional Push Later

Goal: optionally add a regional Android push provider if needed.

- Evaluate provider SDK support, React Native compatibility, operational
  reliability, and legal/compliance posture.
- Add provider-specific registration and delivery behind the notification adapter
  interface.
- Keep iOS remote push separate; APNS constraints must be cleared before adding
  iOS push.

Acceptance:

- Android regional push can be enabled without replacing the in-app inbox or SMS
  adapter design.
- Provider failures do not block notification creation.

## Testing

- Phase 1: unit/API tests for notification creation, tenant scoping, read state,
  and preferences.
- Phase 2: tests proving appointment creation creates exactly one staff
  notification when expected.
- Phase 3: manual native QA for inbox, settings, read state, unread badge, and
  tap routing.
- Phase 4: manual native QA for local notification display, duplicate
  suppression, preference handling, and tap routing.
- Phase 5: verify test route env gating.
- Phase 6: test SMS adapter returns `skipped` when no provider is configured.
- Always regression check existing PWA web push for web subscribers.

## Out of Scope

- Expo Push as a production dependency.
- Direct FCM/APNS native push.
- SMS provider selection or provider-specific integration.
- Android regional push SDK integration.
- Rich notifications, notification categories, or action buttons.
- Retention and appointment lifecycle notifications.
