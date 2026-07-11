import { and, asc, desc, eq } from 'drizzle-orm'
import type {
  ClientFollowUp,
  ClientSummary,
  FollowUpReason,
  FollowUpStatus,
} from '@repo/salon-core/types'
import { salonTodayYmd } from '@repo/salon-core/salon-local-time'
import { getDb } from '../client'
import {
  clientFollowUpMessageDeliveries,
  clientFollowUps,
  clients,
  organization,
} from '../schema'
import { rowToClientFollowUp } from './row-mappers'
import { getClientAppointmentsWithDetails } from './appointment-queries'
import { getClientById, getClientTags } from './client-queries'

export type ClientFollowUpMessageDeliveryProvider = 'bale_safir'
export type ClientFollowUpMessageDeliveryStatus = 'sent' | 'failed' | 'skipped'

export type ClientFollowUpMessageDelivery = {
  id: string
  salonId: string
  followUpId: string
  clientId: string
  provider: ClientFollowUpMessageDeliveryProvider
  phone: string
  requestId: string
  status: ClientFollowUpMessageDeliveryStatus
  providerMessageId: string | null
  error: string | null
  sentByUserId: string | null
  createdAt: Date
  sentAt: Date | null
}

export type ClientFollowUpMessageContext = {
  followUp: ClientFollowUp
  client: {
    id: string
    name: string
    phone: string | null
  }
  salon: {
    id: string
    name: string
  }
}

function rowToClientFollowUpMessageDelivery(
  row: typeof clientFollowUpMessageDeliveries.$inferSelect,
): ClientFollowUpMessageDelivery {
  return {
    id: row.id,
    salonId: row.salonId,
    followUpId: row.followUpId,
    clientId: row.clientId,
    provider: row.provider,
    phone: row.phone,
    requestId: row.requestId,
    status: row.status,
    providerMessageId: row.providerMessageId,
    error: row.error,
    sentByUserId: row.sentByUserId,
    createdAt: row.createdAt,
    sentAt: row.sentAt,
  }
}

export async function getClientSummary(
  salonId: string,
  clientId: string,
): Promise<ClientSummary | null> {
  const [client, tags, allAppointments, openFollowUps] = await Promise.all([
    getClientById(clientId, salonId),
    getClientTags(clientId, salonId),
    getClientAppointmentsWithDetails(salonId, clientId),
    getClientFollowUps(salonId, { clientId, status: 'open' }),
  ])
  if (!client) return null

  const today = salonTodayYmd()
  const upcomingAppointment =
    allAppointments
      .filter(
        (appointment) =>
          appointment.date >= today &&
          appointment.status !== 'cancelled' &&
          appointment.status !== 'no-show',
      )
      .sort((a, b) =>
        `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`),
      )[0] ?? null

  const completed = allAppointments.filter(
    (appointment) => appointment.status === 'completed',
  )
  const cancelled = allAppointments.filter(
    (appointment) => appointment.status === 'cancelled',
  )
  const noShows = allAppointments.filter(
    (appointment) => appointment.status === 'no-show',
  )
  const estimatedSpend = completed.reduce(
    (sum, appointment) => sum + appointment.bookedServicePrice,
    0,
  )
  const lastCompleted = completed
    .slice()
    .sort((a, b) =>
      `${b.date} ${b.startTime}`.localeCompare(`${a.date} ${a.startTime}`),
    )[0]

  const serviceCounts = new Map<string, { name: string; count: number }>()
  for (const appointment of completed) {
    const current = serviceCounts.get(appointment.bookedServiceName) ?? {
      name: appointment.bookedServiceName,
      count: 0,
    }
    current.count += 1
    serviceCounts.set(appointment.bookedServiceName, current)
  }
  const favoriteService = [...serviceCounts.values()].sort(
    (a, b) => b.count - a.count,
  )[0]

  return {
    client: { ...client, tags },
    tags,
    upcomingAppointment,
    history: allAppointments,
    stats: {
      completedCount: completed.length,
      cancelledCount: cancelled.length,
      noShowCount: noShows.length,
      estimatedSpend,
      lastVisitDate: lastCompleted?.date ?? null,
      favoriteServiceName: favoriteService?.name ?? null,
      lastStaffName: lastCompleted?.staff.name ?? null,
      totalCompletedVisits: completed.length,
    },
    openFollowUps,
  }
}

export async function getClientFollowUps(
  salonId: string,
  options?: { clientId?: string; status?: FollowUpStatus },
): Promise<ClientFollowUp[]> {
  const db = getDb()
  const conditions = [eq(clientFollowUps.salonId, salonId)]
  if (options?.clientId)
    conditions.push(eq(clientFollowUps.clientId, options.clientId))
  if (options?.status)
    conditions.push(eq(clientFollowUps.status, options.status))

  const rows = await db
    .select()
    .from(clientFollowUps)
    .where(and(...conditions))
    .orderBy(asc(clientFollowUps.dueDate), desc(clientFollowUps.createdAt))
  return rows.map(rowToClientFollowUp)
}

export async function createClientFollowUp(
  salonId: string,
  clientId: string,
  reason: FollowUpReason,
  dueDate = salonTodayYmd(),
): Promise<ClientFollowUp> {
  const db = getDb()
  const [row] = await db
    .insert(clientFollowUps)
    .values({
      salonId,
      clientId,
      reason,
      status: 'open',
      dueDate,
    })
    .onConflictDoUpdate({
      target: [
        clientFollowUps.salonId,
        clientFollowUps.clientId,
        clientFollowUps.reason,
      ],
      set: {
        status: 'open',
        dueDate,
        reviewedAt: null,
        updatedAt: new Date(),
      },
    })
    .returning()
  return rowToClientFollowUp(row)
}

export async function updateClientFollowUpStatus(
  salonId: string,
  id: string,
  status: FollowUpStatus,
): Promise<ClientFollowUp | undefined> {
  const db = getDb()
  const [row] = await db
    .update(clientFollowUps)
    .set({
      status,
      reviewedAt: status === 'reviewed' ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(
      and(eq(clientFollowUps.salonId, salonId), eq(clientFollowUps.id, id)),
    )
    .returning()
  return row ? rowToClientFollowUp(row) : undefined
}

export async function getClientFollowUpMessageContext(
  salonId: string,
  followUpId: string,
): Promise<ClientFollowUpMessageContext | null> {
  const db = getDb()
  const [row] = await db
    .select({
      followUp: clientFollowUps,
      clientId: clients.id,
      clientName: clients.name,
      clientPhone: clients.phone,
      salonId: organization.id,
      salonName: organization.name,
    })
    .from(clientFollowUps)
    .innerJoin(clients, eq(clients.id, clientFollowUps.clientId))
    .innerJoin(organization, eq(organization.id, clientFollowUps.salonId))
    .where(
      and(
        eq(clientFollowUps.salonId, salonId),
        eq(clientFollowUps.id, followUpId),
      ),
    )
    .limit(1)

  if (!row) return null

  return {
    followUp: rowToClientFollowUp(row.followUp),
    client: {
      id: row.clientId,
      name: row.clientName,
      phone: row.clientPhone,
    },
    salon: {
      id: row.salonId,
      name: row.salonName,
    },
  }
}

export async function getLatestClientFollowUpMessageDelivery(input: {
  salonId: string
  followUpId: string
  provider: ClientFollowUpMessageDeliveryProvider
}): Promise<ClientFollowUpMessageDelivery | null> {
  const db = getDb()
  const [row] = await db
    .select()
    .from(clientFollowUpMessageDeliveries)
    .where(
      and(
        eq(clientFollowUpMessageDeliveries.salonId, input.salonId),
        eq(clientFollowUpMessageDeliveries.followUpId, input.followUpId),
        eq(clientFollowUpMessageDeliveries.provider, input.provider),
      ),
    )
    .orderBy(desc(clientFollowUpMessageDeliveries.createdAt))
    .limit(1)

  return row ? rowToClientFollowUpMessageDelivery(row) : null
}

export async function createClientFollowUpMessageDelivery(input: {
  salonId: string
  followUpId: string
  clientId: string
  provider: ClientFollowUpMessageDeliveryProvider
  phone: string
  requestId: string
  status: ClientFollowUpMessageDeliveryStatus
  providerMessageId?: string | null
  error?: string | null
  sentByUserId: string
}): Promise<ClientFollowUpMessageDelivery> {
  const db = getDb()
  const [row] = await db
    .insert(clientFollowUpMessageDeliveries)
    .values({
      salonId: input.salonId,
      followUpId: input.followUpId,
      clientId: input.clientId,
      provider: input.provider,
      phone: input.phone,
      requestId: input.requestId,
      status: input.status,
      providerMessageId: input.providerMessageId ?? null,
      error: input.error ?? null,
      sentByUserId: input.sentByUserId,
      sentAt: input.status === 'sent' ? new Date() : null,
    })
    .returning()

  return rowToClientFollowUpMessageDelivery(row)
}
