import type { StaffScheduleFormInput } from '@repo/salon-core/forms/staff'
import type { BusinessHours, StaffSchedule } from '@repo/salon-core/types'

import { STAFF_SCHEDULE_DAYS } from '#/components/staff/staff-schedule/days'

export const DEFAULT_WORKING_START = '09:00'
export const DEFAULT_WORKING_END = '19:00'

export function isDefaultScheduleDayActive(dayOfWeek: number): boolean {
  return dayOfWeek !== 5
}

export function defaultScheduleRows(
  hours?: BusinessHours,
): StaffScheduleFormInput {
  return STAFF_SCHEDULE_DAYS.map((day) => ({
    dayOfWeek: day.dayOfWeek,
    active: isDefaultScheduleDayActive(day.dayOfWeek),
    workingStart: hours?.workingStart ?? DEFAULT_WORKING_START,
    workingEnd: hours?.workingEnd ?? DEFAULT_WORKING_END,
  }))
}

export function scheduleRowsByDay(
  schedule: StaffSchedule[] | undefined,
): Map<number, StaffSchedule> {
  return new Map((schedule ?? []).map((row) => [row.dayOfWeek, row]))
}

export function mergeSavedScheduleRows(
  saved: StaffSchedule[],
  hours?: BusinessHours,
): StaffScheduleFormInput {
  const map = scheduleRowsByDay(saved)
  return defaultScheduleRows(hours).map((row) => {
    const existing = map.get(row.dayOfWeek)
    return existing
      ? {
          dayOfWeek: existing.dayOfWeek,
          active: existing.active,
          workingStart: existing.workingStart,
          workingEnd: existing.workingEnd,
        }
      : row
  })
}

export function resolveScheduleDayActive(
  dayOfWeek: number,
  scheduleByDay: Map<number, StaffSchedule>,
): boolean {
  return (
    scheduleByDay.get(dayOfWeek)?.active ??
    isDefaultScheduleDayActive(dayOfWeek)
  )
}

export function resolveScheduleDayTimes(
  dayOfWeek: number,
  scheduleByDay: Map<number, StaffSchedule>,
  hours?: BusinessHours,
): { workingStart: string; workingEnd: string } {
  const row = scheduleByDay.get(dayOfWeek)
  return {
    workingStart:
      row?.workingStart ?? hours?.workingStart ?? DEFAULT_WORKING_START,
    workingEnd: row?.workingEnd ?? hours?.workingEnd ?? DEFAULT_WORKING_END,
  }
}
