import {
  createNotificationForUser as createNotificationRecordForUser,
  dispatchNotification,
  getNotificationPreferences,
  listNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
  type CreateNotificationInput,
} from '@repo/database/notifications'

export async function createNotificationForUser(input: CreateNotificationInput) {
  const notification = await createNotificationRecordForUser(input)
  await dispatchNotification(notification.id, 'in_app')
  return notification
}

export {
  dispatchNotification,
  getNotificationPreferences,
  listNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
  type AppNotification,
  type CreateNotificationInput,
  type ListNotificationsInput,
  type NotificationChannel,
  type NotificationDeliveryStatus,
  type NotificationPreferences,
  type NotificationType,
  type UpdateNotificationPreferencesInput,
} from '@repo/database/notifications'
