import {
  AVAILABILITY_EMPTY_REASONS,
  getAvailabilityForDay,
  getNearestAvailability,
  type AvailabilityMode,
  type AvailabilityResponse,
  type AvailabilityStaffDay,
} from '@repo/salon-core/availability'
import { addDaysYmd, salonCurrentHm, salonTodayYmd } from '@repo/salon-core/salon-local-time'
import { eligibleStaffForService } from '@repo/salon-core/staff-service-autofill'
import { dayOfWeekFromDate, isSalonOpenOnDate, resolveStaffWorkingHoursForDay } from '@repo/salon-core/staff-availability'
import type { Appointment, StaffSchedule, User } from '@repo/salon-core/types'
import { getAppointmentsByDateRange } from './appointment-queries'
import { getBusinessSettings } from './settings-queries'
import { getServiceById } from './service-queries'
import { getAllStaff, getStaffSchedules } from './staff-queries'

export type ManagerAppointmentAvailabilityLookupResult =
  | { ok: true; response: AvailabilityResponse }
  | { ok: false; status: number; error: string }

type LookupParams = {
  salonId: string
  serviceId: string
  date: string
  mode: AvailabilityMode
  staffId?: string
}

function fail(status: number, error: string): ManagerAppointmentAvailabilityLookupResult {
  return { ok: false, status, error }
}

function searchDatesFor(mode: AvailabilityMode, date: string): string[] {
  if (mode === 'day') {
    return [date]
  }
  return Array.from({ length: 7 }, (_, offset) => addDaysYmd(date, offset))
}

function buildAppointmentsByStaffAndDate(
  appointments: Appointment[]
): Map<string, Map<string, Appointment[]>> {
  const byStaff = new Map<string, Map<string, Appointment[]>>()

  for (const appointment of appointments) {
    const byDate = byStaff.get(appointment.staffId) ?? new Map<string, Appointment[]>()
    const list = byDate.get(appointment.date) ?? []
    list.push(appointment)
    byDate.set(appointment.date, list)
    byStaff.set(appointment.staffId, byDate)
  }

  return byStaff
}

function buildStaffDayForDate(input: {
  date: string
  staffMember: User
  schedules: StaffSchedule[]
  businessHours: Awaited<ReturnType<typeof getBusinessSettings>>
  appointmentsByStaffAndDate: Map<string, Map<string, Appointment[]>>
}): AvailabilityStaffDay {
  const dayOfWeek = dayOfWeekFromDate(input.date)
  const schedule = input.schedules.find((row) => row.dayOfWeek === dayOfWeek)
  const workingHours = resolveStaffWorkingHoursForDay({
    schedule,
    hasAnyScheduleRows: input.schedules.length > 0,
    businessHours: input.businessHours,
  })
  const appointments =
    input.appointmentsByStaffAndDate.get(input.staffMember.id)?.get(input.date) ?? []

  return {
    staffId: input.staffMember.id,
    staffName: input.staffMember.name,
    workingHours: workingHours.ok
      ? {
          workingStart: workingHours.hours.workingStart,
          workingEnd: workingHours.hours.workingEnd,
        }
      : null,
    appointments,
  }
}

export async function getManagerAppointmentAvailability(
  params: LookupParams
): Promise<ManagerAppointmentAvailabilityLookupResult> {
  const [service, businessHours, allStaff] = await Promise.all([
    getServiceById(params.serviceId, params.salonId),
    getBusinessSettings(params.salonId),
    getAllStaff(params.salonId),
  ])

  if (!service || !service.active) {
    return fail(404, 'خدمت یافت نشد')
  }

  const activeStaff = allStaff.filter((member) => member.role === 'staff')

  if (params.staffId) {
    const selectedStaff = activeStaff.find((member) => member.id === params.staffId)
    if (!selectedStaff) {
      return fail(404, 'پرسنل یافت نشد')
    }

    const eligibleSelectedStaff = eligibleStaffForService(activeStaff, service.id).some(
      (member) => member.id === params.staffId
    )
    if (!eligibleSelectedStaff) {
      return fail(400, 'این پرسنل برای خدمت انتخاب‌شده تعریف نشده است.')
    }
  }

  const eligibleStaff = params.staffId
    ? activeStaff.filter((member) => member.id === params.staffId)
    : eligibleStaffForService(activeStaff, service.id)

  if (eligibleStaff.length === 0) {
    if (params.mode === 'day') {
      return {
        ok: true,
        response: {
          mode: 'day',
          slots: [],
          emptyReason: AVAILABILITY_EMPTY_REASONS.NO_QUALIFIED_STAFF,
        },
      }
    }

    return {
      ok: true,
      response: {
        mode: 'nearest',
        slot: null,
        emptyReason: AVAILABILITY_EMPTY_REASONS.NO_QUALIFIED_STAFF,
      },
    }
  }

  if (params.mode === 'day' && !isSalonOpenOnDate(businessHours.workingDays, params.date)) {
    return {
      ok: true,
      response: {
        mode: 'day',
        slots: [],
        emptyReason: AVAILABILITY_EMPTY_REASONS.SALON_CLOSED,
      },
    }
  }

  const searchDates = searchDatesFor(params.mode, params.date).filter((date) =>
    isSalonOpenOnDate(businessHours.workingDays, date)
  )

  if (searchDates.length === 0) {
    return {
      ok: true,
      response:
        params.mode === 'day'
          ? {
              mode: 'day',
              slots: [],
              emptyReason: AVAILABILITY_EMPTY_REASONS.SALON_CLOSED,
            }
          : {
              mode: 'nearest',
              slot: null,
              emptyReason: AVAILABILITY_EMPTY_REASONS.SALON_CLOSED,
            },
    }
  }

  const [appointments, schedulesByStaffEntries] = await Promise.all([
    getAppointmentsByDateRange(
      params.salonId,
      searchDates[0]!,
      searchDates[searchDates.length - 1]!
    ),
    Promise.all(
      eligibleStaff.map(async (member) => [member.id, await getStaffSchedules(params.salonId, member.id)] as const)
    ),
  ])

  const appointmentsByStaffAndDate = buildAppointmentsByStaffAndDate(appointments)
  const schedulesByStaff = new Map<string, StaffSchedule[]>(schedulesByStaffEntries)
  const todayDate = salonTodayYmd()
  const nowTime = salonCurrentHm()
  const searchMode = params.staffId ? 'specific' : 'any'

  const buildDay = (date: string) =>
    eligibleStaff.map((staffMember) =>
      buildStaffDayForDate({
        date,
        staffMember,
        schedules: schedulesByStaff.get(staffMember.id) ?? [],
        businessHours,
        appointmentsByStaffAndDate,
      })
    )

  if (params.mode === 'day') {
    const result = getAvailabilityForDay({
      date: params.date,
      staffDays: buildDay(params.date),
      serviceDurationMinutes: service.duration,
      slotDurationMinutes: businessHours.slotDurationMinutes,
      searchMode,
      todayDate,
      nowTime,
    })

    return {
      ok: true,
      response: {
        mode: 'day',
        slots: result.slots,
        ...(result.emptyReason ? { emptyReason: result.emptyReason } : {}),
      },
    }
  }

  const result = getNearestAvailability({
    days: searchDates.map((date) => ({ date, staffDays: buildDay(date) })),
    serviceDurationMinutes: service.duration,
    slotDurationMinutes: businessHours.slotDurationMinutes,
    searchMode,
    todayDate,
    nowTime,
  })

  return {
    ok: true,
    response: {
      mode: 'nearest',
      slot: result.slot,
      ...(result.emptyReason ? { emptyReason: result.emptyReason } : {}),
    },
  }
}
