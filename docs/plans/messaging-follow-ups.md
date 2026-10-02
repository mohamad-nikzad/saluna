# Messaging follow-ups

These are unscheduled proposals from the earlier messaging roadmap. They need
product review before implementation.

Telegram and Bale manager account linking, request approval callbacks, bot
commands, staff appointment-added messages, and manager-triggered Bale retention
messages already exist. Their implementation lives in
[notifications](../../packages/notifications/src/),
[API messaging routes](../../apps/api/src/routes/), and
[PWA messaging settings](../../apps/pwa/src/components/settings/messaging-accounts-section.tsx).

## Staff reminders and manager digests

- Send staff a reminder roughly 60 minutes before their first Appointment of
  the day.
- Send managers a daily 09:00 digest when they have pending AppointmentRequests.
- Use Asia/Tehran for scheduling and deduplicate sends across repeated runs.

The earlier proposal used hourly and daily CLI cron scripts. Choose the scheduler
when this work is scoped; no reminder or digest scheduler has shipped.

## Client notifications

- Let a Client opt into a messaging channel from the public request status page.
- Send the approval or rejection result and Appointment reminders 24 hours and
  2 hours before the Appointment.
- Cancel scheduled reminders when the Appointment is cancelled.

Clients are not login identities. Linking must identify the salon's Client
record. The earlier proposal used separate Client messaging accounts and a
Postgres job queue; those remain design proposals.

[BL-0018](../../backlog/inbox/BL-0018-customer-facing-telegram-and-bale-bot.md)
tracks the related customer bot flow for browsing services and submitting an
AppointmentRequest. Notifications need their own scope before joining that work.

## Additional providers

WhatsApp and Rubika remain unimplemented. Recheck their current API, linking,
webhook verification, message-template requirements, and cost when there is
demand for either provider. Provider identifiers in the API do not imply an
available integration.
