import { z } from '@hono/zod-openapi'

const isoDateTimeSchema = z.string().datetime().or(z.string())

export const notificationTypeSchema = z
  .enum([
    'appointment_created',
    'appointment_request_pending',
    'appointment_request_approved',
    'appointment_request_rejected',
    'appointment_reminder',
    'birthday_follow_up',
  ])
  .openapi('NotificationType')

export const appNotificationSchema = z
  .object({
    id: z.string(),
    salonId: z.string(),
    userId: z.string(),
    type: notificationTypeSchema,
    title: z.string(),
    body: z.string(),
    route: z.string(),
    data: z.record(z.string(), z.unknown()),
    readAt: isoDateTimeSchema.nullable(),
    createdAt: isoDateTimeSchema,
  })
  .openapi('AppNotification')

export const notificationsListResponseSchema = z
  .object({
    notifications: z.array(appNotificationSchema),
  })
  .openapi('NotificationsListResponse')

export const notificationResponseSchema = z
  .object({
    notification: appNotificationSchema,
  })
  .openapi('NotificationResponse')

export const markAllNotificationsReadResponseSchema = z
  .object({
    success: z.literal(true),
    updatedCount: z.number().int(),
  })
  .openapi('MarkAllNotificationsReadResponse')

export const listNotificationsQuerySchema = z
  .object({
    unreadOnly: z
      .enum(['true'])
      .optional()
      .openapi({
        param: { name: 'unreadOnly', in: 'query' },
        description: 'When "true", return only unread notifications',
      }),
  })
  .openapi('ListNotificationsQuery')
