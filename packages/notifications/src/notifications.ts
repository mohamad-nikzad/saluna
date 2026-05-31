import {
  createNotificationForUser as createNotificationRecordForUser,
  dispatchNotification as recordNotificationDelivery,
  getNotificationPreferences,
  listNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
  type CreateNotificationInput,
} from '@repo/database/notifications'
import {
  findAccountByUserAndProvider,
  type MessagingProviderId,
} from '@repo/database/messaging'
import { listConfiguredMessagingProviders } from './providers/registry'
import { sendSmsNotification } from './sms'

/**
 * Optional hook so the dispatcher can consult per-salon enablement without
 * reaching into the public-settings query module from inside this package.
 * Phase 0 leaves this `undefined`; Phase 1 wires it.
 */
type SalonProviderGate = (
  salonId: string,
  provider: MessagingProviderId
) => Promise<boolean>

let salonProviderGate: SalonProviderGate | undefined

export function setSalonMessagingProviderGate(gate: SalonProviderGate | undefined): void {
  salonProviderGate = gate
}

export async function createNotificationForUser(input: CreateNotificationInput) {
  const notification = await createNotificationRecordForUser(input)
  await recordNotificationDelivery(notification.id, 'in_app')

  const smsDelivery = await sendSmsNotification(notification)
  await recordNotificationDelivery(notification.id, 'sms', smsDelivery.status, {
    provider: smsDelivery.provider,
    providerMessageId: smsDelivery.providerMessageId,
    error: smsDelivery.error,
  })

  for (const provider of listConfiguredMessagingProviders()) {
    if (salonProviderGate) {
      const allowed = await salonProviderGate(notification.salonId, provider.id)
      if (!allowed) {
        await recordNotificationDelivery(notification.id, provider.id, 'skipped', {
          provider: provider.id,
          error: 'salon_disabled',
        })
        continue
      }
    }

    const account = await findAccountByUserAndProvider(notification.userId, provider.id)
    if (!account || !account.enabled) {
      await recordNotificationDelivery(notification.id, provider.id, 'skipped', {
        provider: provider.id,
        error: account ? 'user_disabled' : 'not_linked',
      })
      continue
    }

    const result = await provider.send({
      notificationId: notification.id,
      externalId: account.externalId,
      title: notification.title,
      body: notification.body,
    })
    await recordNotificationDelivery(notification.id, provider.id, result.status, {
      provider: provider.id,
      providerMessageId: result.providerMessageId ?? null,
      error: result.error ?? null,
    })
  }

  return notification
}

export const dispatchNotification = recordNotificationDelivery
export { sendSmsNotification }
export {
  type AppNotification,
  type CreateNotificationInput,
  type ListNotificationsInput,
  type NotificationChannel,
  type NotificationDeliveryStatus,
  type NotificationPreferences,
  type NotificationType,
  type UpdateNotificationPreferencesInput,
} from '@repo/database/notifications'
export {
  getNotificationPreferences,
  listNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
}
