import type { Appointment, Client, Service, User } from '@repo/salon-core/types'
import type { AppointmentStaffAssignmentInput } from '@repo/salon-core/appointment-roster'
import {
  EmptyAppointmentRosterError,
  InvalidAppointmentRosterError,
  assertValidAppointmentRoster,
  leadStaffId,
  orderedRoster,
} from '@repo/salon-core/appointment-roster'
import {
  SCHEDULE_CONFLICT_CODES,
  isBlockingAppointmentStatus,
} from '@repo/salon-core/appointment-conflict'
import {
  durationMinutesFromRange,
  endTimeFromDuration,
  sameAddonIds,
  validateAppointmentWindow,
} from '@repo/salon-core/appointment-time'
import { isClientProvidedEntityId } from './client-queries'
import { getClientById } from './client-queries'
import { validatePlaceholderClientUsage } from './placeholder-client-queries'
import {
  getActiveServiceAddonsForService,
  getServiceById,
  validateComboServiceIsBookable,
} from './service-queries'
import {
  checkStaffAvailabilityForAppointment,
  getAllStaff,
  staffMayPerformService,
} from './staff-queries'
import {
  getScheduleOverlapFlags,
  validateAppointmentAddonIds,
} from './appointment-queries'

type SnapshotKeys =
  | 'bookedServiceName'
  | 'bookedServiceDuration'
  | 'bookedServicePrice'
  | 'bookedTotalDuration'
  | 'bookedTotalPrice'
  | 'bookedAddonCount'
  | 'bookedAddons'
  | 'staffAssignments'
type AppointmentCommand = Omit<
  Appointment,
  'id' | 'createdAt' | 'updatedAt' | SnapshotKeys
> & {
  id?: string
  addonIds?: string[]
  staffAssignments: AppointmentStaffAssignmentInput[]
}
type AppointmentPatch = Partial<
  Omit<Appointment, 'id' | 'createdAt' | 'updatedAt' | SnapshotKeys>
> & {
  addonIds?: string[]
  finalPrice?: number
  staffAssignments?: AppointmentStaffAssignmentInput[]
}

type AppointmentIntakeFailure = {
  ok: false
  status: number
  error: string
  code?: string
}

export type CreateAppointmentIntakeResult =
  | {
      ok: true
      command: AppointmentCommand
      client: Client
      staff: User
      staffMembers: User[]
      service: Service
    }
  | AppointmentIntakeFailure

export type UpdateAppointmentIntakeResult =
  | {
      ok: true
      patch: AppointmentPatch
      client: Client
      staff: User
      staffMembers: User[]
      service: Service
    }
  | AppointmentIntakeFailure

function fail(
  status: number,
  error: string,
  code?: string,
): AppointmentIntakeFailure {
  return { ok: false, status, error, ...(code ? { code } : {}) }
}

function positiveDurationMinutes(raw: unknown): number | null {
  const value =
    typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN

  return Number.isFinite(value) && value > 0 ? value : null
}

function explicitEndTime(raw: unknown): string | null {
  return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : null
}

function explicitAddonIds(raw: unknown): string[] | null {
  return Array.isArray(raw) && raw.every((item) => typeof item === 'string')
    ? raw
    : null
}

function explicitStaffAssignments(
  raw: unknown,
): AppointmentStaffAssignmentInput[] | null {
  if (!Array.isArray(raw)) return null
  const assignments: AppointmentStaffAssignmentInput[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item == null) return null
    const row = item as Record<string, unknown>
    if (
      typeof row.staffId !== 'string' ||
      typeof row.isLead !== 'boolean' ||
      typeof row.allocationBasisPoints !== 'number'
    ) {
      return null
    }
    assignments.push({
      staffId: row.staffId,
      isLead: row.isLead,
      allocationBasisPoints: row.allocationBasisPoints,
    })
  }
  return assignments
}

/** Roster invariants from salon-core, mapped to salon-facing messages. */
function rosterShapeFailure(
  assignments: readonly AppointmentStaffAssignmentInput[],
): AppointmentIntakeFailure | null {
  const staffIds = assignments.map((row) => row.staffId)
  if (new Set(staffIds).size !== staffIds.length) {
    return fail(400, 'هر پرسنل فقط یک‌بار می‌تواند انتخاب شود')
  }
  try {
    assertValidAppointmentRoster(assignments)
    return null
  } catch (rosterError) {
    if (rosterError instanceof EmptyAppointmentRosterError) {
      return fail(400, 'انتخاب پرسنل الزامی است')
    }
    if (rosterError instanceof InvalidAppointmentRosterError) {
      return fail(400, 'سهم کار پرسنل باید کامل و در مجموع ۱۰۰٪ باشد')
    }
    throw rosterError
  }
}

function sameRoster(
  next: readonly AppointmentStaffAssignmentInput[],
  previous: readonly AppointmentStaffAssignmentInput[],
): boolean {
  if (next.length !== previous.length) return false
  return next.every((row) => {
    const match = previous.find(
      (candidate) => candidate.staffId === row.staffId,
    )
    return (
      match?.isLead === row.isLead &&
      match.allocationBasisPoints === row.allocationBasisPoints
    )
  })
}

/** Lead capability is checked by `validateReferences`; extras are checked here. */
async function validateAssignedStaff(input: {
  salonId: string
  service: Service
  assignments: readonly AppointmentStaffAssignmentInput[]
}): Promise<{ ok: true; staffMembers: User[] } | AppointmentIntakeFailure> {
  const roster = orderedRoster(input.assignments)
  if (roster.length > 1 && !input.service.allowMultipleStaff) {
    return fail(400, 'این خدمت فقط یک پرسنل می‌پذیرد')
  }

  const allStaff = await getAllStaff(input.salonId)
  const staffMembers = roster.map((row) =>
    allStaff.find(
      (candidate) => candidate.id === row.staffId && candidate.role === 'staff',
    ),
  )
  if (staffMembers.some((member) => !member)) {
    return fail(404, 'پرسنل یافت نشد')
  }
  for (const row of roster.slice(1)) {
    if (
      !(await staffMayPerformService(
        row.staffId,
        input.service.id,
        input.salonId,
      ))
    ) {
      return fail(400, 'یکی از پرسنل انتخاب‌شده این خدمت را انجام نمی‌دهد')
    }
  }

  return { ok: true, staffMembers: staffMembers as User[] }
}

async function validateSelectedAddons(input: {
  salonId: string
  serviceId: string
  addonIds: string[]
}): Promise<true | AppointmentIntakeFailure> {
  try {
    validateAppointmentAddonIds(input.addonIds)
  } catch {
    return fail(400, 'افزودنی تکراری انتخاب شده است')
  }
  if (input.addonIds.length === 0) return true

  const matchingAddons = await getActiveServiceAddonsForService(
    input.serviceId,
    input.salonId,
  )
  const matchingIds = new Set(matchingAddons.map((addon) => addon.id))
  if (input.addonIds.some((id) => !matchingIds.has(id))) {
    return fail(
      400,
      'یکی از افزودنی‌های انتخاب‌شده برای این خدمت قابل استفاده نیست',
    )
  }
  return true
}

async function bookedTotalDuration(input: {
  salonId: string
  service: Service
  addonIds: string[]
}): Promise<number> {
  if (input.addonIds.length === 0) return input.service.duration
  const matchingAddons = await getActiveServiceAddonsForService(
    input.service.id,
    input.salonId,
  )
  const selectedIds = new Set(input.addonIds)
  return (
    input.service.duration +
    matchingAddons
      .filter((addon) => selectedIds.has(addon.id))
      .reduce((sum, addon) => sum + addon.durationDelta, 0)
  )
}

async function validateReferences(input: {
  salonId: string
  clientId: string
  staffId: string
  serviceId: string
}): Promise<
  | { ok: true; client: Client; staff: User; service: Service }
  | AppointmentIntakeFailure
> {
  const service = await getServiceById(input.serviceId, input.salonId)
  if (!service || !service.active) {
    return fail(404, 'خدمت یافت نشد')
  }
  if (
    service.kind === 'combo' &&
    !(await validateComboServiceIsBookable(input.serviceId, input.salonId))
  ) {
    return fail(400, 'پکیج انتخاب‌شده هنوز ترکیب خدمات ندارد.')
  }

  const staff = (await getAllStaff(input.salonId)).find(
    (candidate) => candidate.id === input.staffId,
  )
  if (!staff || staff.salonId !== input.salonId || staff.role !== 'staff') {
    return fail(404, 'پرسنل یافت نشد')
  }

  const client = await getClientById(input.clientId, input.salonId)
  if (!client) {
    return fail(404, 'مشتری یافت نشد')
  }

  const staffOk = await staffMayPerformService(
    input.staffId,
    input.serviceId,
    input.salonId,
  )
  if (!staffOk) {
    return fail(400, 'این پرسنل برای خدمت انتخاب‌شده تعریف نشده است.')
  }

  return { ok: true, client, staff, service }
}

async function validateBlockingSchedule(input: {
  salonId: string
  staffId: string
  clientId: string
  date: string
  startTime: string
  endTime: string
  excludeId?: string
}): Promise<true | AppointmentIntakeFailure> {
  const availability = await checkStaffAvailabilityForAppointment(
    input.salonId,
    input.staffId,
    input.date,
    input.startTime,
    input.endTime,
  )
  if (!availability.ok) {
    return fail(409, availability.error, availability.code)
  }

  const overlaps = await getScheduleOverlapFlags(
    input.salonId,
    input.staffId,
    input.clientId,
    input.date,
    input.startTime,
    input.endTime,
    input.excludeId,
  )
  if (overlaps.staffConflict) {
    return fail(
      409,
      'پرسنل انتخاب‌شده در این بازه زمانی نوبت فعال دیگری دارد.',
      SCHEDULE_CONFLICT_CODES.STAFF_OVERLAP,
    )
  }
  if (overlaps.clientConflict) {
    return fail(
      409,
      'این مشتری در این بازه زمانی نوبت فعال دیگری دارد.',
      SCHEDULE_CONFLICT_CODES.CLIENT_OVERLAP,
    )
  }

  return true
}

export async function validateCreateAppointmentIntake(input: {
  salonId: string
  clientId: unknown
  staffAssignments: unknown
  serviceId: unknown
  date: unknown
  startTime: unknown
  endTime?: unknown
  durationMinutes?: unknown
  addonIds?: unknown
  notes?: string
  requestedAppointmentId?: unknown
}): Promise<CreateAppointmentIntakeResult> {
  if (
    typeof input.clientId !== 'string' ||
    typeof input.serviceId !== 'string' ||
    typeof input.date !== 'string' ||
    typeof input.startTime !== 'string'
  ) {
    return fail(400, 'فیلدهای الزامی کامل نیست')
  }

  const roster = explicitStaffAssignments(input.staffAssignments)
  if (roster == null) return fail(400, 'فهرست پرسنل نامعتبر است')
  const rosterFailure = rosterShapeFailure(roster)
  if (rosterFailure) return rosterFailure

  const refs = await validateReferences({
    salonId: input.salonId,
    clientId: input.clientId,
    staffId: leadStaffId(roster),
    serviceId: input.serviceId,
  })
  if (!refs.ok) return refs

  const assignments = await validateAssignedStaff({
    salonId: input.salonId,
    service: refs.service,
    assignments: roster,
  })
  if (!assignments.ok) return assignments

  const placeholderUsage = await validatePlaceholderClientUsage({
    salonId: input.salonId,
    clientId: refs.client.id,
  })
  if (!placeholderUsage.ok) {
    return fail(
      placeholderUsage.status,
      placeholderUsage.error,
      placeholderUsage.code,
    )
  }

  const addonIds = explicitAddonIds(input.addonIds) ?? []
  const addonsCheck = await validateSelectedAddons({
    salonId: input.salonId,
    serviceId: refs.service.id,
    addonIds,
  })
  if (addonsCheck !== true) return addonsCheck

  const catalogDuration = await bookedTotalDuration({
    salonId: input.salonId,
    service: refs.service,
    addonIds,
  })
  const endExplicit = explicitEndTime(input.endTime)
  const duration = positiveDurationMinutes(input.durationMinutes)
  const endTime =
    endExplicit ??
    endTimeFromDuration(input.startTime, duration ?? catalogDuration)
  const windowCheck = validateAppointmentWindow(input.startTime, endTime)
  if (!windowCheck.ok) {
    return fail(400, windowCheck.error)
  }

  for (const staffMember of assignments.staffMembers) {
    const schedule = await validateBlockingSchedule({
      salonId: input.salonId,
      staffId: staffMember.id,
      clientId: input.clientId,
      date: input.date,
      startTime: input.startTime,
      endTime,
    })
    if (schedule !== true) return schedule
  }

  return {
    ok: true,
    command: {
      clientId: input.clientId,
      staffAssignments: orderedRoster(roster),
      serviceId: input.serviceId,
      date: input.date,
      startTime: input.startTime,
      endTime,
      addonIds,
      status: 'scheduled',
      notes: input.notes,
      ...(typeof input.requestedAppointmentId === 'string' &&
      isClientProvidedEntityId(input.requestedAppointmentId)
        ? { id: input.requestedAppointmentId }
        : {}),
    },
    client: refs.client,
    staff: refs.staff,
    staffMembers: assignments.staffMembers,
    service: refs.service,
  }
}

export async function validateUpdateAppointmentIntake(input: {
  salonId: string
  appointmentId: string
  existing: Appointment
  body: {
    clientId?: unknown
    staffAssignments?: unknown
    serviceId?: unknown
    date?: unknown
    startTime?: unknown
    endTime?: unknown
    durationMinutes?: unknown
    finalPrice?: unknown
    addonIds?: unknown
    status?: unknown
    notes?: unknown
  }
}): Promise<UpdateAppointmentIntakeResult> {
  const { existing, body } = input
  const effectiveStart =
    typeof body.startTime === 'string' ? body.startTime : existing.startTime
  const resolvedServiceId =
    typeof body.serviceId === 'string' ? body.serviceId : existing.serviceId
  const resolvedClientId =
    typeof body.clientId === 'string' ? body.clientId : existing.clientId
  const resolvedDate = typeof body.date === 'string' ? body.date : existing.date
  const existingRoster: AppointmentStaffAssignmentInput[] =
    existing.staffAssignments.map((assignment) => ({
      staffId: assignment.staffId,
      isLead: assignment.isLead,
      allocationBasisPoints: assignment.allocationBasisPoints,
    }))
  // Omitting the roster leaves it untouched; sending one replaces it wholesale.
  const roster =
    body.staffAssignments === undefined
      ? existingRoster
      : explicitStaffAssignments(body.staffAssignments)
  if (roster == null) return fail(400, 'فهرست پرسنل نامعتبر است')
  const rosterFailure = rosterShapeFailure(roster)
  if (rosterFailure) return rosterFailure

  const duration = positiveDurationMinutes(body.durationMinutes)
  const startChanged =
    typeof body.startTime === 'string' && body.startTime !== existing.startTime
  const serviceChanged =
    typeof body.serviceId === 'string' && body.serviceId !== existing.serviceId
  const existingAddonIds = (existing.bookedAddons ?? []).map(
    (line) => line.serviceAddonId,
  )
  const addonIds = explicitAddonIds(body.addonIds)
  const addonIdsChanged =
    addonIds != null && !sameAddonIds(addonIds, existingAddonIds)

  if (serviceChanged && addonIds == null) {
    return fail(400, 'برای تغییر خدمت، افزودنی‌ها باید دوباره مشخص شوند')
  }
  if (body.addonIds !== undefined && addonIds == null) {
    return fail(400, 'فهرست افزودنی‌ها نامعتبر است')
  }

  let endTime = existing.endTime
  const endExplicit = explicitEndTime(body.endTime)
  if (serviceChanged || addonIdsChanged) {
    const service = await getServiceById(resolvedServiceId, input.salonId)
    if (service) {
      const selectedAddonIds = addonIds ?? existingAddonIds
      const addonsCheck = await validateSelectedAddons({
        salonId: input.salonId,
        serviceId: resolvedServiceId,
        addonIds: selectedAddonIds,
      })
      if (addonsCheck !== true) return addonsCheck
      if (endExplicit) {
        endTime = endExplicit
      } else {
        const baseService = serviceChanged
          ? service
          : {
              ...service,
              duration: existing.bookedServiceDuration,
              price: existing.bookedServicePrice,
            }
        endTime = endTimeFromDuration(
          effectiveStart,
          await bookedTotalDuration({
            salonId: input.salonId,
            service: baseService,
            addonIds: selectedAddonIds,
          }),
        )
      }
    }
  } else if (endExplicit) {
    endTime = endExplicit
  } else if (duration != null) {
    endTime = endTimeFromDuration(effectiveStart, duration)
  } else if (startChanged) {
    endTime = endTimeFromDuration(
      effectiveStart,
      Math.max(
        5,
        existing.bookedTotalDuration ??
          durationMinutesFromRange(existing.startTime, existing.endTime),
      ),
    )
  }

  const windowCheck = validateAppointmentWindow(effectiveStart, endTime)
  if (!windowCheck.ok) {
    return fail(400, windowCheck.error)
  }

  const refs = await validateReferences({
    salonId: input.salonId,
    clientId: resolvedClientId,
    staffId: leadStaffId(roster),
    serviceId: resolvedServiceId,
  })
  if (!refs.ok) return refs

  const assignments = await validateAssignedStaff({
    salonId: input.salonId,
    service: refs.service,
    assignments: roster,
  })
  if (!assignments.ok) return assignments

  const rosterChanged = !sameRoster(roster, existingRoster)
  if (existing.status === 'completed' && rosterChanged) {
    return fail(409, 'پس از تکمیل نوبت نمی‌توان پرسنل یا سهم کار را تغییر داد')
  }

  const placeholderUsage = await validatePlaceholderClientUsage({
    salonId: input.salonId,
    clientId: refs.client.id,
    appointmentId: input.appointmentId,
  })
  if (!placeholderUsage.ok) {
    return fail(
      placeholderUsage.status,
      placeholderUsage.error,
      placeholderUsage.code,
    )
  }

  const resolvedStatus =
    typeof body.status === 'string'
      ? (body.status as Appointment['status'])
      : existing.status

  if (isBlockingAppointmentStatus(resolvedStatus)) {
    for (const staffMember of assignments.staffMembers) {
      const schedule = await validateBlockingSchedule({
        salonId: input.salonId,
        staffId: staffMember.id,
        clientId: resolvedClientId,
        date: resolvedDate,
        startTime: effectiveStart,
        endTime,
        excludeId: input.appointmentId,
      })
      if (schedule !== true) return schedule
    }
  }

  const patch: AppointmentPatch = { endTime }
  if (body.clientId !== undefined) patch.clientId = body.clientId as string
  if (rosterChanged) patch.staffAssignments = orderedRoster(roster)
  if (serviceChanged) patch.serviceId = body.serviceId as string
  if (addonIdsChanged) patch.addonIds = addonIds ?? []
  if (body.date !== undefined) patch.date = body.date as string
  if (typeof body.startTime === 'string') patch.startTime = body.startTime
  if (body.status !== undefined)
    patch.status = body.status as Appointment['status']
  if (body.notes !== undefined) patch.notes = body.notes as string | undefined
  if (body.finalPrice !== undefined)
    patch.finalPrice = body.finalPrice as number

  return {
    ok: true,
    patch,
    client: refs.client,
    staff: refs.staff,
    staffMembers: assignments.staffMembers,
    service: refs.service,
  }
}
