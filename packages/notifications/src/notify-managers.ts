import { getAppointmentRequestNotificationContext } from '@repo/database/appointment-requests'
import { listManagerUserIdsForSalon } from '@repo/database/members'
import {
  createNotificationForUserOnce,
  dispatchNotification,
  getNotificationPreferences,
} from '@repo/database/notifications'
import { getClientFollowUpMessageContext } from '@repo/database/clients'
import { createNotificationForUser } from './notifications'
import { isWebPushConfigured, sendWebPushToUser } from './push'
import { renderAppointmentRequestPending } from './templates/appointment-request'

export type NotifyManagersOfNewAppointmentRequestOptions = {
  /** When set, deep-link buttons use an absolute URL; otherwise a path-only link is used. */
  publicAppBaseUrl?: string | null
}

export async function notifyManagersOfNewAppointmentRequest(
  requestId: string,
  options: NotifyManagersOfNewAppointmentRequestOptions = {},
): Promise<void> {
  const ctx = await getAppointmentRequestNotificationContext(requestId)
  if (!ctx) return
  const managerIds = await listManagerUserIdsForSalon(ctx.salonId)
  if (managerIds.length === 0) {
    console.warn(
      '[notifications] no managers to notify for appointment request',
      {
        requestId,
        salonId: ctx.salonId,
      },
    )
    return
  }

  const deepLinkPath = `/requests?focus=${ctx.requestId}`
  const baseUrl = options.publicAppBaseUrl?.trim() ?? ''
  const deepLinkUrl = baseUrl
    ? `${baseUrl.replace(/\/$/, '')}${deepLinkPath}`
    : deepLinkPath
  const template = renderAppointmentRequestPending({
    requestId: ctx.requestId,
    salonName: ctx.salonName,
    customerName: ctx.customerName,
    customerPhone: ctx.customerPhone,
    serviceName: ctx.serviceName,
    date: ctx.requestedDate,
    startTime: ctx.requestedStartTime,
    deepLinkUrl,
  })

  await Promise.all(
    managerIds.map((userId) =>
      createNotificationForUser({
        salonId: ctx.salonId,
        userId,
        type: 'appointment_request_pending',
        title: template.title,
        body: template.body,
        route: deepLinkPath,
        data: template.data,
        ...(template.buttons ? { messagingButtons: template.buttons } : {}),
      }).catch((err) => {
        console.error('[notifications] notify manager failed', {
          userId,
          requestId,
          err,
        })
      }),
    ),
  )
}

export async function notifyManagersOfBirthdayFollowUp(
  salonId: string,
  followUpId: string,
): Promise<void> {
  const context = await getClientFollowUpMessageContext(salonId, followUpId)
  if (!context || context.followUp.reason !== 'birthday') return
  const managerIds = await listManagerUserIdsForSalon(context.salon.id)

  await Promise.all(
    managerIds.map(async (userId) => {
      const notification = await createNotificationForUserOnce({
        salonId: context.salon.id,
        userId,
        type: 'birthday_follow_up',
        title: `تولد ${context.client.name} نزدیک است`,
        body: 'برای تماس یا ارسال پیام، صف پیگیری مشتریان را باز کنید.',
        route: '/retention',
        sourceKey: followUpId,
        data: { followUpId, clientId: context.client.id },
      })
      if (!notification) return

      await dispatchNotification(notification.id, 'in_app')
      const preferences = await getNotificationPreferences(
        context.salon.id,
        userId,
      )
      if (preferences.localAlertsEnabled && isWebPushConfigured()) {
        await sendWebPushToUser(userId, {
          title: notification.title,
          body: notification.body,
          url: '/retention',
          tag: `birthday-follow-up-${followUpId}`,
        })
      }
    }),
  )
}
