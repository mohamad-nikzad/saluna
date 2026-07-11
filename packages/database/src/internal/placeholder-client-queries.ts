import { and, count, eq } from 'drizzle-orm'
import type { AppointmentWithDetails, Client } from '@repo/salon-core/types'
import { normalizePhone } from '@repo/salon-core/phone'
import { getDb } from '../client'
import {
  appointments,
  clients,
  member,
  salonMember,
  services,
  user,
} from '../schema'
import {
  attachAppointmentDetails,
  rowToClient,
  staffUserSelect,
} from './row-mappers'
import {
  createClient,
  getClientByPhone,
  isClientProvidedEntityId,
} from './client-queries'

type PlaceholderFailure = {
  ok: false
  status: number
  error: string
  code?: string
  existingClient?: Client
}

type PlaceholderSuccess = {
  ok: true
  appointment: AppointmentWithDetails
  outcome: 'completed' | 'reassigned'
}

type PlaceholderUsageValidationResult =
  | { ok: true; client: Client }
  | PlaceholderFailure

export type CancelIncompletePlaceholderAppointmentResult =
  | PlaceholderFailure
  | {
      ok: true
      appointmentDeleted: boolean
      placeholderDeleted: boolean
      clientId: string
    }

export type CompletePlaceholderAppointmentClientResult =
  | PlaceholderFailure
  | PlaceholderSuccess

type PlaceholderDbLike = Pick<ReturnType<typeof getDb>, 'select' | 'delete'>

function fail(
  status: number,
  error: string,
  code?: string,
  existingClient?: Client,
): PlaceholderFailure {
  return {
    ok: false,
    status,
    error,
    ...(code ? { code } : {}),
    ...(existingClient ? { existingClient } : {}),
  }
}

export async function createPlaceholderClient(input: {
  salonId: string
  name: string
  notes?: string
  id?: string
}): Promise<Client> {
  return createClient({
    salonId: input.salonId,
    name: input.name,
    phone: null,
    notes: input.notes,
    isPlaceholder: true,
    ...(isClientProvidedEntityId(input.id) ? { id: input.id } : {}),
  })
}

export async function deletePlaceholderClientIfOrphaned(
  clientId: string,
  salonId: string,
): Promise<boolean> {
  const db = getDb()
  return deletePlaceholderClientIfOrphanedWithDb(db, clientId, salonId)
}

async function deletePlaceholderClientIfOrphanedWithDb(
  db: PlaceholderDbLike,
  clientId: string,
  salonId: string,
): Promise<boolean> {
  const clientRows = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.salonId, salonId)))
    .limit(1)
  const clientRow = clientRows[0]
  if (!clientRow || !clientRow.isPlaceholder) return false

  const usage = await db
    .select({ value: count() })
    .from(appointments)
    .where(
      and(
        eq(appointments.salonId, salonId),
        eq(appointments.clientId, clientId),
      ),
    )
  if ((usage[0]?.value ?? 0) > 0) return false

  const deleted = await db
    .delete(clients)
    .where(and(eq(clients.id, clientId), eq(clients.salonId, salonId)))
    .returning({ id: clients.id })
  return deleted.length > 0
}

export async function validatePlaceholderClientUsage(input: {
  salonId: string
  clientId: string
  appointmentId?: string
}): Promise<PlaceholderUsageValidationResult> {
  const db = getDb()
  const clientRows = await db
    .select()
    .from(clients)
    .where(
      and(eq(clients.id, input.clientId), eq(clients.salonId, input.salonId)),
    )
    .limit(1)

  const clientRow = clientRows[0]
  if (!clientRow) {
    return fail(404, 'مشتری یافت نشد')
  }

  const client = rowToClient(clientRow)
  if (!client.isPlaceholder) {
    return { ok: true, client }
  }

  const usageRows = await db
    .select({ appointmentId: appointments.id })
    .from(appointments)
    .where(
      and(
        eq(appointments.salonId, input.salonId),
        eq(appointments.clientId, input.clientId),
      ),
    )
    .limit(2)

  const conflictingUsage = usageRows.find(
    (row) => !input.appointmentId || row.appointmentId !== input.appointmentId,
  )
  if (conflictingUsage) {
    return fail(
      409,
      'این مشتری موقت قبلاً به نوبت دیگری وصل شده است',
      'placeholder-reuse',
    )
  }

  return { ok: true, client }
}

export async function cleanupPlaceholderAfterAppointmentMutation(input: {
  salonId: string
  previousClientId?: string | null
  nextClientId?: string | null
  deletedAppointmentId?: string
}): Promise<boolean> {
  if (!input.previousClientId) return false
  if (input.nextClientId && input.previousClientId === input.nextClientId)
    return false
  return deletePlaceholderClientIfOrphaned(
    input.previousClientId,
    input.salonId,
  )
}

export async function cancelIncompletePlaceholderAppointment(input: {
  salonId: string
  appointmentId: string
}): Promise<CancelIncompletePlaceholderAppointmentResult> {
  const db = getDb()
  const appointmentRows = await db
    .select({
      appointmentId: appointments.id,
      clientId: clients.id,
      isPlaceholder: clients.isPlaceholder,
    })
    .from(appointments)
    .innerJoin(
      clients,
      and(
        eq(appointments.clientId, clients.id),
        eq(clients.salonId, input.salonId),
      ),
    )
    .where(
      and(
        eq(appointments.id, input.appointmentId),
        eq(appointments.salonId, input.salonId),
      ),
    )
    .limit(1)

  const row = appointmentRows[0]
  if (!row) {
    return fail(404, 'نوبت یافت نشد')
  }
  if (!row.isPlaceholder) {
    return fail(400, 'این نوبت مشتری موقت ندارد')
  }

  return db.transaction(async (tx) => {
    const deleted = await tx
      .delete(appointments)
      .where(
        and(
          eq(appointments.id, input.appointmentId),
          eq(appointments.salonId, input.salonId),
        ),
      )
      .returning({ id: appointments.id })

    const placeholderDeleted = await deletePlaceholderClientIfOrphanedWithDb(
      tx,
      row.clientId,
      input.salonId,
    )

    return {
      ok: true as const,
      appointmentDeleted: deleted.length > 0,
      placeholderDeleted,
      clientId: row.clientId,
    }
  })
}

export async function completePlaceholderAppointmentClient(input: {
  salonId: string
  appointmentId: string
  name: string
  phone: string
  notes?: string
  reassignToExistingClientId?: string
}): Promise<CompletePlaceholderAppointmentClientResult> {
  const db = getDb()
  const appointmentRows = await db
    .select({
      appointment: appointments,
      client: clients,
    })
    .from(appointments)
    .innerJoin(
      clients,
      and(
        eq(appointments.clientId, clients.id),
        eq(clients.salonId, input.salonId),
      ),
    )
    .where(
      and(
        eq(appointments.id, input.appointmentId),
        eq(appointments.salonId, input.salonId),
      ),
    )
    .limit(1)

  const row = appointmentRows[0]
  if (!row) {
    return fail(404, 'نوبت یافت نشد')
  }
  if (!row.client.isPlaceholder) {
    return fail(400, 'این نوبت مشتری موقت ندارد')
  }

  const placeholderClient = rowToClient(row.client)
  const normalizedPhone = normalizePhone(input.phone)
  const existingClient = await getClientByPhone(normalizedPhone, input.salonId)

  if (existingClient && existingClient.id !== placeholderClient.id) {
    if (input.reassignToExistingClientId !== existingClient.id) {
      return fail(
        409,
        'این شماره تماس برای مشتری دیگری ثبت شده است',
        'duplicate-phone',
        existingClient,
      )
    }

    await db.transaction(async (tx) => {
      await tx
        .update(appointments)
        .set({
          clientId: existingClient.id,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(appointments.id, input.appointmentId),
            eq(appointments.salonId, input.salonId),
          ),
        )

      const usage = await tx
        .select({ value: count() })
        .from(appointments)
        .where(
          and(
            eq(appointments.salonId, input.salonId),
            eq(appointments.clientId, placeholderClient.id),
          ),
        )
      if ((usage[0]?.value ?? 0) === 0) {
        await deletePlaceholderClientIfOrphanedWithDb(
          tx,
          placeholderClient.id,
          input.salonId,
        )
      }
    })

    const detail = await getAppointmentWithDetailsOrThrow(
      input.appointmentId,
      input.salonId,
    )
    return {
      ok: true,
      appointment: detail,
      outcome: 'reassigned',
    }
  }

  await db
    .update(clients)
    .set({
      name: input.name.trim(),
      phone: normalizedPhone,
      notes: input.notes?.trim() || null,
      isPlaceholder: false,
    })
    .where(
      and(
        eq(clients.id, placeholderClient.id),
        eq(clients.salonId, input.salonId),
      ),
    )

  const detail = await getAppointmentWithDetailsOrThrow(
    input.appointmentId,
    input.salonId,
  )
  return {
    ok: true,
    appointment: detail,
    outcome: 'completed',
  }
}

async function getAppointmentWithDetailsOrThrow(
  appointmentId: string,
  salonId: string,
): Promise<AppointmentWithDetails> {
  const db = getDb()
  const rows = await db
    .select({
      appointment: appointments,
      client: clients,
      staff: staffUserSelect,
      service: services,
    })
    .from(appointments)
    .innerJoin(
      clients,
      and(eq(appointments.clientId, clients.id), eq(clients.salonId, salonId)),
    )
    .innerJoin(user, eq(appointments.staffId, user.id))
    .innerJoin(
      member,
      and(eq(member.userId, user.id), eq(member.organizationId, salonId)),
    )
    .leftJoin(
      salonMember,
      and(
        eq(salonMember.userId, user.id),
        eq(salonMember.organizationId, salonId),
      ),
    )
    .innerJoin(
      services,
      and(
        eq(appointments.serviceId, services.id),
        eq(services.salonId, salonId),
      ),
    )
    .where(
      and(
        eq(appointments.id, appointmentId),
        eq(appointments.salonId, salonId),
      ),
    )
    .limit(1)
  const row = rows[0]
  if (!row) {
    throw new Error(
      `Appointment ${appointmentId} was not found after placeholder completion`,
    )
  }
  return attachAppointmentDetails(row)
}
