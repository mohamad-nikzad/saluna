import { and, desc, eq, isNull } from 'drizzle-orm'
import { getDb } from '../client'
import {
  notificationDeliveries,
  notificationPreferences,
  notifications,
} from '../schema'

export type NotificationType =
  | 'appointment_created'
  | 'appointment_request_pending'
  | 'appointment_request_approved'
  | 'appointment_request_rejected'
  | 'appointment_reminder'
export type NotificationChannel =
  | 'in_app'
  | 'local_sync'
  | 'sms'
  | 'android_regional_push'
  | 'telegram'
  | 'bale'
  | 'rubika'
  | 'whatsapp'
export type NotificationDeliveryStatus = 'pending' | 'sent' | 'failed' | 'skipped'
export type CreateNotificationDeliveryInput = {
  provider?: string | null
  providerMessageId?: string | null
  error?: string | null
}

export type AppNotification = {
  id: string
  salonId: string
  userId: string
  type: NotificationType
  title: string
  body: string
  route: string
  data: Record<string, unknown>
  readAt: Date | null
  createdAt: Date
}

export type NotificationPreferences = {
  salonId: string
  userId: string
  appointmentAlertsEnabled: boolean
  localAlertsEnabled: boolean
  smsAlertsEnabled: boolean
  createdAt: Date
  updatedAt: Date
}

export type CreateNotificationInput = {
  salonId: string
  userId: string
  type: NotificationType
  title: string
  body: string
  route: string
  data?: Record<string, unknown>
}

export type ListNotificationsInput = {
  salonId: string
  userId: string
  unreadOnly?: boolean
}

export type UpdateNotificationPreferencesInput = {
  appointmentAlertsEnabled?: boolean
  localAlertsEnabled?: boolean
  smsAlertsEnabled?: boolean
}

function rowToNotification(row: typeof notifications.$inferSelect): AppNotification {
  return {
    id: row.id,
    salonId: row.salonId,
    userId: row.userId,
    type: row.type,
    title: row.title,
    body: row.body,
    route: row.route,
    data: row.data,
    readAt: row.readAt,
    createdAt: row.createdAt,
  }
}

function rowToPreferences(
  row: typeof notificationPreferences.$inferSelect
): NotificationPreferences {
  return {
    salonId: row.salonId,
    userId: row.userId,
    appointmentAlertsEnabled: row.appointmentAlertsEnabled,
    localAlertsEnabled: row.localAlertsEnabled,
    smsAlertsEnabled: row.smsAlertsEnabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function createNotificationForUser(
  input: CreateNotificationInput
): Promise<AppNotification> {
  const db = getDb()
  const [row] = await db
    .insert(notifications)
    .values({
      salonId: input.salonId,
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      route: input.route,
      data: input.data ?? {},
    })
    .returning()

  return rowToNotification(row)
}

export async function listNotificationsForUser(
  input: ListNotificationsInput
): Promise<AppNotification[]> {
  const db = getDb()
  const conditions = [
    eq(notifications.salonId, input.salonId),
    eq(notifications.userId, input.userId),
  ]
  if (input.unreadOnly) {
    conditions.push(isNull(notifications.readAt))
  }

  const rows = await db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(100)

  return rows.map(rowToNotification)
}

export async function markNotificationRead(
  salonId: string,
  userId: string,
  notificationId: string
): Promise<AppNotification | undefined> {
  const db = getDb()
  const [row] = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.salonId, salonId),
        eq(notifications.userId, userId)
      )
    )
    .returning()

  return row ? rowToNotification(row) : undefined
}

export async function markAllNotificationsRead(
  salonId: string,
  userId: string
): Promise<number> {
  const db = getDb()
  const rows = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.salonId, salonId),
        eq(notifications.userId, userId),
        isNull(notifications.readAt)
      )
    )
    .returning({ id: notifications.id })

  return rows.length
}

export async function getNotificationPreferences(
  salonId: string,
  userId: string
): Promise<NotificationPreferences> {
  const db = getDb()
  const [row] = await db
    .insert(notificationPreferences)
    .values({ salonId, userId })
    .onConflictDoNothing()
    .returning()

  if (row) return rowToPreferences(row)

  const [existing] = await db
    .select()
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.salonId, salonId),
        eq(notificationPreferences.userId, userId)
      )
    )
    .limit(1)

  if (!existing) {
    throw new Error('Notification preferences could not be loaded')
  }

  return rowToPreferences(existing)
}

export async function updateNotificationPreferences(
  salonId: string,
  userId: string,
  input: UpdateNotificationPreferencesInput
): Promise<NotificationPreferences> {
  const db = getDb()
  const [row] = await db
    .insert(notificationPreferences)
    .values({
      salonId,
      userId,
      appointmentAlertsEnabled: input.appointmentAlertsEnabled ?? true,
      localAlertsEnabled: input.localAlertsEnabled ?? true,
      smsAlertsEnabled: input.smsAlertsEnabled ?? false,
    })
    .onConflictDoUpdate({
      target: [notificationPreferences.salonId, notificationPreferences.userId],
      set: {
        ...(input.appointmentAlertsEnabled !== undefined
          ? { appointmentAlertsEnabled: input.appointmentAlertsEnabled }
          : {}),
        ...(input.localAlertsEnabled !== undefined
          ? { localAlertsEnabled: input.localAlertsEnabled }
          : {}),
        ...(input.smsAlertsEnabled !== undefined
          ? { smsAlertsEnabled: input.smsAlertsEnabled }
          : {}),
        updatedAt: new Date(),
      },
    })
    .returning()

  return rowToPreferences(row)
}

export async function dispatchNotification(
  notificationId: string,
  channel: NotificationChannel,
  status: NotificationDeliveryStatus = 'sent',
  input: CreateNotificationDeliveryInput = {}
): Promise<void> {
  const db = getDb()
  await db.insert(notificationDeliveries).values({
    notificationId,
    channel,
    status,
    provider: input.provider ?? null,
    providerMessageId: input.providerMessageId ?? null,
    error: input.error ?? null,
    sentAt: status === 'sent' ? new Date() : null,
  })
}
