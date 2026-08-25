import { and, asc, eq, gte, inArray, isNull, lte } from 'drizzle-orm'

import { getDb } from '../client'
import {
  appointments,
  appointmentStaffAssignments,
  clients,
  serviceCategories,
  services,
  staffCommissions,
  staffProfileAccesses,
  staffProfiles,
} from '../schema'
import { completedAppointmentBookedTotal } from './appointment-commission-basis'

export type SalonMoneyReportAppointmentCommission = {
  staffProfileId: string
  staffName: string
  basis: number
  percentage: number
  amount: number
}

export type SalonMoneyReportAppointment = {
  appointmentId: string
  date: string
  clientName: string
  serviceName: string
  staffNames: string[]
  bookedTotal: number
  commissions: SalonMoneyReportAppointmentCommission[]
}

export type SalonMoneyReport = {
  startDate: string
  endDate: string
  summary: {
    bookedTotal: number
    staffCommissionTotal: number
    salonRetainedAmount: number
  }
  staff: Array<{
    staffProfileId: string
    staffName: string
    completedCount: number
    /** Sum of this staff member's commission bases (not unique appointment money). */
    commissionBasisTotal: number
    staffCommissionTotal: number
  }>
  appointments: SalonMoneyReportAppointment[]
}

export type SalonMoneyReportResult =
  | { ok: true; report: SalonMoneyReport }
  | { ok: false; reason: 'staff' | 'service' | 'category' }

async function getStaffProfile(salonId: string, staffProfileId: string) {
  const [row] = await getDb()
    .select()
    .from(staffProfiles)
    .where(
      and(
        eq(staffProfiles.salonId, salonId),
        eq(staffProfiles.id, staffProfileId),
      ),
    )
    .limit(1)
  return row
}

async function getSalonService(salonId: string, serviceId: string) {
  const [row] = await getDb()
    .select()
    .from(services)
    .where(and(eq(services.salonId, salonId), eq(services.id, serviceId)))
    .limit(1)
  return row
}

async function getSalonCategory(salonId: string, categoryId: string) {
  const [row] = await getDb()
    .select()
    .from(serviceCategories)
    .where(
      and(
        eq(serviceCategories.salonId, salonId),
        eq(serviceCategories.id, categoryId),
      ),
    )
    .limit(1)
  return row
}

/**
 * In-memory map matching `resolveAppointmentAssignmentStaffProfileId`:
 * Staff Profile id first, then non-revoked access user id.
 */
async function assignmentStaffResolver(
  tx: Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0],
  salonId: string,
) {
  const [profiles, accesses] = await Promise.all([
    tx
      .select({
        id: staffProfiles.id,
        name: staffProfiles.name,
      })
      .from(staffProfiles)
      .where(eq(staffProfiles.salonId, salonId)),
    tx
      .select({
        userId: staffProfileAccesses.userId,
        staffProfileId: staffProfileAccesses.staffProfileId,
      })
      .from(staffProfileAccesses)
      .where(
        and(
          eq(staffProfileAccesses.salonId, salonId),
          isNull(staffProfileAccesses.revokedAt),
        ),
      ),
  ])
  const namesByProfileId = new Map(profiles.map((row) => [row.id, row.name]))
  const profileIdByAccessUserId = new Map(
    accesses.map((row) => [row.userId, row.staffProfileId]),
  )
  function resolve(staffId: string) {
    if (namesByProfileId.has(staffId)) return staffId
    return profileIdByAccessUserId.get(staffId)
  }
  return { namesByProfileId, resolve }
}

export async function getSalonMoneyReport(input: {
  salonId: string
  startDate: string
  endDate: string
  staffProfileId?: string
  serviceId?: string
  categoryId?: string
}): Promise<SalonMoneyReportResult> {
  const [profile, service, category] = await Promise.all([
    input.staffProfileId
      ? getStaffProfile(input.salonId, input.staffProfileId)
      : Promise.resolve(undefined),
    input.serviceId
      ? getSalonService(input.salonId, input.serviceId)
      : Promise.resolve(undefined),
    input.categoryId
      ? getSalonCategory(input.salonId, input.categoryId)
      : Promise.resolve(undefined),
  ])
  if (input.staffProfileId && !profile) return { ok: false, reason: 'staff' }
  if (input.serviceId && !service) return { ok: false, reason: 'service' }
  if (input.categoryId && !category) return { ok: false, reason: 'category' }
  const staffProfileId = profile?.id

  return getDb().transaction(async (tx) => {
    const conditions = [
      eq(appointments.salonId, input.salonId),
      eq(appointments.status, 'completed'),
      gte(appointments.date, input.startDate),
      lte(appointments.date, input.endDate),
    ]
    if (input.serviceId) {
      conditions.push(eq(appointments.serviceId, input.serviceId))
    }
    if (input.categoryId) {
      conditions.push(eq(services.categoryId, input.categoryId))
    }

    const appointmentRows = await tx
      .select({
        appointment: appointments,
        clientName: clients.name,
      })
      .from(appointments)
      .innerJoin(
        clients,
        and(
          eq(clients.id, appointments.clientId),
          eq(clients.salonId, input.salonId),
        ),
      )
      .innerJoin(services, eq(services.id, appointments.serviceId))
      .where(and(...conditions))
      .orderBy(asc(appointments.date), asc(appointments.startTime))

    const { namesByProfileId, resolve: assignmentProfileId } =
      await assignmentStaffResolver(tx, input.salonId)

    const appointmentIds = appointmentRows.map((row) => row.appointment.id)
    const assignmentRows =
      appointmentIds.length === 0
        ? []
        : await tx
            .select()
            .from(appointmentStaffAssignments)
            .where(
              inArray(
                appointmentStaffAssignments.appointmentId,
                appointmentIds,
              ),
            )
            .orderBy(
              asc(appointmentStaffAssignments.isLead),
              asc(appointmentStaffAssignments.createdAt),
            )
    const assignmentsByAppointment = new Map<
      string,
      typeof assignmentRows
    >()
    for (const assignment of assignmentRows) {
      const list =
        assignmentsByAppointment.get(assignment.appointmentId) ?? []
      list.push(assignment)
      assignmentsByAppointment.set(assignment.appointmentId, list)
    }

    // Monthly volumes stay small; staff slice is applied in memory after the
    // period/service/category SQL filter rather than joining assignments twice.
    const matchedAppointments = appointmentRows.filter((row) => {
      if (!staffProfileId) return true
      const assignments =
        assignmentsByAppointment.get(row.appointment.id) ?? []
      return assignments.some(
        (assignment) =>
          assignmentProfileId(assignment.staffId) === staffProfileId,
      )
    })

    const matchedIds = matchedAppointments.map((row) => row.appointment.id)
    const commissionRows =
      matchedIds.length === 0
        ? []
        : await tx
            .select()
            .from(staffCommissions)
            .where(
              and(
                eq(staffCommissions.salonId, input.salonId),
                isNull(staffCommissions.voidedAt),
                inArray(staffCommissions.appointmentId, matchedIds),
              ),
            )
    const commissionsByAppointment = new Map<string, typeof commissionRows>()
    for (const commission of commissionRows) {
      const list =
        commissionsByAppointment.get(commission.appointmentId) ?? []
      list.push(commission)
      commissionsByAppointment.set(commission.appointmentId, list)
    }

    const reportAppointments = await Promise.all(
      matchedAppointments.map(async (row) => {
        const allCommissions =
          commissionsByAppointment.get(row.appointment.id) ?? []
        const assignments =
          assignmentsByAppointment.get(row.appointment.id) ?? []
        const bookedTotal = await completedAppointmentBookedTotal({
          tx,
          appointment: row.appointment,
          commissionBases: allCommissions.map((commission) => commission.basis),
          assignmentCount: assignments.length,
        })
        const visibleCommissions = staffProfileId
          ? allCommissions.filter(
              (commission) => commission.staffProfileId === staffProfileId,
            )
          : allCommissions
        const staffNames: string[] = []
        for (const assignment of assignments) {
          const profileId = assignmentProfileId(assignment.staffId)
          const name = profileId ? namesByProfileId.get(profileId) : undefined
          if (name && !staffNames.includes(name)) staffNames.push(name)
        }
        return {
          appointmentId: row.appointment.id,
          date: row.appointment.date,
          clientName: row.clientName,
          serviceName: row.appointment.bookedServiceName,
          staffNames,
          bookedTotal,
          commissions: visibleCommissions.map((commission) => ({
            staffProfileId: commission.staffProfileId,
            staffName: namesByProfileId.get(commission.staffProfileId) ?? '',
            basis: commission.basis,
            percentage: commission.percentageBasisPoints / 100,
            amount: commission.amount,
          })),
        } satisfies SalonMoneyReportAppointment
      }),
    )

    const visibleCommissions = reportAppointments.flatMap(
      (appointment) => appointment.commissions,
    )
    const byStaff = new Map<string, SalonMoneyReport['staff'][number]>()
    for (const commission of visibleCommissions) {
      const summary = byStaff.get(commission.staffProfileId) ?? {
        staffProfileId: commission.staffProfileId,
        staffName: commission.staffName,
        completedCount: 0,
        commissionBasisTotal: 0,
        staffCommissionTotal: 0,
      }
      summary.completedCount++
      summary.commissionBasisTotal += commission.basis
      summary.staffCommissionTotal += commission.amount
      byStaff.set(commission.staffProfileId, summary)
    }

    const bookedTotal = reportAppointments.reduce(
      (sum, appointment) => sum + appointment.bookedTotal,
      0,
    )
    const staffCommissionTotal = visibleCommissions.reduce(
      (sum, commission) => sum + commission.amount,
      0,
    )
    return {
      ok: true as const,
      report: {
        startDate: input.startDate,
        endDate: input.endDate,
        summary: {
          bookedTotal,
          staffCommissionTotal,
          salonRetainedAmount: bookedTotal - staffCommissionTotal,
        },
        staff: [...byStaff.values()],
        appointments: reportAppointments,
      },
    }
  })
}
