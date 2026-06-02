import { isBlockingAppointmentStatus } from './appointment-conflict'
import type { Appointment } from './types'

export const AVAILABILITY_EMPTY_REASONS = {
  NO_QUALIFIED_STAFF: 'NO_QUALIFIED_STAFF',
  SALON_CLOSED: 'SALON_CLOSED',
  STAFF_OFF_DAY: 'STAFF_OFF_DAY',
  ALL_QUALIFIED_STAFF_OFF_DAY: 'ALL_QUALIFIED_STAFF_OFF_DAY',
  FULLY_BOOKED: 'FULLY_BOOKED',
  OUTSIDE_SEARCH_WINDOW: 'OUTSIDE_SEARCH_WINDOW',
} as const

export type AvailabilityEmptyReason =
  (typeof AVAILABILITY_EMPTY_REASONS)[keyof typeof AVAILABILITY_EMPTY_REASONS]

export type AvailabilityMode = 'day' | 'nearest'

export type AvailabilitySlot = {
  date: string
  startTime: string
  endTime: string
  staffId: string
  staffName: string
}

export type AvailabilityResponse =
  | {
      mode: 'day'
      slots: AvailabilitySlot[]
      emptyReason?: AvailabilityEmptyReason
    }
  | {
      mode: 'nearest'
      slot: AvailabilitySlot | null
      emptyReason?: AvailabilityEmptyReason
    }

export type AvailabilityStaffDay = {
  staffId: string
  staffName: string
  workingHours: {
    workingStart: string
    workingEnd: string
  } | null
  appointments: Array<Pick<Appointment, 'startTime' | 'endTime' | 'status'>>
}

type AvailabilityRange = {
  startTime: string
  endTime: string
}

type DaySearchMode = 'any' | 'specific'

type DayAvailabilityInput = {
  date: string
  staffDays: AvailabilityStaffDay[]
  serviceDurationMinutes: number
  slotDurationMinutes: number
  searchMode: DaySearchMode
  todayDate?: string
  nowTime?: string
}

type DayAvailabilityResult = {
  slots: AvailabilitySlot[]
  emptyReason?: AvailabilityEmptyReason
}

type NearestAvailabilityInput = {
  days: Array<Pick<DayAvailabilityInput, 'date' | 'staffDays'>>
  serviceDurationMinutes: number
  slotDurationMinutes: number
  searchMode: DaySearchMode
  todayDate?: string
  nowTime?: string
}

function hmToMinutes(hm: string): number {
  const [hoursPart = '0', minutesPart = '0'] = hm.split(':')
  const hours = Number(hoursPart)
  const minutes = Number(minutesPart)
  return hours * 60 + minutes
}

function minutesToHm(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function addMinutesHm(hm: string, deltaMinutes: number): string {
  return minutesToHm(hmToMinutes(hm) + deltaMinutes)
}

function roundUpToSlotBoundary(hm: string, slotDurationMinutes: number): string {
  const minutes = hmToMinutes(hm)
  const rounded =
    Math.ceil(minutes / slotDurationMinutes) * slotDurationMinutes
  return minutesToHm(rounded)
}

function maxHm(a: string, b: string): string {
  return a >= b ? a : b
}

function compareSlots(a: AvailabilitySlot, b: AvailabilitySlot): number {
  if (a.date !== b.date) {
    return a.date.localeCompare(b.date)
  }
  if (a.startTime !== b.startTime) {
    return a.startTime.localeCompare(b.startTime)
  }
  return a.staffName.localeCompare(b.staffName, 'fa')
}

function buildFreeRanges(
  workingStart: string,
  workingEnd: string,
  appointments: AvailabilityStaffDay['appointments']
): AvailabilityRange[] {
  const ranges: AvailabilityRange[] = []
  const blockingAppointments = appointments
    .filter((appointment) => isBlockingAppointmentStatus(appointment.status))
    .slice()
    .sort((a, b) => a.startTime.localeCompare(b.startTime))

  let cursor = workingStart

  for (const appointment of blockingAppointments) {
    const blockedStart = maxHm(workingStart, appointment.startTime)
    const blockedEnd = appointment.endTime <= workingEnd ? appointment.endTime : workingEnd

    if (blockedEnd <= cursor) {
      continue
    }

    if (blockedStart > cursor) {
      ranges.push({ startTime: cursor, endTime: blockedStart })
    }

    cursor = blockedEnd
    if (cursor >= workingEnd) {
      break
    }
  }

  if (cursor < workingEnd) {
    ranges.push({ startTime: cursor, endTime: workingEnd })
  }

  return ranges
}

function expandRangeToSlots(input: {
  range: AvailabilityRange
  date: string
  staffId: string
  staffName: string
  serviceDurationMinutes: number
  slotDurationMinutes: number
  minStartTime?: string
}): AvailabilitySlot[] {
  const {
    range,
    date,
    staffId,
    staffName,
    serviceDurationMinutes,
    slotDurationMinutes,
    minStartTime,
  } = input

  const effectiveStart = minStartTime
    ? maxHm(range.startTime, minStartTime)
    : range.startTime
  let cursor = roundUpToSlotBoundary(effectiveStart, slotDurationMinutes)
  const slots: AvailabilitySlot[] = []

  while (addMinutesHm(cursor, serviceDurationMinutes) <= range.endTime) {
    slots.push({
      date,
      startTime: cursor,
      endTime: addMinutesHm(cursor, serviceDurationMinutes),
      staffId,
      staffName,
    })
    cursor = addMinutesHm(cursor, slotDurationMinutes)
  }

  return slots
}

export function getAvailabilityForDay(input: DayAvailabilityInput): DayAvailabilityResult {
  if (input.staffDays.length === 0) {
    return {
      slots: [],
      emptyReason: AVAILABILITY_EMPTY_REASONS.NO_QUALIFIED_STAFF,
    }
  }

  const isToday =
    input.todayDate != null &&
    input.nowTime != null &&
    input.date === input.todayDate
  const minStartTime = isToday
    ? roundUpToSlotBoundary(input.nowTime!, input.slotDurationMinutes)
    : undefined

  let workingStaffCount = 0
  const slots: AvailabilitySlot[] = []

  for (const staffDay of input.staffDays) {
    if (!staffDay.workingHours) {
      continue
    }

    workingStaffCount += 1

    const ranges = buildFreeRanges(
      staffDay.workingHours.workingStart,
      staffDay.workingHours.workingEnd,
      staffDay.appointments
    )

    for (const range of ranges) {
      slots.push(
        ...expandRangeToSlots({
          range,
          date: input.date,
          staffId: staffDay.staffId,
          staffName: staffDay.staffName,
          serviceDurationMinutes: input.serviceDurationMinutes,
          slotDurationMinutes: input.slotDurationMinutes,
          minStartTime,
        })
      )
    }
  }

  slots.sort(compareSlots)

  if (slots.length > 0) {
    return { slots }
  }

  if (workingStaffCount === 0) {
    return {
      slots: [],
      emptyReason:
        input.searchMode === 'specific'
          ? AVAILABILITY_EMPTY_REASONS.STAFF_OFF_DAY
          : AVAILABILITY_EMPTY_REASONS.ALL_QUALIFIED_STAFF_OFF_DAY,
    }
  }

  return {
    slots: [],
    emptyReason: AVAILABILITY_EMPTY_REASONS.FULLY_BOOKED,
  }
}

export function getNearestAvailability(input: NearestAvailabilityInput): {
  slot: AvailabilitySlot | null
  emptyReason?: AvailabilityEmptyReason
} {
  if (input.days.length === 0) {
    return {
      slot: null,
      emptyReason: AVAILABILITY_EMPTY_REASONS.OUTSIDE_SEARCH_WINDOW,
    }
  }

  if (input.days[0].staffDays.length === 0) {
    return {
      slot: null,
      emptyReason: AVAILABILITY_EMPTY_REASONS.NO_QUALIFIED_STAFF,
    }
  }

  for (const day of input.days) {
    const result = getAvailabilityForDay({
      date: day.date,
      staffDays: day.staffDays,
      serviceDurationMinutes: input.serviceDurationMinutes,
      slotDurationMinutes: input.slotDurationMinutes,
      searchMode: input.searchMode,
      todayDate: input.todayDate,
      nowTime: input.nowTime,
    })

    if (result.slots.length > 0) {
      return { slot: result.slots[0] }
    }
  }

  return {
    slot: null,
    emptyReason: AVAILABILITY_EMPTY_REASONS.OUTSIDE_SEARCH_WINDOW,
  }
}
