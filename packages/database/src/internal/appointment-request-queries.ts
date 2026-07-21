import { and, asc, eq, gte, lt, type SQL } from 'drizzle-orm'
import { normalizePhone } from '@repo/salon-core/phone'
import { salonTodayYmd } from '@repo/salon-core/salon-local-time'

import { getDb } from '../client'
import { appointmentRequests, clients, organization, services } from '../schema'
import { createAppointment } from './appointment-queries'
import { validateCreateAppointmentIntake } from './appointment-intake'
import { getClientByPhone, createClient } from './client-queries'

export type AppointmentRequestRow = typeof appointmentRequests.$inferSelect

export type AppointmentRequestStatus = AppointmentRequestRow['status']

type AppointmentRequestListItemBase = Omit<
  AppointmentRequestRow,
  'timingMode'
> & {
  existingClient: { id: string; name: string } | null
}

export type AppointmentRequestListItem =
  | (AppointmentRequestListItemBase & { timingMode: 'exact' })
  | (AppointmentRequestListItemBase & {
      timingMode: 'flexible'
      closureNote: string | null
    })

export type ListAppointmentRequestsFilter = {
  /** Defaults to `'pending'`. */
  status?: AppointmentRequestStatus
  /**
   * Only include requests with `requestedDate >= fromDate` (YYYY-MM-DD).
   * Defaults to `salonTodayYmd()` for `'pending'`, and undefined otherwise.
   */
  fromDate?: string
  timingMode?: AppointmentRequestRow['timingMode']
}

/**
 * Manager inbox query. `pending` filter additionally limits to
 * `requestedDate >= salonToday` so dead entries don't accumulate.
 * `existingClient` is precomputed per row via phone lookup.
 */
export async function listAppointmentRequests(
  salonId: string,
  filter: ListAppointmentRequestsFilter = {},
): Promise<AppointmentRequestListItem[]> {
  const db = getDb()
  const status = filter.status ?? 'pending'
  const conditions: SQL[] = [
    eq(appointmentRequests.salonId, salonId),
    eq(appointmentRequests.status, status),
  ]
  if (filter.timingMode) {
    conditions.push(eq(appointmentRequests.timingMode, filter.timingMode))
  }
  const effectiveFromDate =
    filter.fromDate ??
    (status === 'pending' && filter.timingMode !== 'flexible'
      ? salonTodayYmd()
      : undefined)
  if (effectiveFromDate) {
    conditions.push(gte(appointmentRequests.requestedDate, effectiveFromDate))
  }

  const rows = await db
    .select()
    .from(appointmentRequests)
    .where(and(...conditions))
    .orderBy(
      asc(appointmentRequests.requestedDate),
      asc(appointmentRequests.requestedStartTime),
    )

  if (rows.length === 0) return []

  const phones = [...new Set(rows.map((row) => row.customerPhone))]
  const clientRows = await db
    .select({ id: clients.id, name: clients.name, phone: clients.phone })
    .from(clients)
    .where(and(eq(clients.salonId, salonId), eq(clients.isPlaceholder, false)))
  const byPhone = new Map<string, { id: string; name: string }>()
  for (const row of clientRows) {
    if (row.phone && phones.includes(row.phone)) {
      byPhone.set(row.phone, { id: row.id, name: row.name })
    }
  }

  return rows.map((row): AppointmentRequestListItem => {
    const existingClient =
      (row.clientId
        ? clientRows.find((client) => client.id === row.clientId)
        : undefined) ??
      byPhone.get(row.customerPhone) ??
      null
    return row.timingMode === 'flexible'
      ? {
          ...row,
          timingMode: 'flexible',
          closureNote: row.rejectionReason,
          existingClient,
        }
      : { ...row, timingMode: 'exact', existingClient }
  })
}

export type TimePreference = NonNullable<
  AppointmentRequestRow['timePreference']
>

export type CreateFlexibleAppointmentRequestInput = {
  salonId: string
  clientId: string
  serviceId: string
  acceptableDates: string[]
  timePreference: TimePreference
  notes?: string
}

export type CreateFlexibleAppointmentRequestResult =
  | { ok: true; request: AppointmentRequestListItem }
  | { ok: false; status: 404; error: string }

export async function createFlexibleAppointmentRequest(
  input: CreateFlexibleAppointmentRequestInput,
): Promise<CreateFlexibleAppointmentRequestResult> {
  const db = getDb()
  const [client] = await db
    .select()
    .from(clients)
    .where(
      and(eq(clients.id, input.clientId), eq(clients.salonId, input.salonId)),
    )
    .limit(1)
  if (!client) {
    return { ok: false, status: 404, error: 'مشتری یافت نشد' }
  }

  const [service] = await db
    .select()
    .from(services)
    .where(
      and(
        eq(services.id, input.serviceId),
        eq(services.salonId, input.salonId),
        eq(services.active, true),
        eq(services.kind, 'standard'),
      ),
    )
    .limit(1)
  if (!service) {
    return { ok: false, status: 404, error: 'خدمت فعال یافت نشد' }
  }

  const [request] = await db
    .insert(appointmentRequests)
    .values({
      salonId: input.salonId,
      clientId: client.id,
      serviceId: service.id,
      timingMode: 'flexible',
      acceptableDates: input.acceptableDates,
      timePreference: input.timePreference,
      customerName: client.name,
      customerPhone: client.phone ?? '',
      notes: input.notes,
      bookedServiceName: service.name,
      bookedServiceDuration: service.duration,
      bookedServicePrice: service.price,
    })
    .returning()

  return {
    ok: true,
    request: {
      ...request,
      timingMode: 'flexible',
      closureNote: null,
      existingClient: { id: client.id, name: client.name },
    },
  }
}

export async function lookupClientByPhone(
  salonId: string,
  phone: string,
): Promise<{ id: string; name: string } | null> {
  const client = await getClientByPhone(phone, salonId)
  if (!client) return null
  return { id: client.id, name: client.name }
}

export type ApproveAppointmentRequestInput = {
  id: string
  salonId: string
  staffId: string
  reviewedByUserId: string
}

export type ApproveAppointmentRequestResult =
  | { ok: true; appointmentId: string; clientId: string }
  | { ok: false; status: number; error: string; code?: string }

/**
 * Atomically flips `pending` → `approved`, lookup-or-creates a client by the
 * request's phone, re-runs `Appointment Intake` (which may 409 if the slot
 * was taken since submit), and inserts the `Appointment` with the request's
 * snapshot honored.
 */
export async function approveAppointmentRequest(
  input: ApproveAppointmentRequestInput,
): Promise<ApproveAppointmentRequestResult> {
  const db = getDb()

  const [request] = await db
    .select()
    .from(appointmentRequests)
    .where(
      and(
        eq(appointmentRequests.id, input.id),
        eq(appointmentRequests.salonId, input.salonId),
      ),
    )
    .limit(1)
  if (!request) {
    return { ok: false, status: 404, error: 'درخواست یافت نشد' }
  }
  if (request.status !== 'pending') {
    return { ok: false, status: 409, error: 'این درخواست قابل تأیید نیست' }
  }
  if (
    request.timingMode !== 'exact' ||
    !request.requestedDate ||
    !request.requestedStartTime
  ) {
    return { ok: false, status: 409, error: 'این پیش‌نویس باید زمان‌بندی شود' }
  }

  const normalizedPhone = normalizePhone(request.customerPhone)
  let client = await getClientByPhone(normalizedPhone, input.salonId)
  if (!client) {
    client = await createClient({
      salonId: input.salonId,
      name: request.customerName,
      phone: normalizedPhone,
    })
  }

  const intake = await validateCreateAppointmentIntake({
    salonId: input.salonId,
    clientId: client.id,
    staffId: input.staffId,
    serviceId: request.serviceId,
    date: request.requestedDate,
    startTime: request.requestedStartTime,
    notes: request.notes ?? undefined,
  })
  if (!intake.ok) {
    return {
      ok: false,
      status: intake.status,
      error: intake.error,
      ...(intake.code ? { code: intake.code } : {}),
    }
  }

  const appointment = await createAppointment(intake.command, input.salonId, {
    createdByUserId: input.reviewedByUserId,
    serviceSnapshotOverride: {
      name: request.bookedServiceName,
      duration: request.bookedServiceDuration,
      price: request.bookedServicePrice,
    },
  })

  // Conditional flip — if a concurrent action moved the request, undo our work.
  const updated = await db
    .update(appointmentRequests)
    .set({
      status: 'approved',
      staffId: input.staffId,
      reviewedByUserId: input.reviewedByUserId,
      reviewedAt: new Date(),
      appointmentId: appointment.id,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(appointmentRequests.id, input.id),
        eq(appointmentRequests.salonId, input.salonId),
        eq(appointmentRequests.status, 'pending'),
      ),
    )
    .returning({ id: appointmentRequests.id })

  if (updated.length === 0) {
    return { ok: false, status: 409, error: 'این درخواست قابل تأیید نیست' }
  }

  return { ok: true, appointmentId: appointment.id, clientId: client.id }
}

export type RejectAppointmentRequestInput = {
  id: string
  salonId: string
  reviewedByUserId: string
  reason?: string
}

export type RejectAppointmentRequestResult =
  | { ok: true }
  | { ok: false; status: number; error: string }

type CloseAppointmentRequestInput = {
  id: string
  salonId: string
  reviewedByUserId: string
  closureNote?: string
}

async function closeAppointmentRequest(
  input: CloseAppointmentRequestInput,
  status: 'rejected' | 'cancelled',
): Promise<RejectAppointmentRequestResult> {
  const db = getDb()
  const updated = await db
    .update(appointmentRequests)
    .set({
      status,
      reviewedByUserId: input.reviewedByUserId,
      reviewedAt: new Date(),
      rejectionReason: input.closureNote,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(appointmentRequests.id, input.id),
        eq(appointmentRequests.salonId, input.salonId),
        eq(appointmentRequests.status, 'pending'),
        ...(status === 'cancelled'
          ? [eq(appointmentRequests.timingMode, 'flexible')]
          : []),
      ),
    )
    .returning({ id: appointmentRequests.id })
  if (updated.length > 0) return { ok: true }

  const [existing] = await db
    .select({ id: appointmentRequests.id })
    .from(appointmentRequests)
    .where(
      and(
        eq(appointmentRequests.id, input.id),
        eq(appointmentRequests.salonId, input.salonId),
      ),
    )
    .limit(1)
  if (!existing) return { ok: false, status: 404, error: 'درخواست یافت نشد' }
  return {
    ok: false,
    status: 409,
    error:
      status === 'rejected'
        ? 'این درخواست قابل رد نیست'
        : 'این درخواست قابل لغو نیست',
  }
}

export async function rejectAppointmentRequest(
  input: RejectAppointmentRequestInput,
): Promise<RejectAppointmentRequestResult> {
  return closeAppointmentRequest(
    { ...input, ...(input.reason ? { closureNote: input.reason } : {}) },
    'rejected',
  )
}

export type ManagerCancelAppointmentRequestInput = CloseAppointmentRequestInput

export type ManagerCancelAppointmentRequestResult =
  RejectAppointmentRequestResult

export async function cancelAppointmentRequest(
  input: ManagerCancelAppointmentRequestInput,
): Promise<ManagerCancelAppointmentRequestResult> {
  return closeAppointmentRequest(input, 'cancelled')
}

export type AppointmentRequestNotificationContext = {
  requestId: string
  salonId: string
  salonName: string
  salonSlug: string
  customerName: string
  customerPhone: string
  serviceName: string
  requestedDate: string
  requestedStartTime: string
}

/**
 * Compact view used to render a "new appointment request" notification.
 * Returns `undefined` if the request was deleted between submit and dispatch.
 */
export async function getAppointmentRequestNotificationContext(
  requestId: string,
): Promise<AppointmentRequestNotificationContext | undefined> {
  const db = getDb()
  const rows = await db
    .select({
      id: appointmentRequests.id,
      salonId: appointmentRequests.salonId,
      customerName: appointmentRequests.customerName,
      customerPhone: appointmentRequests.customerPhone,
      serviceName: appointmentRequests.bookedServiceName,
      requestedDate: appointmentRequests.requestedDate,
      requestedStartTime: appointmentRequests.requestedStartTime,
      salonName: organization.name,
      salonSlug: organization.slug,
    })
    .from(appointmentRequests)
    .innerJoin(organization, eq(organization.id, appointmentRequests.salonId))
    .where(eq(appointmentRequests.id, requestId))
    .limit(1)
  const row = rows[0]
  if (!row || !row.requestedDate || !row.requestedStartTime) return undefined
  return {
    requestId: row.id,
    salonId: row.salonId,
    salonName: row.salonName,
    salonSlug: row.salonSlug,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    serviceName: row.serviceName,
    requestedDate: row.requestedDate,
    requestedStartTime: row.requestedStartTime,
  }
}

export type AppointmentRequestCallbackContext = {
  requestId: string
  salonId: string
  status: AppointmentRequestStatus
  serviceId: string
  customerName: string
  requestedDate: string
  requestedStartTime: string
}

/**
 * Compact lookup for the messaging-callback dispatcher: enough to authorize the
 * caller against the request's salon, decide on auto-staff-assignment, and short-
 * circuit when the request is already non-pending.
 */
export async function getAppointmentRequestForCallback(
  requestId: string,
): Promise<AppointmentRequestCallbackContext | undefined> {
  const db = getDb()
  const rows = await db
    .select({
      id: appointmentRequests.id,
      salonId: appointmentRequests.salonId,
      status: appointmentRequests.status,
      serviceId: appointmentRequests.serviceId,
      customerName: appointmentRequests.customerName,
      requestedDate: appointmentRequests.requestedDate,
      requestedStartTime: appointmentRequests.requestedStartTime,
    })
    .from(appointmentRequests)
    .where(eq(appointmentRequests.id, requestId))
    .limit(1)
  const row = rows[0]
  if (!row || !row.requestedDate || !row.requestedStartTime) return undefined
  return {
    requestId: row.id,
    salonId: row.salonId,
    status: row.status,
    serviceId: row.serviceId,
    customerName: row.customerName,
    requestedDate: row.requestedDate,
    requestedStartTime: row.requestedStartTime,
  }
}

/**
 * Cron entrypoint — moves stale `pending` requests
 * (`requestedDate < salonToday`) to `expired`. Returns the number of rows
 * touched. See plan §7.
 */
export async function expirePastDueAppointmentRequests(
  now?: Date,
): Promise<number> {
  const db = getDb()
  const today = salonTodayYmd(now ?? new Date())
  const updated = await db
    .update(appointmentRequests)
    .set({ status: 'expired', reviewedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(appointmentRequests.status, 'pending'),
        lt(appointmentRequests.requestedDate, today),
      ),
    )
    .returning({ id: appointmentRequests.id })
  return updated.length
}
