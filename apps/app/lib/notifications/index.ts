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
import { sendSmsNotification } from './sms'

export async function createNotificationForUser(input: CreateNotificationInput) {
  const notification = await createNotificationRecordForUser(input)
  await recordNotificationDelivery(notification.id, 'in_app')

  const smsDelivery = await sendSmsNotification(notification)
  await recordNotificationDelivery(notification.id, 'sms', smsDelivery.status, {
    provider: smsDelivery.provider,
    providerMessageId: smsDelivery.providerMessageId,
    error: smsDelivery.error,
  })

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
