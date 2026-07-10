import { resolveStaffNotificationRecipient } from '@repo/database/staff'
import { createNotificationForUser } from './notifications'
import type { AppNotification } from './notifications'

export type NotifyStaffOfAppointmentCreatedInput = {
  salonId: string
  /** Appointment staff id — verified user id or Staff Profile id. */
  staffId: string
  /** Actor who created the appointment; skipped when they are the recipient. */
  actorUserId: string
  appointment: {
    id: string
    date: string
    startTime: string
    clientId: string
    staffId: string
    serviceId: string
  }
  clientName: string
  serviceName: string
}

/**
 * Notify the verified identity with active Staff Profile Access for the
 * appointment's staff assignment. Pending/declined/expired/revoked access
 * yields no notification. Salon context is always included.
 */
export async function notifyStaffOfAppointmentCreated(
  input: NotifyStaffOfAppointmentCreatedInput,
): Promise<AppNotification | null> {
  const recipient = await resolveStaffNotificationRecipient({
    salonId: input.salonId,
    staffId: input.staffId,
  })
  if (!recipient) return null
  if (recipient.userId === input.actorUserId) return null

  const route = `/(tabs)/calendar?date=${input.appointment.date}&appointmentId=${input.appointment.id}`
  const title = `نوبت جدید — ${recipient.salonName}`
  const body = `${input.clientName}، ${input.serviceName}، ${input.appointment.date} ساعت ${input.appointment.startTime}`

  return createNotificationForUser({
    salonId: recipient.salonId,
    userId: recipient.userId,
    type: 'appointment_created',
    title,
    body,
    route,
    data: {
      appointmentId: input.appointment.id,
      date: input.appointment.date,
      route,
      title,
      body,
      clientId: input.appointment.clientId,
      staffId: input.appointment.staffId,
      serviceId: input.appointment.serviceId,
      startTime: input.appointment.startTime,
      salonId: recipient.salonId,
      salonName: recipient.salonName,
      staffProfileId: recipient.staffProfileId,
    },
  })
}
