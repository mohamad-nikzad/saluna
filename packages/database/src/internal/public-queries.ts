import { and, eq } from 'drizzle-orm'
import {
  AVAILABILITY_EMPTY_REASONS,
  getAvailabilityForDay,
  getNearestAvailability,
  type AvailabilityEmptyReason,
  type AvailabilityMode,
  type AvailabilityResponse,
  type AvailabilityStaffDay,
} from '@repo/salon-core/availability'
import {
  addDaysYmd,
  salonCurrentHm,
  salonTodayYmd,
} from '@repo/salon-core/salon-local-time'
import { eligibleStaffForService } from '@repo/salon-core/staff-service-autofill'
import {
  dayOfWeekFromDate,
  isSalonOpenOnDate,
  resolveStaffWorkingHoursForDay,
} from '@repo/salon-core/staff-availability'
import type { Appointment, Service, StaffSchedule, User } from '@repo/salon-core/types'
import { endTimeFromDuration } from '@repo/salon-core/appointment-time'
import { PUBLIC_REQUEST_WINDOW_DAYS } from '@repo/salon-core/forms/public'
import { normalizePhone } from '@repo/salon-core/phone'

import { getDb } from '../client'
import {
  appointmentRequests,
  organization,
  salonProfile,
  salonPublicSettings,
  servicePublicVisibility,
} from '../schema'
import { getAppointmentsByDateRange } from './appointment-queries'
import { getAllServices, getServiceById } from './service-queries'
import {
  toSalonPresenceView,
  type SalonPresenceView,
} from './salon-profile-queries'
import { getAllStaff, getStaffSchedules } from './staff-queries'
import { getBusinessSettings } from './settings-queries'

export type PublicSalonView = {
  salon: {
    id: string
    slug: string
    name: string
    phone: string | null
    timezone: string
    locale: string
  }
  publicSettings: {
    enabled: boolean
    bioText: string | null
    themeId: string
    layoutId: string
    appointmentRequestsEnabled: boolean
  }
  presence: SalonPresenceView
  services: Service[]
}

export type PublicSalonLookupResult =
  | { ok: true; view: PublicSalonView }
  | { ok: false; status: number; error: string }

/**
 * Resolves a salon by its public slug. Returns 404 when the salon is missing,
 * inactive, or has no `salon_public_settings` row with `enabled = true`.
 */
export async function getPublicSalon(slug: string): Promise<PublicSalonLookupResult> {
  const db = getDb()
  const [salonRow] = await db
    .select({
      id: organization.id,
      slug: organization.slug,
      name: organization.name,
      phone: salonProfile.phone,
      address: salonProfile.address,
      mapGoogle: salonProfile.mapGoogle,
      mapNeshan: salonProfile.mapNeshan,
      mapBalad: salonProfile.mapBalad,
      socialInstagram: salonProfile.socialInstagram,
      socialTelegram: salonProfile.socialTelegram,
      socialWhatsapp: salonProfile.socialWhatsapp,
      website: salonProfile.website,
      timezone: salonProfile.timezone,
      locale: salonProfile.locale,
      status: salonProfile.status,
    })
    .from(organization)
    .leftJoin(salonProfile, eq(salonProfile.organizationId, organization.id))
    .where(eq(organization.slug, slug))
    .limit(1)

  if (!salonRow || salonRow.status !== 'active') {
    return { ok: false, status: 404, error: 'سالن یافت نشد' }
  }

  const [settingsRow] = await db
    .select()
    .from(salonPublicSettings)
    .where(eq(salonPublicSettings.salonId, salonRow.id))
    .limit(1)

  if (!settingsRow || !settingsRow.enabled) {
    return { ok: false, status: 404, error: 'سالن یافت نشد' }
  }

  const services = await getAllServices(salonRow.id, false)
  const visibilityRows = await db
    .select()
    .from(servicePublicVisibility)
    .where(eq(servicePublicVisibility.salonId, salonRow.id))
  const byServiceId = new Map(visibilityRows.map((row) => [row.serviceId, row]))

  const visible = services
    .filter((service) => {
      const row = byServiceId.get(service.id)
      return row ? row.visible : true
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'fa'))

  return {
    ok: true,
    view: {
      salon: {
        id: salonRow.id,
        slug: salonRow.slug,
        name: salonRow.name,
        phone: salonRow.phone,
        timezone: salonRow.timezone ?? 'Asia/Tehran',
        locale: salonRow.locale ?? 'fa-IR',
      },
      publicSettings: {
        enabled: settingsRow.enabled,
        bioText: settingsRow.bioText,
        themeId: settingsRow.themeId,
        layoutId: settingsRow.layoutId,
        appointmentRequestsEnabled: settingsRow.appointmentRequestsEnabled,
      },
      presence: toSalonPresenceView(salonRow),
      services: visible,
    },
  }
}

export type PublicAvailabilityLookupParams = {
  slug: string
  serviceId: string
  date: string
  mode: AvailabilityMode
  /** Used for `mode='nearest'` — number of days to scan. Defaults to 14. */
  nearestDays?: number
}

export type PublicAvailabilityLookupResult =
  | { ok: true; response: AvailabilityResponse }
  | { ok: false; status: number; error: string }

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

/**
 * Public availability — union of free slots across every staff capable of the
 * service. Customers never pick or see staff (v1). Date must fall within
 * `[salonToday, salonToday + PUBLIC_REQUEST_WINDOW_DAYS]` in `Asia/Tehran`.
 */
export async function getPublicAvailability(
  params: PublicAvailabilityLookupParams
): Promise<PublicAvailabilityLookupResult> {
  const today = salonTodayYmd()
  const maxDate = addDaysYmd(today, PUBLIC_REQUEST_WINDOW_DAYS)
  if (params.date < today || params.date > maxDate) {
    return { ok: false, status: 400, error: 'تاریخ خارج از بازه مجاز است' }
  }

  const salonLookup = await getPublicSalon(params.slug)
  if (!salonLookup.ok) return salonLookup
  if (!salonLookup.view.publicSettings.appointmentRequestsEnabled) {
    return { ok: false, status: 403, error: 'درخواست نوبت برای این سالن غیرفعال است' }
  }
  const salonId = salonLookup.view.salon.id

  const [service, businessHours, allStaff] = await Promise.all([
    getServiceById(params.serviceId, salonId),
    getBusinessSettings(salonId),
    getAllStaff(salonId),
  ])

  if (!service || !service.active) {
    return { ok: false, status: 404, error: 'خدمت یافت نشد' }
  }

  const activeStaff = allStaff.filter((member) => member.role === 'staff')
  const eligibleStaff = eligibleStaffForService(activeStaff, service.id)
  if (eligibleStaff.length === 0) {
    return emptyAvailability(params.mode, AVAILABILITY_EMPTY_REASONS.NO_QUALIFIED_STAFF)
  }

  if (params.mode === 'day' && !isSalonOpenOnDate(businessHours.workingDays, params.date)) {
    return emptyAvailability(params.mode, AVAILABILITY_EMPTY_REASONS.SALON_CLOSED)
  }

  const nearestDays = params.nearestDays ?? 14
  const dateOffsets =
    params.mode === 'day'
      ? [0]
      : Array.from({ length: nearestDays }, (_, offset) => offset)
  const searchDates = dateOffsets
    .map((offset) => addDaysYmd(params.date, offset))
    .filter((date) => date <= maxDate)
    .filter((date) => isSalonOpenOnDate(businessHours.workingDays, date))

  if (searchDates.length === 0) {
    return emptyAvailability(
      params.mode,
      params.mode === 'day'
        ? AVAILABILITY_EMPTY_REASONS.SALON_CLOSED
        : AVAILABILITY_EMPTY_REASONS.OUTSIDE_SEARCH_WINDOW
    )
  }

  const [appointments, schedulesByStaffEntries] = await Promise.all([
    getAppointmentsByDateRange(salonId, searchDates[0]!, searchDates[searchDates.length - 1]!),
    Promise.all(
      eligibleStaff.map(
        async (member) => [member.id, await getStaffSchedules(salonId, member.id)] as const
      )
    ),
  ])
  const appointmentsByStaffAndDate = buildAppointmentsByStaffAndDate(appointments)
  const schedulesByStaff = new Map<string, StaffSchedule[]>(schedulesByStaffEntries)
  const todayDate = salonTodayYmd()
  const nowTime = salonCurrentHm()

  const buildDay = (date: string): AvailabilityStaffDay[] =>
    eligibleStaff.map((staffMember) =>
      buildStaffDay({
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
      searchMode: 'any',
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
    searchMode: 'any',
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

function emptyAvailability(
  mode: AvailabilityMode,
  reason: AvailabilityEmptyReason
): PublicAvailabilityLookupResult {
  if (mode === 'day') {
    return { ok: true, response: { mode: 'day', slots: [], emptyReason: reason } }
  }
  return { ok: true, response: { mode: 'nearest', slot: null, emptyReason: reason } }
}

function buildStaffDay(input: {
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

export type CreateAppointmentRequestInput = {
  slug: string
  serviceId: string
  date: string
  startTime: string
  customerName: string
  customerPhone: string
  notes?: string
}

export type CreateAppointmentRequestResult =
  | { ok: true; id: string; confirmationToken: string }
  | { ok: false; status: number; error: string }

/**
 * Creates a `pending` `AppointmentRequest` with the service snapshot bound at
 * submit time (name/duration/price), no staff assigned, and a fresh
 * confirmation token. Does NOT block availability — see ADR-0002.
 */
export async function createAppointmentRequest(
  input: CreateAppointmentRequestInput
): Promise<CreateAppointmentRequestResult> {
  const salonLookup = await getPublicSalon(input.slug)
  if (!salonLookup.ok) return salonLookup
  if (!salonLookup.view.publicSettings.appointmentRequestsEnabled) {
    return { ok: false, status: 403, error: 'درخواست نوبت برای این سالن غیرفعال است' }
  }
  const salonId = salonLookup.view.salon.id

  const today = salonTodayYmd()
  const maxDate = addDaysYmd(today, PUBLIC_REQUEST_WINDOW_DAYS)
  if (input.date < today || input.date > maxDate) {
    return { ok: false, status: 400, error: 'تاریخ خارج از بازه مجاز است' }
  }

  const service = await getServiceById(input.serviceId, salonId)
  if (!service || !service.active) {
    return { ok: false, status: 404, error: 'خدمت یافت نشد' }
  }

  const endTime = endTimeFromDuration(input.startTime, service.duration)

  const db = getDb()
  const [row] = await db
    .insert(appointmentRequests)
    .values({
      salonId,
      serviceId: input.serviceId,
      requestedDate: input.date,
      requestedStartTime: input.startTime,
      requestedEndTime: endTime,
      customerName: input.customerName,
      customerPhone: normalizePhone(input.customerPhone),
      notes: input.notes,
      bookedServiceName: service.name,
      bookedServiceDuration: service.duration,
      bookedServicePrice: service.price,
    })
    .returning({
      id: appointmentRequests.id,
      confirmationToken: appointmentRequests.confirmationToken,
    })
  return { ok: true, id: row.id, confirmationToken: row.confirmationToken }
}

export type AppointmentRequestStatusView = {
  id: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired'
  bookedServiceName: string
  bookedServiceDuration: number
  bookedServicePrice: number
  requestedDate: string
  requestedStartTime: string
  requestedEndTime: string
  salon: { name: string; phone: string | null }
  createdAt: Date
  reviewedAt: Date | null
  rejectionReason: string | null
}

/**
 * Token-authorized status view for the customer. Deliberately hides the
 * customer name and phone — the token authorizes "view status", not "view
 * identity".
 */
export async function getAppointmentRequestByToken(
  token: string
): Promise<AppointmentRequestStatusView | null> {
  const db = getDb()
  const rows = await db
    .select({
      request: appointmentRequests,
      salon: {
        name: organization.name,
        phone: salonProfile.phone,
      },
    })
    .from(appointmentRequests)
    .innerJoin(organization, eq(organization.id, appointmentRequests.salonId))
    .leftJoin(salonProfile, eq(salonProfile.organizationId, organization.id))
    .where(eq(appointmentRequests.confirmationToken, token))
    .limit(1)
  const row = rows[0]
  if (!row) return null
  return {
    id: row.request.id,
    status: row.request.status,
    bookedServiceName: row.request.bookedServiceName,
    bookedServiceDuration: row.request.bookedServiceDuration,
    bookedServicePrice: row.request.bookedServicePrice,
    requestedDate: row.request.requestedDate,
    requestedStartTime: row.request.requestedStartTime,
    requestedEndTime: row.request.requestedEndTime,
    salon: row.salon,
    createdAt: row.request.createdAt,
    reviewedAt: row.request.reviewedAt,
    rejectionReason: row.request.rejectionReason,
  }
}

export type CancelAppointmentRequestResult =
  | { ok: true }
  | { ok: false; status: number; error: string }

/**
 * Customer-initiated cancel via confirmation token. Only `pending` requests
 * may be cancelled; any other status returns 409.
 */
export async function cancelAppointmentRequestByToken(
  token: string
): Promise<CancelAppointmentRequestResult> {
  const db = getDb()
  const updated = await db
    .update(appointmentRequests)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(
      and(
        eq(appointmentRequests.confirmationToken, token),
        eq(appointmentRequests.status, 'pending')
      )
    )
    .returning({ id: appointmentRequests.id })
  if (updated.length === 0) {
    // Distinguish missing vs. wrong-status for a better error.
    const [existing] = await db
      .select({ id: appointmentRequests.id })
      .from(appointmentRequests)
      .where(eq(appointmentRequests.confirmationToken, token))
      .limit(1)
    if (!existing) return { ok: false, status: 404, error: 'درخواست یافت نشد' }
    return { ok: false, status: 409, error: 'این درخواست قابل لغو نیست' }
  }
  return { ok: true }
}
