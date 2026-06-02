import { normalizeCalendarColorId } from '@repo/salon-core/calendar-colors'
import {
  JALALI_WEEKDAYS_SHORT,
  parseGregorianToJalali,
} from '@repo/salon-core/jalali'
import {
  formatPersianTime,
  toPersianDigits,
} from '@repo/salon-core/persian-digits'
import { salonCurrentHm } from '@repo/salon-core/salon-local-time'
import type {
  AppointmentWithDetails,
  TodayAttentionItem,
  TodayData,
  User,
} from '@repo/salon-core/types'

import { getNextOpenSlot, type NextOpenSlot } from './next-open-slot'

export const ACTIVE_STATUSES = new Set<AppointmentWithDetails['status']>([
  'scheduled',
  'confirmed',
])

export const DAY_WORK_MINUTES = 9 * 60

export const ATTENTION_LABELS: Record<TodayAttentionItem['type'], string> = {
  soon: 'نزدیک',
  overdue: 'ثبت نتیجه',
  'no-show-risk': 'بدقول',
  'first-time': 'اولین مراجعه',
  vip: 'VIP',
  'incomplete-client': 'اطلاعات ناقص',
}

export type GroupedAttentionItem = {
  id: string
  title: string
  detail: string
  clientId?: string
  priority: number
  labels: string[]
}

export type TeamRow = {
  staffId: string
  staffName: string
  appointmentCount: number
  bookedMinutes: number
  color?: string | null
}

export function greetingForHour(hour: number) {
  if (hour < 5) return 'شب بخیر'
  if (hour < 12) return 'صبح بخیر'
  if (hour < 17) return 'وقت بخیر'
  if (hour < 20) return 'عصر بخیر'
  return 'شب بخیر'
}

export function greetingFa() {
  return greetingForHour(Number(salonCurrentHm().slice(0, 2)))
}

export function firstNameOf(name: string) {
  return name.trim().split(/\s+/)[0] || name
}

export function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '؟'
  if (parts.length === 1) return parts[0].slice(0, 2)
  return `${parts[0][0]}${parts[1][0]}`
}

export function staffCssVar(color?: string | null) {
  return `var(--calendar-${normalizeCalendarColorId(color)})`
}

export function buildWeekStrip(dateYmd: string) {
  const base = new Date(`${dateYmd}T00:00:00`)
  const daysSinceSat = (base.getDay() + 1) % 7
  const start = new Date(base)
  start.setDate(base.getDate() - daysSinceSat)
  return Array.from({ length: 7 }, (_, i) => {
    const cur = new Date(start)
    cur.setDate(start.getDate() + i)
    const ymd = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
    return {
      ymd,
      weekday: JALALI_WEEKDAYS_SHORT[i],
      dayNum: toPersianDigits(parseGregorianToJalali(ymd).jd),
    }
  })
}

export function sortAppointments(list: AppointmentWithDetails[]) {
  return [...list].sort((a, b) =>
    `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`),
  )
}

export function bookedServiceWithAddonCount(
  appointment: AppointmentWithDetails,
) {
  if (appointment.bookedAddonCount <= 0) return appointment.bookedServiceName
  return `${appointment.bookedServiceName} +${toPersianDigits(appointment.bookedAddonCount)}`
}

export function summarizeNextOpenSlot(slot: NextOpenSlot | null) {
  if (!slot) {
    return 'بازه آزاد دیگری ندارد'
  }

  const primary = slot.startsNow
    ? `از الان تا ${formatPersianTime(slot.endTime)}`
    : `${formatPersianTime(slot.startTime)} تا ${formatPersianTime(slot.endTime)}`

  if (slot.additionalRanges === 0) {
    return primary
  }

  return `${primary} · ${toPersianDigits(slot.additionalRanges)} بازه دیگر`
}

export function groupAttentionItems(items: TodayAttentionItem[]) {
  const grouped = new Map<string, GroupedAttentionItem>()

  for (const item of items) {
    const key = item.appointmentId ?? item.clientId ?? item.id
    const label = ATTENTION_LABELS[item.type]
    const existing = grouped.get(key)

    if (!existing) {
      grouped.set(key, {
        id: key,
        title: item.title,
        detail: item.detail,
        clientId: item.clientId,
        priority: item.priority,
        labels: [label],
      })
      continue
    }

    if (!existing.labels.includes(label)) {
      existing.labels.push(label)
    }

    if (item.priority < existing.priority) {
      existing.priority = item.priority
      existing.title = item.title
      existing.detail = item.detail
    }
  }

  return [...grouped.values()].sort((a, b) => a.priority - b.priority)
}

export type ManagerTodayViewModel = {
  queue: AppointmentWithDetails[]
  activeCount: number
  attentionItems: GroupedAttentionItem[]
  teamRows: TeamRow[]
  totalAppointments: number
  doneCount: number
  droppedCount: number
  defaultCreateTime: string
}

export function buildManagerTodayViewModel({
  data,
  staff,
}: {
  data?: TodayData
  staff: User[]
}): ManagerTodayViewModel {
  if (!data) {
    return {
      queue: [],
      activeCount: 0,
      attentionItems: [],
      teamRows: [],
      totalAppointments: 0,
      doneCount: 0,
      droppedCount: 0,
      defaultCreateTime: '09:00',
    }
  }

  const queue = sortAppointments(
    data.appointments.filter(
      (appointment) =>
        appointment.status !== 'cancelled' &&
        appointment.status !== 'no-show',
    ),
  )

  const activeCount = data.appointments.filter((a) =>
    ACTIVE_STATUSES.has(a.status),
  ).length

  const attentionItems = groupAttentionItems(data.attentionItems).slice(0, 5)

  const colorById = new Map(staff.map((member) => [member.id, member.color]))
  const teamRows: TeamRow[] = data.staffLoad.map((row) => ({
    ...row,
    color: colorById.get(row.staffId),
  }))

  const totalAppointments = Object.values(data.counts).reduce(
    (sum, count) => sum + count,
    0,
  )
  const doneCount = data.counts.completed ?? 0
  const droppedCount =
    (data.counts.cancelled ?? 0) + (data.counts['no-show'] ?? 0)
  const defaultCreateTime =
    data.openSlots
      .flatMap((slot) => slot.ranges.map((range) => range.startTime))
      .sort()[0] ?? '09:00'

  return {
    queue,
    activeCount,
    attentionItems,
    teamRows,
    totalAppointments,
    doneCount,
    droppedCount,
    defaultCreateTime,
  }
}

export type StaffTodayViewModel = {
  todayAppointments: AppointmentWithDetails[]
  tomorrowAppointments: AppointmentWithDetails[]
  currentAppointment: AppointmentWithDetails | null
  nextAppointment: AppointmentWithDetails | null
  nextOpenSlot: NextOpenSlot | null
  checkingTomorrowOpenSlots: boolean
}

export function buildStaffTodayViewModel({
  todayData,
  tomorrowData,
  clockHm,
  tomorrowLoading,
}: {
  todayData?: TodayData
  tomorrowData?: TodayData
  clockHm: string
  tomorrowLoading: boolean
}): StaffTodayViewModel {
  const todayAppointments = sortAppointments(todayData?.appointments ?? [])
  const tomorrowAppointments = sortAppointments(
    (tomorrowData?.appointments ?? []).filter(
      (appointment) => appointment.status !== 'cancelled',
    ),
  )

  const activeTodayAppointments = todayAppointments.filter((appointment) =>
    ACTIVE_STATUSES.has(appointment.status),
  )

  const currentAppointment =
    activeTodayAppointments.find(
      (appointment) =>
        appointment.startTime <= clockHm && appointment.endTime > clockHm,
    ) ?? null

  const nextAppointment =
    activeTodayAppointments.find(
      (appointment) => appointment.startTime > clockHm,
    ) ?? null

  const todayOpenRanges = todayData?.openSlots[0]?.ranges ?? []
  const tomorrowOpenRanges = tomorrowData?.openSlots[0]?.ranges ?? []

  const nextOpenSlot = getNextOpenSlot({
    todayRanges: todayOpenRanges,
    tomorrowRanges: tomorrowOpenRanges,
    clockHm,
  })

  const checkingTomorrowOpenSlots =
    !getNextOpenSlot({
      todayRanges: todayOpenRanges,
      tomorrowRanges: [],
      clockHm,
    }) &&
    tomorrowLoading &&
    !tomorrowData

  return {
    todayAppointments,
    tomorrowAppointments,
    currentAppointment,
    nextAppointment,
    nextOpenSlot,
    checkingTomorrowOpenSlots,
  }
}
