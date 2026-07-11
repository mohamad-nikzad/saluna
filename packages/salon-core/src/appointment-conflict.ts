import type { Appointment } from './types'

/** Statuses that occupy the calendar for conflict purposes (per scheduling plan). */
export function isBlockingAppointmentStatus(
  status: Appointment['status'],
): boolean {
  return status === 'scheduled' || status === 'confirmed'
}

/** Overlap on the same calendar day using HH:mm lexical order (same as existing storage). */
export function appointmentIntervalsConflict(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart < bEnd && aEnd > bStart
}

export function hasAppointmentConflict(
  appointments: Pick<
    Appointment,
    'staffId' | 'date' | 'startTime' | 'endTime' | 'status' | 'id'
  >[],
  staffId: string,
  date: string,
  startTime: string,
  endTime: string,
  excludeId?: string,
): boolean {
  for (const apt of appointments) {
    if (apt.staffId !== staffId || apt.date !== date) continue
    if (!isBlockingAppointmentStatus(apt.status)) continue
    if (excludeId && apt.id === excludeId) continue
    if (
      appointmentIntervalsConflict(
        apt.startTime,
        apt.endTime,
        startTime,
        endTime,
      )
    ) {
      return true
    }
  }
  return false
}

export type ScheduleConflictRow = Pick<
  Appointment,
  'id' | 'staffId' | 'clientId' | 'date' | 'startTime' | 'endTime' | 'status'
> & { salonId?: string }

export type ScheduleOverlapFlags = {
  staffConflict: boolean
  clientConflict: boolean
}

export const SCHEDULE_CONFLICT_CODES = {
  STAFF_OVERLAP: 'STAFF_OVERLAP',
  CLIENT_OVERLAP: 'CLIENT_OVERLAP',
} as const

export type ScheduleConflictCode =
  (typeof SCHEDULE_CONFLICT_CODES)[keyof typeof SCHEDULE_CONFLICT_CODES]

/**
 * Detect staff vs client overlap against a candidate window (same day).
 * Cancelled / completed / no-show do not block; excludeId skips the current appointment on edit.
 */
export function detectScheduleOverlaps(
  rows: ScheduleConflictRow[],
  params: {
    staffId: string
    clientId: string
    date: string
    startTime: string
    endTime: string
    excludeId?: string
    salonId?: string
  },
): ScheduleOverlapFlags {
  const { staffId, clientId, date, startTime, endTime, excludeId, salonId } =
    params
  let staffConflict = false
  let clientConflict = false

  for (const apt of rows) {
    if (salonId && apt.salonId && apt.salonId !== salonId) continue
    if (apt.date !== date) continue
    if (excludeId && apt.id === excludeId) continue
    if (!isBlockingAppointmentStatus(apt.status)) continue
    if (
      !appointmentIntervalsConflict(
        apt.startTime,
        apt.endTime,
        startTime,
        endTime,
      )
    )
      continue
    if (apt.staffId === staffId) staffConflict = true
    if (apt.clientId === clientId) clientConflict = true
  }

  return { staffConflict, clientConflict }
}
