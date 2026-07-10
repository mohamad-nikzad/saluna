import {
  createNotificationForUser as createNotificationRecordForUser,
  dispatchNotification as recordNotificationDelivery,
  getNotificationPreferences,
  listNotificationsForUser,
  listNotificationsForUserAcrossSalons,
  markAllNotificationsRead,
  markAllNotificationsReadAcrossSalons,
  markNotificationRead,
  markNotificationReadAcrossSalons,
  updateNotificationPreferences,
  type AppNotification,
  type CreateNotificationInput,
  type NotificationPreferences,
} from '@repo/database/notifications'
import {
  findAccountByUserAndProvider,
  type MessagingProviderId,
} from '@repo/database/messaging'
import { getEnabledMessagingProvidersForSalon } from '@repo/database/public'
import { getUserById } from '@repo/database/auth-users'
import { listConfiguredMessagingProviders } from './providers/registry'
import {
  getBaleSafirConfig,
  sendBaleSafirMessage,
} from './providers/bale-safir'
import type { MessagingButton } from './providers/types'
import { sendSmsNotification } from './sms'

export type CreateNotificationForUserInput = CreateNotificationInput & {
  /** When set (e.g. in tests), skips loading salon messaging settings from the database. */
  enabledProviders?: Set<MessagingProviderId>
  messagingButtons?: MessagingButton[][]
}

function isAppointmentRequestNotification(type: string): boolean {
  return type === 'appointment_request_pending' || type.startsWith('appointment_request_')
}

function isStaffAppointmentCreatedNotification(type: string): boolean {
  return type === 'appointment_created'
}

async function deliverInApp(notification: AppNotification) {
  await recordNotificationDelivery(notification.id, 'in_app')
}

async function deliverSms(notification: AppNotification) {
  const smsDelivery = await sendSmsNotification(notification)
  await recordNotificationDelivery(notification.id, 'sms', smsDelivery.status, {
    provider: smsDelivery.provider,
    providerMessageId: smsDelivery.providerMessageId,
    error: smsDelivery.error,
  })
}

async function deliverMessagingChannels(
  notification: AppNotification,
  preferences: NotificationPreferences,
  salonEnabledProviders: Set<MessagingProviderId>,
  messagingButtons?: MessagingButton[][]
) {
  const gateOnAppointmentAlerts = isAppointmentRequestNotification(notification.type)

  for (const provider of listConfiguredMessagingProviders()) {
    // appointment_alerts_disabled applies only to appointment-request notifications;
    // other types deliver when the user has a linked account.
    if (gateOnAppointmentAlerts && !preferences.appointmentAlertsEnabled) {
      const error = 'appointment_alerts_disabled'
      if (provider.id === 'telegram') {
        console.warn('[notifications] telegram skipped', {
          notificationId: notification.id,
          userId: notification.userId,
          salonId: notification.salonId,
          error,
        })
      }
      await recordNotificationDelivery(notification.id, provider.id, 'skipped', {
        provider: provider.id,
        error,
      })
      continue
    }

    if (!salonEnabledProviders.has(provider.id)) {
      const error = 'salon_disabled'
      if (gateOnAppointmentAlerts && provider.id === 'telegram') {
        console.warn('[notifications] telegram skipped', {
          notificationId: notification.id,
          userId: notification.userId,
          salonId: notification.salonId,
          error,
        })
      }
      await recordNotificationDelivery(notification.id, provider.id, 'skipped', {
        provider: provider.id,
        error,
      })
      continue
    }

    const account = await findAccountByUserAndProvider(notification.userId, provider.id)
    if (!account || !account.enabled) {
      const error = account ? 'user_disabled' : 'not_linked'
      if (gateOnAppointmentAlerts && provider.id === 'telegram') {
        console.warn('[notifications] telegram skipped', {
          notificationId: notification.id,
          userId: notification.userId,
          salonId: notification.salonId,
          error,
        })
      }
      await recordNotificationDelivery(notification.id, provider.id, 'skipped', {
        provider: provider.id,
        error,
      })
      continue
    }

    const result = await provider.send({
      notificationId: notification.id,
      externalId: account.externalId,
      title: notification.title,
      body: notification.body,
      ...(messagingButtons ? { buttons: messagingButtons } : {}),
    })
    await recordNotificationDelivery(notification.id, provider.id, result.status, {
      provider: provider.id,
      providerMessageId: result.providerMessageId ?? null,
      error: result.error ?? null,
    })
  }
}

async function deliverBaleSafirStaffFallback(
  notification: AppNotification,
  salonEnabledProviders: Set<MessagingProviderId>
) {
  if (!isStaffAppointmentCreatedNotification(notification.type)) return

  const safirConfig = getBaleSafirConfig()
  const salonHasBaleEnabled = salonEnabledProviders.has('bale')
  if (!salonHasBaleEnabled && !safirConfig) return

  if (!salonHasBaleEnabled) {
    await recordNotificationDelivery(notification.id, 'bale', 'skipped', {
      provider: 'bale_safir',
      error: 'salon_disabled',
    })
    return
  }

  const account = await findAccountByUserAndProvider(notification.userId, 'bale')
  if (account?.enabled) return
  if (account && !account.enabled) {
    await recordNotificationDelivery(notification.id, 'bale', 'skipped', {
      provider: 'bale_safir',
      error: 'user_disabled',
    })
    return
  }

  if (!safirConfig) {
    await recordNotificationDelivery(notification.id, 'bale', 'skipped', {
      provider: 'bale_safir',
      error: 'safir_not_configured',
    })
    return
  }

  const staff = await getUserById(notification.userId)
  const phone = staff?.phone.trim()
  if (!phone) {
    await recordNotificationDelivery(notification.id, 'bale', 'skipped', {
      provider: 'bale_safir',
      error: 'missing_phone',
    })
    return
  }

  const result = await sendBaleSafirMessage({
    phone,
    text: `${notification.title}\n${notification.body}`,
    requestId: `notification:${notification.id}:bale_safir`,
  })
  await recordNotificationDelivery(notification.id, 'bale', result.status, {
    provider: 'bale_safir',
    providerMessageId: result.providerMessageId ?? null,
    error: result.error ?? null,
  })
}

export async function createNotificationForUser(input: CreateNotificationForUserInput) {
  const { enabledProviders: enabledProvidersOverride, messagingButtons, ...createInput } = input
  const notification = await createNotificationRecordForUser(createInput)

  await deliverInApp(notification)
  await deliverSms(notification)

  const preferences = await getNotificationPreferences(
    notification.salonId,
    notification.userId
  )
  const salonEnabledProviders =
    enabledProvidersOverride ??
    new Set(await getEnabledMessagingProvidersForSalon(notification.salonId))

  await deliverMessagingChannels(
    notification,
    preferences,
    salonEnabledProviders,
    messagingButtons
  )
  await deliverBaleSafirStaffFallback(notification, salonEnabledProviders)

  return notification
}

export const dispatchNotification = recordNotificationDelivery
export {
  buildSmsDeliveryConfigFromEnv,
  initSmsDelivery,
  sendSmsBulk,
  sendSmsNotification,
  sendSmsOtp,
  sendSmsText,
  setSmsFetchForTests,
  type SmsBulkInput,
  type SmsDeliveryConfig,
  type SmsDeliveryResult,
  type SmsEnvVars,
  type SmsIrConfig,
  type SmsOtpInput,
  type SmsProvider,
  type SmsProviderId,
  type SmsPurpose,
  type SmsTextInput,
} from './sms'
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
  listNotificationsForUserAcrossSalons,
  markAllNotificationsRead,
  markAllNotificationsReadAcrossSalons,
  markNotificationRead,
  markNotificationReadAcrossSalons,
  updateNotificationPreferences,
}
