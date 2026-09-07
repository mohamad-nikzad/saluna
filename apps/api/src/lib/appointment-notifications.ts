import type { Appointment } from '@repo/salon-core/types'
import {
  isWebPushConfigured,
  notifyStaffOfAppointmentCreated,
  sendWebPushToUser,
} from '@repo/notifications'

export async function notifyAssignedStaff(input: {
  salonId: string
  actorUserId: string
  staffIds: string[]
  appointment: Pick<
    Appointment,
    'id' | 'date' | 'startTime' | 'clientId' | 'serviceId'
  >
  clientName: string
  serviceName: string
}) {
  const notifications = await Promise.all(
    [...new Set(input.staffIds)].map((staffId) =>
      notifyStaffOfAppointmentCreated({
        salonId: input.salonId,
        staffId,
        actorUserId: input.actorUserId,
        appointment: { ...input.appointment, staffId },
        clientName: input.clientName,
        serviceName: input.serviceName,
      }),
    ),
  )
  if (!isWebPushConfigured()) return
  for (const notification of notifications) {
    if (!notification) continue
    void sendWebPushToUser(notification.userId, {
      title: notification.title,
      body: notification.body,
      url: `/calendar?date=${input.appointment.date}&appointmentId=${input.appointment.id}`,
      tag: `appointment-${input.appointment.id}`,
    })
  }
}
