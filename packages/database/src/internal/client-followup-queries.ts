import { and, asc, desc, eq } from 'drizzle-orm'
import type {
  ClientFollowUp,
  ClientSummary,
  FollowUpReason,
  FollowUpStatus,
} from '@repo/salon-core/types'
import { salonTodayYmd } from '@repo/salon-core/salon-local-time'
import { getDb } from '../client'
import { clientFollowUps } from '../schema'
import { rowToClientFollowUp } from './row-mappers'
import { getClientAppointmentsWithDetails } from './appointment-queries'
import { getClientById, getClientTags } from './client-queries'

export async function getClientSummary(
  salonId: string,
  clientId: string
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
      .filter((appointment) => appointment.date >= today && appointment.status !== 'cancelled' && appointment.status !== 'no-show')
      .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`))[0] ??
    null

  const completed = allAppointments.filter((appointment) => appointment.status === 'completed')
  const cancelled = allAppointments.filter((appointment) => appointment.status === 'cancelled')
  const noShows = allAppointments.filter((appointment) => appointment.status === 'no-show')
  const estimatedSpend = completed.reduce(
    (sum, appointment) => sum + appointment.bookedServicePrice,
    0
  )
  const lastCompleted = completed
    .slice()
    .sort((a, b) => `${b.date} ${b.startTime}`.localeCompare(`${a.date} ${a.startTime}`))[0]

  const serviceCounts = new Map<string, { name: string; count: number }>()
  for (const appointment of completed) {
    const current = serviceCounts.get(appointment.bookedServiceName) ?? {
      name: appointment.bookedServiceName,
      count: 0,
    }
    current.count += 1
    serviceCounts.set(appointment.bookedServiceName, current)
  }
  const favoriteService = [...serviceCounts.values()].sort((a, b) => b.count - a.count)[0]

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
  options?: { clientId?: string; status?: FollowUpStatus }
): Promise<ClientFollowUp[]> {
  const db = getDb()
  const conditions = [eq(clientFollowUps.salonId, salonId)]
  if (options?.clientId) conditions.push(eq(clientFollowUps.clientId, options.clientId))
  if (options?.status) conditions.push(eq(clientFollowUps.status, options.status))

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
  dueDate = salonTodayYmd()
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
      target: [clientFollowUps.salonId, clientFollowUps.clientId, clientFollowUps.reason],
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
  status: FollowUpStatus
): Promise<ClientFollowUp | undefined> {
  const db = getDb()
  const [row] = await db
    .update(clientFollowUps)
    .set({
      status,
      reviewedAt: status === 'reviewed' ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(and(eq(clientFollowUps.salonId, salonId), eq(clientFollowUps.id, id)))
    .returning()
  return row ? rowToClientFollowUp(row) : undefined
}
