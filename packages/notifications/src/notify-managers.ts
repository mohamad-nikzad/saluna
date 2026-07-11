import { getAppointmentRequestNotificationContext } from '@repo/database/appointment-requests'
import { listManagerUserIdsForSalon } from '@repo/database/members'
import { createNotificationForUser } from './notifications'
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
