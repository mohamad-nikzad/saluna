import type { Appointment, AppointmentWithDetails } from './types'

/** The lead records completion for the whole Appointment. Closed visits need a manager correction. */
export function staffAppointmentStatusActions(
  appointment: Pick<Appointment, 'status' | 'staffAssignments'>,
  staffProfileId: string | undefined,
): Appointment['status'][] {
  const assignment = appointment.staffAssignments.find(
    (assignment) => assignment.staffId === staffProfileId,
  )
  if (!assignment || !['scheduled', 'confirmed'].includes(appointment.status))
    return []
  return [
    ...(appointment.status === 'scheduled' ? ['confirmed' as const] : []),
    ...(assignment.isLead ? ['completed' as const] : []),
    'no-show',
  ]
}

/** Allowlist Client fields so future private fields cannot leak into staff responses. */
export function staffAppointmentView(
  appointment: AppointmentWithDetails,
): AppointmentWithDetails {
  const { statusHistory: _history, ...view } = appointment
  return {
    ...view,
    client: {
      id: appointment.client.id,
      name: appointment.client.name,
      isPlaceholder: appointment.client.isPlaceholder,
    },
  }
}
