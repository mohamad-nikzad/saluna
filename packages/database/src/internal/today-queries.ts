import type { AppointmentWithDetails, TodayAttentionItem, TodayData } from '@repo/salon-core/types'
import { durationMinutesFromRange } from '@repo/salon-core/appointment-time'
import { dayOfWeekFromDate } from '@repo/salon-core/staff-availability'
import { salonCurrentHm, salonHmAfterMinutes, salonTodayYmd } from '@repo/salon-core/salon-local-time'
import { getAppointmentsWithDetailsByDateRange } from './appointment-queries'
import { getClientTagsForClients } from './client-queries'
import { getBusinessSettings } from './settings-queries'
import { getAllStaff, getStaffSchedules } from './staff-queries'

const ACTIVE_TODAY_STATUSES = new Set<AppointmentWithDetails['status']>(['scheduled', 'confirmed'])

function appointmentsByClient(
  appointments: AppointmentWithDetails[]
): Map<string, AppointmentWithDetails[]> {
  const byClient = new Map<string, AppointmentWithDetails[]>()
  for (const appointment of appointments) {
    const list = byClient.get(appointment.clientId) ?? []
    list.push(appointment)
    byClient.set(appointment.clientId, list)
  }
  return byClient
}

function countAppointmentsByStatus(appointments: AppointmentWithDetails[]): TodayData['counts'] {
  const counts: TodayData['counts'] = {
    scheduled: 0,
    confirmed: 0,
    completed: 0,
    cancelled: 0,
    'no-show': 0,
  }
  for (const appointment of appointments) counts[appointment.status] += 1
  return counts
}

export async function getTodayData(
  salonId: string,
  date = salonTodayYmd(),
  staffIdFilter?: string | readonly string[],
): Promise<TodayData> {
  const useLiveClock = date === salonTodayYmd()

  const appointmentsForDay = await getAppointmentsWithDetailsByDateRange(
    salonId,
    date,
    date,
    staffIdFilter
  )
  const [staff, tagsByClient, allClientAppointments, businessHours] = await Promise.all([
    getAllStaff(salonId),
    getClientTagsForClients(
      [...new Set(appointmentsForDay.map((appointment) => appointment.clientId))],
      salonId
    ),
    getAppointmentsWithDetailsByDateRange(salonId, '1900-01-01', date),
    getBusinessSettings(salonId),
  ])

  const historyByClient = appointmentsByClient(allClientAppointments)
  const current = useLiveClock ? salonCurrentHm() : ''
  const plusTwo = useLiveClock ? salonHmAfterMinutes(120) : ''
  const attentionItems: TodayAttentionItem[] = []

  for (const appointment of appointmentsForDay) {
    const clientHistory = historyByClient.get(appointment.clientId) ?? []
    const previousCompleted = clientHistory.filter(
      (row) =>
        row.id !== appointment.id &&
        row.status === 'completed' &&
        `${row.date} ${row.startTime}` < `${appointment.date} ${appointment.startTime}`
    )
    const noShowCount = clientHistory.filter((row) => row.status === 'no-show').length
    const tags = tagsByClient.get(appointment.clientId) ?? []
    const isVip = tags.some((tag) => tag.label.toLowerCase() === 'vip')
    const isSoonWindow =
      useLiveClock &&
      appointment.startTime >= current &&
      appointment.startTime <= plusTwo

    if (
      !staffIdFilter &&
      appointment.client.isPlaceholder &&
      ACTIVE_TODAY_STATUSES.has(appointment.status)
    ) {
      attentionItems.push({
        id: `${appointment.id}:incomplete-client`,
        type: 'incomplete-client',
        title: `${appointment.client.name} هنوز تکمیل نشده است`,
        detail: `${appointment.startTime} با ${appointment.staff.name}`,
        appointmentId: appointment.id,
        clientId: appointment.clientId,
        priority: isSoonWindow ? 1 : 2,
      })
    }

    if (
      isSoonWindow &&
      appointment.status === 'scheduled'
    ) {
      attentionItems.push({
        id: `${appointment.id}:soon`,
        type: 'soon',
        title: `${appointment.client.name} نزدیک است`,
        detail: `${appointment.startTime} با ${appointment.staff.name}`,
        appointmentId: appointment.id,
        clientId: appointment.clientId,
        priority: 2,
      })
    }
    if (useLiveClock && appointment.status === 'confirmed' && appointment.endTime < current) {
      attentionItems.push({
        id: `${appointment.id}:overdue`,
        type: 'overdue',
        title: `${appointment.client.name} نیاز به ثبت نتیجه دارد`,
        detail: `پایان نوبت ${appointment.endTime}`,
        appointmentId: appointment.id,
        clientId: appointment.clientId,
        priority: 1,
      })
    }
    if (noShowCount >= 2) {
      attentionItems.push({
        id: `${appointment.id}:no-show-risk`,
        type: 'no-show-risk',
        title: `${appointment.client.name} سابقه بدقولی دارد`,
        detail: `${noShowCount} غیبت ثبت شده`,
        appointmentId: appointment.id,
        clientId: appointment.clientId,
        priority: 3,
      })
    }
    if (previousCompleted.length === 0) {
      attentionItems.push({
        id: `${appointment.id}:first-time`,
        type: 'first-time',
        title: `${appointment.client.name} مشتری بار اول است`,
        detail: appointment.bookedServiceName,
        appointmentId: appointment.id,
        clientId: appointment.clientId,
        priority: 4,
      })
    }
    if (isVip) {
      attentionItems.push({
        id: `${appointment.id}:vip`,
        type: 'vip',
        title: `${appointment.client.name} VIP است`,
        detail: appointment.bookedServiceName,
        appointmentId: appointment.id,
        clientId: appointment.clientId,
        priority: 2,
      })
    }
  }

  const staffLoad = staff
    .filter((member) => member.role === 'staff' && (!staffIdFilter || member.id === staffIdFilter))
    .map((member) => {
      const rows = appointmentsForDay.filter(
        (appointment) =>
          appointment.staffId === member.id &&
          appointment.status !== 'cancelled' &&
          appointment.status !== 'no-show'
      )
      return {
        staffId: member.id,
        staffName: member.name,
        appointmentCount: rows.length,
        bookedMinutes: rows.reduce(
          (sum, appointment) =>
            sum + durationMinutesFromRange(appointment.startTime, appointment.endTime),
          0
        ),
      }
    })

  const scheduleRows = await Promise.all(
    staffLoad.map(async (load) => [load.staffId, await getStaffSchedules(salonId, load.staffId)] as const)
  )
  const schedulesByStaff = new Map(scheduleRows)

  const openSlots = staffLoad.map((load) => {
    const memberSchedules = schedulesByStaff.get(load.staffId) ?? []
    const schedule = memberSchedules.find((row) => row.dayOfWeek === dayOfWeekFromDate(date))
    if (schedule && !schedule.active) {
      return { staffId: load.staffId, staffName: load.staffName, ranges: [] }
    }
    if (memberSchedules.length > 0 && !schedule) {
      return { staffId: load.staffId, staffName: load.staffName, ranges: [] }
    }

    const start = schedule?.active ? schedule.workingStart : businessHours.workingStart
    const end = schedule?.active ? schedule.workingEnd : businessHours.workingEnd
    const booked = appointmentsForDay
      .filter(
        (appointment) =>
          appointment.staffId === load.staffId &&
          (appointment.status === 'scheduled' || appointment.status === 'confirmed')
      )
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
    const ranges: Array<{ startTime: string; endTime: string }> = []
    let cursor = start

    for (const appointment of booked) {
      if (cursor < appointment.startTime) {
        ranges.push({ startTime: cursor, endTime: appointment.startTime })
      }
      if (cursor < appointment.endTime) cursor = appointment.endTime
    }
    if (cursor < end) ranges.push({ startTime: cursor, endTime: end })

    return { staffId: load.staffId, staffName: load.staffName, ranges }
  })

  return {
    date,
    counts: countAppointmentsByStatus(appointmentsForDay),
    appointments: appointmentsForDay,
    attentionItems: attentionItems.sort((a, b) => a.priority - b.priority),
    staffLoad,
    openSlots,
  }
}
