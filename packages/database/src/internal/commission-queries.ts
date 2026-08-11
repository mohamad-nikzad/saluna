import { and, asc, eq, gte, inArray, isNull, lte } from 'drizzle-orm'
import {
  allocateWorkBasis,
  allocatePackagePrice,
  commissionAmount,
} from '@repo/salon-core/commissions'

import { getDb } from '../client'
import { resolveAppointmentAssignmentStaffProfileId } from '../staff-profile-access'
import {
  appointments,
  appointmentStaffAssignments,
  clients,
  commissionAgreements,
  serviceCommissionOverrides,
  servicePackageBookings,
  servicePackageTasks,
  services,
  staffCommissions,
  staffProfiles,
} from '../schema'

type Db = ReturnType<typeof getDb>
type DbTx = Parameters<Parameters<Db['transaction']>[0]>[0]
type AppointmentRow = typeof appointments.$inferSelect
type AgreementRow = typeof commissionAgreements.$inferSelect

export type ServiceCommissionOverrideView = {
  serviceId: string
  serviceName: string
  serviceActive: boolean
  percentage: number
}

export type CommissionAgreementView = {
  staffProfileId: string
  percentage: number
  active: boolean
  activatedAt: Date
  disabledAt: Date | null
  overrides: ServiceCommissionOverrideView[]
}

export type StaffCommissionReportRow = {
  appointmentId: string
  date: string
  clientName: string
  serviceName: string
  basis: number
  percentage: number
  amount: number
}

export type StaffCommissionReport = {
  staffProfileId: string
  staffName: string
  agreement: CommissionAgreementView | null
  startDate: string
  endDate: string
  summary: {
    completedCount: number
    grossAppointmentRevenue: number
    staffCommissionTotal: number
  }
  rows: StaffCommissionReportRow[]
}

export type SalonCommissionReport = {
  startDate: string
  endDate: string
  summary: {
    grossAppointmentRevenue: number
    staffCommissionTotal: number
    salonRetainedAmount: number
  }
  staff: Array<{
    staffProfileId: string
    staffName: string
    completedCount: number
    grossAppointmentRevenue: number
    staffCommissionTotal: number
  }>
  rows: Array<StaffCommissionReportRow & { staffProfileId: string }>
}

async function listAgreementOverrides(
  salonId: string,
  agreementId: string,
): Promise<ServiceCommissionOverrideView[]> {
  const rows = await getDb()
    .select({
      serviceId: serviceCommissionOverrides.serviceId,
      serviceName: services.name,
      serviceActive: services.active,
      percentageBasisPoints: serviceCommissionOverrides.percentageBasisPoints,
    })
    .from(serviceCommissionOverrides)
    .innerJoin(services, eq(services.id, serviceCommissionOverrides.serviceId))
    .where(
      and(
        eq(serviceCommissionOverrides.salonId, salonId),
        eq(serviceCommissionOverrides.commissionAgreementId, agreementId),
      ),
    )
    .orderBy(asc(services.name))
  return rows.map((row) => ({
    serviceId: row.serviceId,
    serviceName: row.serviceName,
    serviceActive: row.serviceActive,
    percentage: row.percentageBasisPoints / 100,
  }))
}

async function agreementView(
  row: AgreementRow,
): Promise<CommissionAgreementView> {
  return {
    staffProfileId: row.staffProfileId,
    percentage: row.percentageBasisPoints / 100,
    active: row.active,
    activatedAt: row.activatedAt,
    disabledAt: row.disabledAt,
    overrides: await listAgreementOverrides(row.salonId, row.id),
  }
}

async function getStaffProfile(salonId: string, staffProfileId: string) {
  const rows = await getDb()
    .select()
    .from(staffProfiles)
    .where(
      and(
        eq(staffProfiles.salonId, salonId),
        eq(staffProfiles.id, staffProfileId),
      ),
    )
    .limit(1)
  return rows[0]
}

async function getAgreementRow(salonId: string, staffProfileId: string) {
  const [row] = await getDb()
    .select()
    .from(commissionAgreements)
    .where(
      and(
        eq(commissionAgreements.salonId, salonId),
        eq(commissionAgreements.staffProfileId, staffProfileId),
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

export async function setCommissionAgreement(input: {
  salonId: string
  staffProfileId: string
  percentageBasisPoints: number
  now?: Date
}): Promise<CommissionAgreementView | null> {
  const profile = await getStaffProfile(input.salonId, input.staffProfileId)
  if (!profile) return null
  const now = input.now ?? new Date()
  const [row] = await getDb()
    .insert(commissionAgreements)
    .values({
      salonId: input.salonId,
      staffProfileId: profile.id,
      percentageBasisPoints: input.percentageBasisPoints,
      active: true,
      activatedAt: now,
      disabledAt: null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        commissionAgreements.salonId,
        commissionAgreements.staffProfileId,
      ],
      set: {
        percentageBasisPoints: input.percentageBasisPoints,
        active: true,
        activatedAt: now,
        disabledAt: null,
        updatedAt: now,
      },
    })
    .returning()
  return row ? agreementView(row) : null
}

export async function disableCommissionAgreement(input: {
  salonId: string
  staffProfileId: string
  now?: Date
}): Promise<CommissionAgreementView | null> {
  const profile = await getStaffProfile(input.salonId, input.staffProfileId)
  if (!profile) return null
  const now = input.now ?? new Date()
  const [row] = await getDb()
    .update(commissionAgreements)
    .set({ active: false, disabledAt: now, updatedAt: now })
    .where(
      and(
        eq(commissionAgreements.salonId, input.salonId),
        eq(commissionAgreements.staffProfileId, profile.id),
      ),
    )
    .returning()
  return row ? agreementView(row) : null
}

export async function setServiceCommissionOverride(input: {
  salonId: string
  staffProfileId: string
  serviceId: string
  percentageBasisPoints: number
  now?: Date
}): Promise<
  | { ok: true; agreement: CommissionAgreementView }
  | { ok: false; reason: 'profile' | 'agreement' | 'service' }
> {
  const profile = await getStaffProfile(input.salonId, input.staffProfileId)
  if (!profile) return { ok: false, reason: 'profile' }
  const agreement = await getAgreementRow(input.salonId, profile.id)
  if (!agreement) return { ok: false, reason: 'agreement' }
  const service = await getSalonService(input.salonId, input.serviceId)
  if (!service) return { ok: false, reason: 'service' }
  const now = input.now ?? new Date()
  await getDb()
    .insert(serviceCommissionOverrides)
    .values({
      salonId: input.salonId,
      commissionAgreementId: agreement.id,
      serviceId: service.id,
      percentageBasisPoints: input.percentageBasisPoints,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        serviceCommissionOverrides.commissionAgreementId,
        serviceCommissionOverrides.serviceId,
      ],
      set: {
        percentageBasisPoints: input.percentageBasisPoints,
        updatedAt: now,
      },
    })
  return { ok: true, agreement: await agreementView(agreement) }
}

export async function deleteServiceCommissionOverride(input: {
  salonId: string
  staffProfileId: string
  serviceId: string
}): Promise<
  | { ok: true; agreement: CommissionAgreementView }
  | { ok: false; reason: 'profile' | 'agreement' | 'override' }
> {
  const profile = await getStaffProfile(input.salonId, input.staffProfileId)
  if (!profile) return { ok: false, reason: 'profile' }
  const agreement = await getAgreementRow(input.salonId, profile.id)
  if (!agreement) return { ok: false, reason: 'agreement' }
  const deleted = await getDb()
    .delete(serviceCommissionOverrides)
    .where(
      and(
        eq(serviceCommissionOverrides.salonId, input.salonId),
        eq(serviceCommissionOverrides.commissionAgreementId, agreement.id),
        eq(serviceCommissionOverrides.serviceId, input.serviceId),
      ),
    )
    .returning({ id: serviceCommissionOverrides.id })
  if (deleted.length === 0) return { ok: false, reason: 'override' }
  return { ok: true, agreement: await agreementView(agreement) }
}

async function appointmentCommissionBasis(
  tx: DbTx,
  appointment: AppointmentRow,
): Promise<number> {
  const taskRows = await tx
    .select({ packageBookingId: servicePackageTasks.packageBookingId })
    .from(servicePackageTasks)
    .where(
      and(
        eq(servicePackageTasks.salonId, appointment.salonId),
        eq(servicePackageTasks.appointmentId, appointment.id),
      ),
    )
    .limit(1)
  const task = taskRows[0]
  if (!task) return appointment.bookedTotalPrice

  const packageRows = await tx
    .select({
      appointmentId: servicePackageTasks.appointmentId,
      sortOrder: servicePackageTasks.sortOrder,
      bookedServicePrice: appointments.bookedServicePrice,
      bookedPackagePrice: servicePackageBookings.bookedPackagePrice,
    })
    .from(servicePackageTasks)
    .innerJoin(
      appointments,
      eq(appointments.id, servicePackageTasks.appointmentId),
    )
    .innerJoin(
      servicePackageBookings,
      eq(servicePackageBookings.id, servicePackageTasks.packageBookingId),
    )
    .where(eq(servicePackageTasks.packageBookingId, task.packageBookingId))
    .orderBy(asc(servicePackageTasks.sortOrder))
  const allocations = allocatePackagePrice(
    packageRows[0]!.bookedPackagePrice,
    packageRows.map((row) => row.bookedServicePrice),
  )
  const index = packageRows.findIndex(
    (row) => row.appointmentId === appointment.id,
  )
  return allocations[index]!
}

export async function getSalonFinancialSummary(input: {
  salonId: string
  startDate: string
  endDate: string
}) {
  return getDb().transaction(async (tx) => {
    const rows = await tx
      .select({
        appointment: appointments,
        commissionBasis: staffCommissions.basis,
        commissionAmount: staffCommissions.amount,
      })
      .from(appointments)
      .leftJoin(
        staffCommissions,
        and(
          eq(staffCommissions.appointmentId, appointments.id),
          isNull(staffCommissions.voidedAt),
        ),
      )
      .where(
        and(
          eq(appointments.salonId, input.salonId),
          eq(appointments.status, 'completed'),
          gte(appointments.date, input.startDate),
          lte(appointments.date, input.endDate),
        ),
      )

    const appointmentIds = [...new Set(rows.map((row) => row.appointment.id))]
    const assignmentRows =
      appointmentIds.length === 0
        ? []
        : await tx
            .select({ appointmentId: appointmentStaffAssignments.appointmentId })
            .from(appointmentStaffAssignments)
            .where(
              inArray(
                appointmentStaffAssignments.appointmentId,
                appointmentIds,
              ),
            )
    const assignmentCount = new Map<string, number>()
    for (const assignment of assignmentRows) {
      assignmentCount.set(
        assignment.appointmentId,
        (assignmentCount.get(assignment.appointmentId) ?? 0) + 1,
      )
    }
    const byAppointment = new Map<string, typeof rows>()
    for (const row of rows) {
      const appointmentRows = byAppointment.get(row.appointment.id) ?? []
      appointmentRows.push(row)
      byAppointment.set(row.appointment.id, appointmentRows)
    }

    // ponytail: monthly volumes are small; batch package lookups if this is measured as slow.
    const bases = await Promise.all(
      [...byAppointment.values()].map(async (appointmentRows) => {
        const commissioned = appointmentRows.filter(
          (row) => row.commissionBasis != null,
        )
        if (
          commissioned.length > 0 &&
          commissioned.length ===
            (assignmentCount.get(appointmentRows[0]!.appointment.id) ?? 1)
        ) {
          return commissioned.reduce(
            (sum, row) => sum + (row.commissionBasis ?? 0),
            0,
          )
        }
        return appointmentCommissionBasis(tx, appointmentRows[0]!.appointment)
      }),
    )
    const grossAppointmentRevenue = bases.reduce((sum, basis) => sum + basis, 0)
    const staffCommissionTotal = rows.reduce(
      (sum, row) => sum + (row.commissionAmount ?? 0),
      0,
    )
    return {
      grossAppointmentRevenue,
      staffCommissionTotal,
      salonRetainedAmount: grossAppointmentRevenue - staffCommissionTotal,
    }
  })
}

export async function syncAppointmentCommission(
  tx: DbTx,
  before: Pick<AppointmentRow, 'status' | 'bookedTotalPrice'> | null,
  after: AppointmentRow,
  assignmentsChanged = false,
): Promise<void> {
  const becameCompleted =
    after.status === 'completed' && before?.status !== 'completed'
  const leftCompleted =
    before?.status === 'completed' && after.status !== 'completed'
  const priceChanged =
    before?.status === 'completed' &&
    after.status === 'completed' &&
    before.bookedTotalPrice !== after.bookedTotalPrice
  if (
    !becameCompleted &&
    !leftCompleted &&
    !priceChanged &&
    !assignmentsChanged
  )
    return

  const existing = await tx
    .select()
    .from(staffCommissions)
    .where(eq(staffCommissions.appointmentId, after.id))
    .for('update')

  if (after.status !== 'completed') {
    if (existing.some((commission) => !commission.voidedAt)) {
      const now = new Date()
      await tx
        .update(staffCommissions)
        .set({ voidedAt: now, updatedAt: now })
        .where(eq(staffCommissions.appointmentId, after.id))
    }
    return
  }

  const assignments = await tx
    .select()
    .from(appointmentStaffAssignments)
    .where(
      and(
        eq(appointmentStaffAssignments.salonId, after.salonId),
        eq(appointmentStaffAssignments.appointmentId, after.id),
      ),
    )
    .orderBy(
      asc(appointmentStaffAssignments.isLead),
      asc(appointmentStaffAssignments.createdAt),
    )
  if (assignments.length === 0) return
  const leadIndex = assignments.findIndex((assignment) => assignment.isLead)
  if (leadIndex > 0) {
    assignments.unshift(assignments.splice(leadIndex, 1)[0]!)
  }
  const bases = allocateWorkBasis(
    await appointmentCommissionBasis(tx, after),
    assignments,
  )
  const existingByAssignment = new Map(
    existing.map((commission) => [
      commission.appointmentStaffAssignmentId,
      commission,
    ]),
  )

  for (let index = 0; index < assignments.length; index++) {
    const assignment = assignments[index]!
    const basis = bases[index]!
    const prior = existingByAssignment.get(assignment.id)
    if (prior) {
      await tx
        .update(staffCommissions)
        .set({
          basis,
          amount: commissionAmount(basis, prior.percentageBasisPoints),
          voidedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(staffCommissions.id, prior.id))
      continue
    }
    if (assignment.commissionExcludedAt) continue

    const staffProfileId = await resolveAppointmentAssignmentStaffProfileId(
      { salonId: after.salonId, staffId: assignment.staffId },
      tx,
    )
    const [agreement] = staffProfileId
      ? await tx
          .select()
          .from(commissionAgreements)
          .where(
            and(
              eq(commissionAgreements.salonId, after.salonId),
              eq(commissionAgreements.staffProfileId, staffProfileId),
              eq(commissionAgreements.active, true),
            ),
          )
          .limit(1)
      : []
    if (!staffProfileId || !agreement) {
      await tx
        .update(appointmentStaffAssignments)
        .set({ commissionExcludedAt: new Date(), updatedAt: new Date() })
        .where(eq(appointmentStaffAssignments.id, assignment.id))
      continue
    }
    const [override] = await tx
      .select({
        percentageBasisPoints: serviceCommissionOverrides.percentageBasisPoints,
      })
      .from(serviceCommissionOverrides)
      .where(
        and(
          eq(serviceCommissionOverrides.commissionAgreementId, agreement.id),
          eq(serviceCommissionOverrides.serviceId, after.serviceId),
        ),
      )
      .limit(1)
    const percentageBasisPoints =
      override?.percentageBasisPoints ?? agreement.percentageBasisPoints
    await tx
      .insert(staffCommissions)
      .values({
        salonId: after.salonId,
        staffProfileId,
        appointmentId: after.id,
        appointmentStaffAssignmentId: assignment.id,
        basis,
        percentageBasisPoints,
        amount: commissionAmount(basis, percentageBasisPoints),
      })
      .onConflictDoNothing({
        target: staffCommissions.appointmentStaffAssignmentId,
      })
  }
}

async function reportRows(input: {
  salonId: string
  startDate: string
  endDate: string
  staffProfileId?: string
}) {
  const conditions = [
    eq(staffCommissions.salonId, input.salonId),
    isNull(staffCommissions.voidedAt),
    eq(appointments.status, 'completed'),
    gte(appointments.date, input.startDate),
    lte(appointments.date, input.endDate),
  ]
  if (input.staffProfileId) {
    conditions.push(eq(staffCommissions.staffProfileId, input.staffProfileId))
  }
  return getDb()
    .select({
      staffProfileId: staffCommissions.staffProfileId,
      appointmentId: appointments.id,
      date: appointments.date,
      clientName: clients.name,
      serviceName: appointments.bookedServiceName,
      basis: staffCommissions.basis,
      percentageBasisPoints: staffCommissions.percentageBasisPoints,
      amount: staffCommissions.amount,
    })
    .from(staffCommissions)
    .innerJoin(
      appointments,
      eq(appointments.id, staffCommissions.appointmentId),
    )
    .innerJoin(
      clients,
      and(
        eq(clients.id, appointments.clientId),
        eq(clients.salonId, input.salonId),
      ),
    )
    .where(and(...conditions))
    .orderBy(asc(appointments.date), asc(appointments.startTime))
}

function mapReportRow(row: Awaited<ReturnType<typeof reportRows>>[number]) {
  return {
    appointmentId: row.appointmentId,
    date: row.date,
    clientName: row.clientName,
    serviceName: row.serviceName,
    basis: row.basis,
    percentage: row.percentageBasisPoints / 100,
    amount: row.amount,
  }
}

export async function getStaffCommissionReport(input: {
  salonId: string
  staffProfileId: string
  startDate: string
  endDate: string
}): Promise<StaffCommissionReport | null> {
  const profile = await getStaffProfile(input.salonId, input.staffProfileId)
  if (!profile) return null
  const [agreementRows, rows] = await Promise.all([
    getDb()
      .select()
      .from(commissionAgreements)
      .where(
        and(
          eq(commissionAgreements.salonId, input.salonId),
          eq(commissionAgreements.staffProfileId, profile.id),
        ),
      )
      .limit(1),
    reportRows({ ...input, staffProfileId: profile.id }),
  ])
  const mappedRows = rows.map(mapReportRow)
  return {
    staffProfileId: profile.id,
    staffName: profile.name,
    agreement: agreementRows[0] ? await agreementView(agreementRows[0]) : null,
    startDate: input.startDate,
    endDate: input.endDate,
    summary: {
      completedCount: mappedRows.length,
      grossAppointmentRevenue: mappedRows.reduce(
        (sum, row) => sum + row.basis,
        0,
      ),
      staffCommissionTotal: mappedRows.reduce(
        (sum, row) => sum + row.amount,
        0,
      ),
    },
    rows: mappedRows,
  }
}

export async function getSalonCommissionReport(input: {
  salonId: string
  startDate: string
  endDate: string
  staffProfileId?: string
}): Promise<SalonCommissionReport | null> {
  const profile = input.staffProfileId
    ? await getStaffProfile(input.salonId, input.staffProfileId)
    : null
  if (input.staffProfileId && !profile) return null
  const [rows, profiles] = await Promise.all([
    reportRows({ ...input, staffProfileId: profile?.id }),
    getDb()
      .select({ id: staffProfiles.id, name: staffProfiles.name })
      .from(staffProfiles)
      .where(eq(staffProfiles.salonId, input.salonId)),
  ])
  const names = new Map(profiles.map((row) => [row.id, row.name]))
  const byStaff = new Map<string, SalonCommissionReport['staff'][number]>()
  for (const row of rows) {
    const summary = byStaff.get(row.staffProfileId) ?? {
      staffProfileId: row.staffProfileId,
      staffName: names.get(row.staffProfileId) ?? '',
      completedCount: 0,
      grossAppointmentRevenue: 0,
      staffCommissionTotal: 0,
    }
    summary.completedCount++
    summary.grossAppointmentRevenue += row.basis
    summary.staffCommissionTotal += row.amount
    byStaff.set(row.staffProfileId, summary)
  }
  const grossAppointmentRevenue = rows.reduce((sum, row) => sum + row.basis, 0)
  const staffCommissionTotal = rows.reduce((sum, row) => sum + row.amount, 0)
  return {
    startDate: input.startDate,
    endDate: input.endDate,
    summary: {
      grossAppointmentRevenue,
      staffCommissionTotal,
      salonRetainedAmount: grossAppointmentRevenue - staffCommissionTotal,
    },
    staff: [...byStaff.values()],
    rows: rows.map((row) => ({
      staffProfileId: row.staffProfileId,
      ...mapReportRow(row),
    })),
  }
}
