import type { ApiClient } from './client'
import { endpoints } from './endpoints'

export type NotificationType = 'appointment_created'

export type AppNotification = {
  id: string
  salonId: string
  userId: string
  type: NotificationType
  title: string
  body: string
  route: string
  data: Record<string, unknown>
  readAt: string | null
  createdAt: string
}

export type NotificationPreferences = {
  salonId: string
  userId: string
  appointmentAlertsEnabled: boolean
  localAlertsEnabled: boolean
  smsAlertsEnabled: boolean
  createdAt: string
  updatedAt: string
}

export type NotificationsResponse = {
  notifications: AppNotification[]
}

export type NotificationResponse = {
  notification: AppNotification
}

export type MarkAllNotificationsReadResponse = {
  success: true
  updatedCount: number
}

export type NotificationPreferencesResponse = {
  preferences: NotificationPreferences
}

export type UpdateNotificationPreferencesInput = {
  appointmentAlertsEnabled?: boolean
  localAlertsEnabled?: boolean
  smsAlertsEnabled?: boolean
}

export function createNotificationsApi(client: ApiClient) {
  return {
    list(
      input: { unreadOnly?: boolean } = {},
      opts: { signal?: AbortSignal } = {}
    ) {
      const params = new URLSearchParams()
      if (input.unreadOnly) params.set('unreadOnly', 'true')
      const query = params.toString()
      return client.request<NotificationsResponse>(
        `${endpoints.notifications}${query ? `?${query}` : ''}`,
        { signal: opts.signal }
      )
    },
    markRead(id: string, opts: { signal?: AbortSignal } = {}) {
      return client.request<NotificationResponse>(
        `${endpoints.notifications}/${id}/read`,
        {
          method: 'POST',
          signal: opts.signal,
        }
      )
    },
    markAllRead(opts: { signal?: AbortSignal } = {}) {
      return client.request<MarkAllNotificationsReadResponse>(
        `${endpoints.notifications}/read-all`,
        {
          method: 'POST',
          signal: opts.signal,
        }
      )
    },
    createTest(opts: { signal?: AbortSignal } = {}) {
      return client.request<NotificationResponse>(endpoints.notificationTest, {
        method: 'POST',
        signal: opts.signal,
      })
    },
  }
}

export function createNotificationPreferencesApi(client: ApiClient) {
  return {
    get(opts: { signal?: AbortSignal } = {}) {
      return client.request<NotificationPreferencesResponse>(
        endpoints.notificationPreferences,
        { signal: opts.signal }
      )
    },
    update(
      input: UpdateNotificationPreferencesInput,
      opts: { signal?: AbortSignal } = {}
    ) {
      return client.request<NotificationPreferencesResponse>(
        endpoints.notificationPreferences,
        {
          method: 'PATCH',
          body: input,
          signal: opts.signal,
        }
      )
    },
  }
}

export type NotificationsApi = ReturnType<typeof createNotificationsApi>
export type NotificationPreferencesApi = ReturnType<
  typeof createNotificationPreferencesApi
>
