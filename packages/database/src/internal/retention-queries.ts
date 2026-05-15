import type {
  AppointmentWithDetails,
  Client,
  FollowUpReason,
  RetentionItem,
} from '@repo/salon-core/types'
import { addDaysYmd, salonTodayYmd } from '@repo/salon-core/salon-local-time'
import { getDb } from '../client'
import { clientFollowUps } from '../schema'
import { rowToClientFollowUp } from './row-mappers'
import { getClientFollowUps } from './client-followup-queries'
import { getAppointmentsWithDetailsByDateRange } from './appointment-queries'
import { getAllClients } from './client-queries'

type RetentionCandidate = {
  client: Client
  reason: FollowUpReason
  dueDate: string
  suggestedReason: string
  completedCount: number
  estimatedSpend: number
  noShowCount: number
  lastVisitDate: string | null
  lastServiceName: string | null
}

type ClientRetentionHistory = {
  client: Client
  rows: AppointmentWithDetails[]
  completed: AppointmentWithDetails[]
  noShows: AppointmentWithDetails[]
  lastCompleted: AppointmentWithDetails | undefined
  estimatedSpend: number
}

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

function buildClientRetentionHistory(
  clients: Client[],
  appointments: AppointmentWithDetails[]
): ClientRetentionHistory[] {
  const byClient = appointmentsByClient(appointments)

  return clients.map((client) => {
    const rows = byClient.get(client.id) ?? []
    const completed = rows.filter((appointment) => appointment.status === 'completed')
    const noShows = rows.filter((appointment) => appointment.status === 'no-show')
    const lastCompleted = completed
      .slice()
      .sort((a, b) => `${b.date} ${b.startTime}`.localeCompare(`${a.date} ${a.startTime}`))[0]

    return {
      client,
      rows,
      completed,
      noShows,
      lastCompleted,
      estimatedSpend: completed.reduce(
        (sum, appointment) => sum + appointment.bookedServicePrice,
        0
      ),
    }
  })
}

function addLifecycleCandidates(input: {
  candidates: Map<string, RetentionCandidate>
  histories: ClientRetentionHistory[]
  today: string
  inactiveCutoff: string
}) {
  const { candidates, histories, today, inactiveCutoff } = input

  for (const item of histories) {
    const lastVisitDate = item.lastCompleted?.date ?? null
    const base = {
      client: item.client,
      dueDate: today,
      completedCount: item.completed.length,
      estimatedSpend: item.estimatedSpend,
      noShowCount: item.noShows.length,
      lastVisitDate,
      lastServiceName: item.lastCompleted?.bookedServiceName ?? null,
    }

    if (item.completed.length > 0 && lastVisitDate && lastVisitDate < inactiveCutoff) {
      candidates.set(`${item.client.id}:inactive`, {
        ...base,
        reason: 'inactive',
        suggestedReason: '۶۰ روز از آخرین مراجعه گذشته است.',
      })
    }

    if (
      item.completed.length === 1 &&
      !item.rows.some((appointment) => appointment.date > today && appointment.status !== 'cancelled')
    ) {
      candidates.set(`${item.client.id}:new-client`, {
        ...base,
        reason: 'new-client',
        suggestedReason: 'بعد از اولین مراجعه هنوز نوبت دوم ثبت نشده است.',
      })
    }

    if (item.noShows.length > 0) {
      candidates.set(`${item.client.id}:no-show`, {
        ...base,
        reason: 'no-show',
        suggestedReason: `${item.noShows.length} غیبت نیاز به بررسی دارد.`,
      })
    }
  }
}

function addVipCandidates(input: {
  candidates: Map<string, RetentionCandidate>
  histories: ClientRetentionHistory[]
  today: string
}) {
  const { candidates, histories, today } = input

  for (const item of histories
    .filter((row) => row.completed.length > 0)
    .sort((a, b) => b.estimatedSpend - a.estimatedSpend || b.completed.length - a.completed.length)
    .slice(0, 5)) {
    candidates.set(`${item.client.id}:vip`, {
      client: item.client,
      reason: 'vip',
      dueDate: today,
      completedCount: item.completed.length,
      estimatedSpend: item.estimatedSpend,
      noShowCount: item.noShows.length,
      lastVisitDate: item.lastCompleted?.date ?? null,
      lastServiceName: item.lastCompleted?.bookedServiceName ?? null,
      suggestedReason: 'جزو مشتریان ارزشمند سالن است.',
    })
  }
}

function buildRetentionCandidates(input: {
  clients: Client[]
  appointments: AppointmentWithDetails[]
  today: string
}): Map<string, RetentionCandidate> {
  const candidates = new Map<string, RetentionCandidate>()
  const histories = buildClientRetentionHistory(input.clients, input.appointments)
  const inactiveCutoff = addDaysYmd(input.today, -60)

  addLifecycleCandidates({
    candidates,
    histories,
    today: input.today,
    inactiveCutoff,
  })
  addVipCandidates({ candidates, histories, today: input.today })

  return candidates
}

export async function getRetentionQueue(salonId: string): Promise<RetentionItem[]> {
  const db = getDb()
  const today = salonTodayYmd()
  const [clientRows, appointmentRows, existingRows] = await Promise.all([
    getAllClients(salonId),
    getAppointmentsWithDetailsByDateRange(salonId, '1900-01-01', today),
    getClientFollowUps(salonId),
  ])

  const candidates = buildRetentionCandidates({
    clients: clientRows,
    appointments: appointmentRows,
    today,
  })
  const existingByKey = new Map(existingRows.map((row) => [`${row.clientId}:${row.reason}`, row]))
  const result: RetentionItem[] = []

  for (const candidate of candidates.values()) {
    const existing = existingByKey.get(`${candidate.client.id}:${candidate.reason}`)
    if (existing && existing.status !== 'open') continue

    const followUp =
      existing ??
      rowToClientFollowUp(
        (
          await db
            .insert(clientFollowUps)
            .values({
              salonId,
              clientId: candidate.client.id,
              reason: candidate.reason,
              status: 'open',
              dueDate: candidate.dueDate,
            })
            .onConflictDoUpdate({
              target: [clientFollowUps.salonId, clientFollowUps.clientId, clientFollowUps.reason],
              set: { updatedAt: new Date() },
            })
            .returning()
        )[0]
      )

    result.push({
      id: followUp.id,
      client: candidate.client,
      reason: candidate.reason,
      status: followUp.status,
      dueDate: followUp.dueDate,
      lastVisitDate: candidate.lastVisitDate,
      lastServiceName: candidate.lastServiceName,
      completedCount: candidate.completedCount,
      estimatedSpend: candidate.estimatedSpend,
      noShowCount: candidate.noShowCount,
      suggestedReason: candidate.suggestedReason,
    })
  }

  return result.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}
