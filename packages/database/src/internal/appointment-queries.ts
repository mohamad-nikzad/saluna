import { and, asc, desc, eq, gte, inArray, lte, or } from 'drizzle-orm'
import type {
  Appointment,
  AppointmentWithDetails,
  BookedAppointmentAddonLine,
  ServiceAddon,
} from '@repo/salon-core/types'
import { detectScheduleOverlaps } from '@repo/salon-core/appointment-conflict'
import {
  durationMinutesFromRange,
  endTimeFromDuration,
  sameAddonIds,
} from '@repo/salon-core/appointment-time'
import { getDb } from '../client'
import {
  appointmentAddonLines,
  appointments,
  clients,
  member,
  salonMember,
  services,
  user,
} from '../schema'
import {
  attachAppointmentDetails,
  rowToAppointment,
  rowToAppointmentAddonLine,
  staffUserSelect,
} from './row-mappers'
import { isClientProvidedEntityId } from './client-queries'
import { getActiveServiceAddonsForService, getServiceById } from './service-queries'

type SnapshotKeys =
  | 'bookedServiceName'
  | 'bookedServiceDuration'
  | 'bookedServicePrice'
  | 'bookedTotalDuration'
  | 'bookedTotalPrice'
  | 'bookedAddonCount'
  | 'bookedAddons'

type AppointmentCommand = Omit<Appointment, 'id' | 'createdAt' | 'updatedAt' | SnapshotKeys> & {
  id?: string
  addonIds?: string[]
}
type AppointmentPatch = Partial<Omit<Appointment, 'id' | 'createdAt' | 'updatedAt' | SnapshotKeys>> & {
  addonIds?: string[]
}

function snapshotFromService(service: { name: string; duration: number; price: number }) {
  return {
    bookedServiceName: service.name,
    bookedServiceDuration: service.duration,
    bookedServicePrice: service.price,
  }
}

function attachAddonCounts<T extends Appointment>(
  appointmentsList: T[],
  lines: BookedAppointmentAddonLine[]
): T[] {
  const counts = new Map<string, number>()
  for (const line of lines) counts.set(line.appointmentId, (counts.get(line.appointmentId) ?? 0) + 1)
  return appointmentsList.map((appointment) => ({
    ...appointment,
    bookedAddonCount: counts.get(appointment.id) ?? 0,
  }))
}

async function getAddonLinesForAppointments(
  salonId: string,
  appointmentIds: string[]
): Promise<BookedAppointmentAddonLine[]> {
  if (appointmentIds.length === 0) return []
  const db = getDb()
  const rows = await db
    .select()
    .from(appointmentAddonLines)
    .where(
      and(
        eq(appointmentAddonLines.salonId, salonId),
        inArray(appointmentAddonLines.appointmentId, appointmentIds)
      )
    )
    .orderBy(asc(appointmentAddonLines.sortOrder), asc(appointmentAddonLines.bookedAddonName))
  return rows.map(rowToAppointmentAddonLine)
}

function attachAddonDetails<T extends Appointment>(
  appointmentsList: T[],
  lines: BookedAppointmentAddonLine[]
): T[] {
  const byAppointmentId = new Map<string, BookedAppointmentAddonLine[]>()
  for (const line of lines) {
    const current = byAppointmentId.get(line.appointmentId) ?? []
    current.push(line)
    byAppointmentId.set(line.appointmentId, current)
  }
  return appointmentsList.map((appointment) => {
    const bookedAddons = byAppointmentId.get(appointment.id) ?? []
    return {
      ...appointment,
      bookedAddonCount: bookedAddons.length,
      bookedAddons,
    }
  })
}

export function validateAppointmentAddonIds(addonIds: string[]) {
  if (new Set(addonIds).size !== addonIds.length) {
    throw new Error('appointment add-ons cannot contain duplicates')
  }
}

async function resolveAppointmentAddons(input: {
  salonId: string
  serviceId: string
  addonIds?: string[]
}): Promise<ServiceAddon[]> {
  const addonIds = input.addonIds ?? []
  validateAppointmentAddonIds(addonIds)
  if (addonIds.length === 0) return []

  const matchingAddons = await getActiveServiceAddonsForService(input.serviceId, input.salonId)
  const byId = new Map(matchingAddons.map((addon) => [addon.id, addon]))
  const selected = addonIds.map((id) => byId.get(id))
  if (selected.some((addon) => !addon)) {
    throw new Error('appointment add-on not available for selected service')
  }
  return selected as ServiceAddon[]
}

export function totalSnapshotFromServiceAndAddons(
  service: { duration: number; price: number },
  addons: Array<{ durationDelta: number; priceDelta: number }>
) {
  return {
    bookedTotalDuration:
      service.duration + addons.reduce((sum, addon) => sum + addon.durationDelta, 0),
    bookedTotalPrice: service.price + addons.reduce((sum, addon) => sum + addon.priceDelta, 0),
  }
}

export function addonLineValues(input: {
  salonId: string
  appointmentId: string
  addons: ServiceAddon[]
}): Array<typeof appointmentAddonLines.$inferInsert> {
  return input.addons.map((addon, index) => ({
    salonId: input.salonId,
    appointmentId: input.appointmentId,
    serviceAddonId: addon.id,
    bookedAddonName: addon.name,
    bookedAddonPriceDelta: addon.priceDelta,
    bookedAddonDurationDelta: addon.durationDelta,
    sortOrder: index,
  }))
}

function staffIdCondition(staffIdFilter?: string | readonly string[]) {
  if (staffIdFilter == null) return undefined
  if (typeof staffIdFilter === 'string') {
    return eq(appointments.staffId, staffIdFilter)
  }
  if (staffIdFilter.length === 0) return undefined
  if (staffIdFilter.length === 1) {
    return eq(appointments.staffId, staffIdFilter[0]!)
  }
  return inArray(appointments.staffId, [...staffIdFilter])
}

export async function getAppointmentsByDateRange(
  salonId: string,
  startDate: string,
  endDate: string,
  staffIdFilter?: string | readonly string[],
): Promise<Appointment[]> {
  const db = getDb()
  const conditions = [
    eq(appointments.salonId, salonId),
    gte(appointments.date, startDate),
    lte(appointments.date, endDate),
  ]
  const staffCondition = staffIdCondition(staffIdFilter)
  if (staffCondition) {
    conditions.push(staffCondition)
  }
  const rows = await db
    .select()
    .from(appointments)
    .where(and(...conditions))
    .orderBy(asc(appointments.date), asc(appointments.startTime))
  const mapped = rows.map(rowToAppointment)
  const lines = await getAddonLinesForAppointments(salonId, mapped.map((appointment) => appointment.id))
  return attachAddonCounts(mapped, lines)
}

export async function getAppointmentsWithDetailsByDateRange(
  salonId: string,
  startDate: string,
  endDate: string,
  staffIdFilter?: string | readonly string[],
): Promise<AppointmentWithDetails[]> {
  const db = getDb()
  const conditions = [
    eq(appointments.salonId, salonId),
    gte(appointments.date, startDate),
    lte(appointments.date, endDate),
  ]
  const staffCondition = staffIdCondition(staffIdFilter)
  if (staffCondition) {
    conditions.push(staffCondition)
  }

  const rows = await db
    .select({
      appointment: appointments,
      client: clients,
      staff: staffUserSelect,
      service: services,
    })
    .from(appointments)
    .innerJoin(clients, and(eq(appointments.clientId, clients.id), eq(clients.salonId, salonId)))
    .innerJoin(user, eq(appointments.staffId, user.id))
    .innerJoin(member, and(eq(member.userId, user.id), eq(member.organizationId, salonId)))
    .leftJoin(salonMember, and(eq(salonMember.userId, user.id), eq(salonMember.organizationId, salonId)))
    .innerJoin(services, and(eq(appointments.serviceId, services.id), eq(services.salonId, salonId)))
    .where(and(...conditions))
    .orderBy(asc(appointments.date), asc(appointments.startTime))

  const mapped = rows.map(attachAppointmentDetails)
  const lines = await getAddonLinesForAppointments(salonId, mapped.map((appointment) => appointment.id))
  return attachAddonCounts(mapped, lines)
}

export async function getClientAppointmentsWithDetails(
  salonId: string,
  clientId: string
): Promise<AppointmentWithDetails[]> {
  const db = getDb()
  const rows = await db
    .select({
      appointment: appointments,
      client: clients,
      staff: staffUserSelect,
      service: services,
    })
    .from(appointments)
    .innerJoin(clients, and(eq(appointments.clientId, clients.id), eq(clients.salonId, salonId)))
    .innerJoin(user, eq(appointments.staffId, user.id))
    .innerJoin(member, and(eq(member.userId, user.id), eq(member.organizationId, salonId)))
    .leftJoin(salonMember, and(eq(salonMember.userId, user.id), eq(salonMember.organizationId, salonId)))
    .innerJoin(services, and(eq(appointments.serviceId, services.id), eq(services.salonId, salonId)))
    .where(and(eq(appointments.salonId, salonId), eq(appointments.clientId, clientId)))
    .orderBy(desc(appointments.date), desc(appointments.startTime))

  const mapped = rows.map(attachAppointmentDetails)
  const lines = await getAddonLinesForAppointments(salonId, mapped.map((appointment) => appointment.id))
  return attachAddonDetails(mapped, lines)
}

export async function getAppointmentWithDetailsById(
  id: string,
  salonId: string
): Promise<AppointmentWithDetails | undefined> {
  const db = getDb()
  const rows = await db
    .select({
      appointment: appointments,
      client: clients,
      staff: staffUserSelect,
      service: services,
    })
    .from(appointments)
    .innerJoin(clients, and(eq(appointments.clientId, clients.id), eq(clients.salonId, salonId)))
    .innerJoin(user, eq(appointments.staffId, user.id))
    .innerJoin(member, and(eq(member.userId, user.id), eq(member.organizationId, salonId)))
    .leftJoin(salonMember, and(eq(salonMember.userId, user.id), eq(salonMember.organizationId, salonId)))
    .innerJoin(services, and(eq(appointments.serviceId, services.id), eq(services.salonId, salonId)))
    .where(and(eq(appointments.id, id), eq(appointments.salonId, salonId)))
    .limit(1)

  const row = rows[0]
  if (!row) return undefined
  const [appointment] = attachAddonDetails(
    [attachAppointmentDetails(row)],
    await getAddonLinesForAppointments(salonId, [row.appointment.id])
  )
  return appointment
}

export async function getAppointmentById(
  id: string,
  salonId: string
): Promise<Appointment | undefined> {
  const db = getDb()
  const rows = await db
    .select()
    .from(appointments)
    .where(and(eq(appointments.id, id), eq(appointments.salonId, salonId)))
    .limit(1)
  const row = rows[0]
  if (!row) return undefined
  const [appointment] = attachAddonDetails(
    [rowToAppointment(row)],
    await getAddonLinesForAppointments(salonId, [row.id])
  )
  return appointment
}

export type CreateAppointmentOptions = {
  createdByUserId?: string
  /**
   * Overrides the live service snapshot at insert time. Used by
   * `AppointmentRequest` approval so the customer is honored at the terms
   * they saw, even if the underlying `ServiceVariant` has since been edited.
   */
  serviceSnapshotOverride?: { name: string; duration: number; price: number }
}

export async function createAppointment(
  apt: AppointmentCommand,
  salonId: string,
  optionsOrCreatedByUserId?: string | CreateAppointmentOptions
): Promise<Appointment> {
  const options: CreateAppointmentOptions =
    typeof optionsOrCreatedByUserId === 'string'
      ? { createdByUserId: optionsOrCreatedByUserId }
      : (optionsOrCreatedByUserId ?? {})
  const db = getDb()
  const service = await getServiceById(apt.serviceId, salonId)
  if (!service) throw new Error('service not found')
  const selectedAddons = await resolveAppointmentAddons({
    salonId,
    serviceId: apt.serviceId,
    addonIds: apt.addonIds,
  })
  const snapshotSource = options.serviceSnapshotOverride ?? service
  const totals = totalSnapshotFromServiceAndAddons(snapshotSource, selectedAddons)
  const bookedTotalDuration = durationMinutesFromRange(apt.startTime, apt.endTime)
  const values: typeof appointments.$inferInsert = {
    salonId,
    clientId: apt.clientId,
    staffId: apt.staffId,
    serviceId: apt.serviceId,
    date: apt.date,
    startTime: apt.startTime,
    endTime: apt.endTime,
    ...snapshotFromService(snapshotSource),
    ...totals,
    bookedTotalDuration,
    status: apt.status,
    notes: apt.notes,
    createdByUserId: options.createdByUserId ?? null,
  }
  if (isClientProvidedEntityId(apt.id)) {
    values.id = apt.id
  }
  const [row] = await db.transaction(async (tx) => {
    const [created] = await tx.insert(appointments).values(values).returning()
    if (selectedAddons.length > 0) {
      await tx.insert(appointmentAddonLines).values(
        addonLineValues({ salonId, appointmentId: created.id, addons: selectedAddons })
      )
    }
    return [created]
  })
  const [appointment] = attachAddonDetails(
    [rowToAppointment(row)],
    await getAddonLinesForAppointments(salonId, [row.id])
  )
  return appointment
}

export async function updateAppointment(
  id: string,
  salonId: string,
  data: AppointmentPatch
): Promise<Appointment | undefined> {
  const db = getDb()
  const existing = await getAppointmentById(id, salonId)
  if (!existing) return undefined
  const serviceId = data.serviceId ?? existing.serviceId
  const existingAddonIds = (existing.bookedAddons ?? []).map((line) => line.serviceAddonId)
  const serviceChanged = data.serviceId !== undefined && data.serviceId !== existing.serviceId
  const addonIdsChanged =
    data.addonIds !== undefined && !sameAddonIds(data.addonIds, existingAddonIds)
  const serviceOrAddonsChanged = serviceChanged || addonIdsChanged
  if (serviceChanged && data.addonIds === undefined) {
    throw new Error('appointment service changes require explicit add-on ids')
  }
  let selectedAddons: ServiceAddon[] | null = null
  const patch: Partial<typeof appointments.$inferInsert> = {
    updatedAt: new Date(),
  }
  if (data.clientId !== undefined) patch.clientId = data.clientId
  if (data.staffId !== undefined) patch.staffId = data.staffId
  if (serviceChanged) {
    const service = await getServiceById(data.serviceId!, salonId)
    if (!service) throw new Error('service not found')
    patch.serviceId = data.serviceId
    Object.assign(patch, snapshotFromService(service))
  }
  if (serviceOrAddonsChanged) {
    const service = await getServiceById(serviceId, salonId)
    if (!service) throw new Error('service not found')
    selectedAddons = await resolveAppointmentAddons({
      salonId,
      serviceId,
      addonIds: data.addonIds ?? existingAddonIds,
    })
    const baseSnapshot =
      serviceChanged
        ? snapshotFromService(service)
        : {
            bookedServiceName: existing.bookedServiceName,
            bookedServiceDuration: existing.bookedServiceDuration,
            bookedServicePrice: existing.bookedServicePrice,
          }
    Object.assign(patch, baseSnapshot)
    Object.assign(
      patch,
      totalSnapshotFromServiceAndAddons(
        {
          duration: baseSnapshot.bookedServiceDuration,
          price: baseSnapshot.bookedServicePrice,
        },
        selectedAddons
      )
    )
  }
  if (data.date !== undefined) patch.date = data.date
  if (data.startTime !== undefined) patch.startTime = data.startTime
  if (data.endTime !== undefined) {
    patch.endTime = data.endTime
  } else if (serviceOrAddonsChanged) {
    patch.endTime = endTimeFromDuration(
      data.startTime ?? existing.startTime,
      patch.bookedTotalDuration ?? existing.bookedTotalDuration
    )
  }
  if (data.status !== undefined) patch.status = data.status
  if (data.notes !== undefined) patch.notes = data.notes

  const [row] = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(appointments)
      .set(patch)
      .where(and(eq(appointments.id, id), eq(appointments.salonId, salonId)))
      .returning()
    if (updated && selectedAddons) {
      await tx
        .delete(appointmentAddonLines)
        .where(
          and(
            eq(appointmentAddonLines.salonId, salonId),
            eq(appointmentAddonLines.appointmentId, id)
          )
        )
      if (selectedAddons.length > 0) {
        await tx.insert(appointmentAddonLines).values(
          addonLineValues({ salonId, appointmentId: id, addons: selectedAddons })
        )
      }
    }
    return [updated]
  })
  if (!row) return undefined
  const [appointment] = attachAddonDetails(
    [rowToAppointment(row)],
    await getAddonLinesForAppointments(salonId, [row.id])
  )
  return appointment
}

export async function deleteAppointment(id: string, salonId: string): Promise<boolean> {
  const db = getDb()
  const deleted = await db
    .delete(appointments)
    .where(and(eq(appointments.id, id), eq(appointments.salonId, salonId)))
    .returning()
  return deleted.length > 0
}

export async function getScheduleOverlapFlags(
  salonId: string,
  staffId: string,
  clientId: string,
  date: string,
  startTime: string,
  endTime: string,
  excludeId?: string
) {
  const db = getDb()
  const rows = await db
    .select({
      id: appointments.id,
      salonId: appointments.salonId,
      staffId: appointments.staffId,
      clientId: appointments.clientId,
      date: appointments.date,
      startTime: appointments.startTime,
      endTime: appointments.endTime,
      status: appointments.status,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.salonId, salonId),
        eq(appointments.date, date),
        or(eq(appointments.staffId, staffId), eq(appointments.clientId, clientId))
      )
    )

  return detectScheduleOverlaps(rows, {
    staffId,
    clientId,
    date,
    startTime,
    endTime,
    excludeId,
    salonId,
  })
}
