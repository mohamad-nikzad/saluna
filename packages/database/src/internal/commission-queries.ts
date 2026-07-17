import { and, asc, eq, gte, isNull, lte, or } from 'drizzle-orm'
import {
  allocatePackagePrice,
  commissionAmount,
} from '@repo/salon-core/commissions'

import { getDb } from '../client'
import {
  appointments,
  clients,
  commissionAgreements,
  servicePackageBookings,
  servicePackageTasks,
  staffCommissions,
  staffProfiles,
} from '../schema'

type Db = ReturnType<typeof getDb>
type DbTx = Parameters<Parameters<Db['transaction']>[0]>[0]
type AppointmentRow = typeof appointments.$inferSelect

export type CommissionAgreementView = {
  staffProfileId: string
  percentage: number
  active: boolean
  activatedAt: Date
  disabledAt: Date | null
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

function agreementView(
  row: typeof commissionAgreements.$inferSelect,
): CommissionAgreementView {
  return {
    staffProfileId: row.staffProfileId,
    percentage: row.percentageBasisPoints / 100,
    active: row.active,
    activatedAt: row.activatedAt,
    disabledAt: row.disabledAt,
  }
}

async function resolveStaffProfile(salonId: string, staffRef: string) {
  const rows = await getDb()
    .select()
    .from(staffProfiles)
    .where(
      and(
        eq(staffProfiles.salonId, salonId),
        or(eq(staffProfiles.id, staffRef), eq(staffProfiles.userId, staffRef)),
      ),
    )
    .limit(1)
  return rows[0]
}

export async function setCommissionAgreement(input: {
  salonId: string
  staffRef: string
  percentageBasisPoints: number
  now?: Date
}): Promise<CommissionAgreementView | null> {
  const profile = await resolveStaffProfile(input.salonId, input.staffRef)
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
  staffRef: string
  now?: Date
}): Promise<CommissionAgreementView | null> {
  const profile = await resolveStaffProfile(input.salonId, input.staffRef)
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

    // ponytail: monthly volumes are small; batch package lookups if this is measured as slow.
    const bases = await Promise.all(
      rows.map(({ appointment, commissionBasis }) =>
        commissionBasis == null
          ? appointmentCommissionBasis(tx, appointment)
          : commissionBasis,
      ),
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
): Promise<void> {
  const becameCompleted =
    after.status === 'completed' && before?.status !== 'completed'
  const leftCompleted =
    before?.status === 'completed' && after.status !== 'completed'
  const priceChanged =
    before?.status === 'completed' &&
    after.status === 'completed' &&
    before.bookedTotalPrice !== after.bookedTotalPrice
  if (!becameCompleted && !leftCompleted && !priceChanged) return

  const [existing] = await tx
    .select()
    .from(staffCommissions)
    .where(eq(staffCommissions.appointmentId, after.id))
    .limit(1)
    .for('update')

  if (after.status !== 'completed') {
    if (existing && !existing.voidedAt) {
      const now = new Date()
      await tx
        .update(staffCommissions)
        .set({ voidedAt: now, updatedAt: now })
        .where(eq(staffCommissions.id, existing.id))
    }
    return
  }

  const basis = await appointmentCommissionBasis(tx, after)
  if (existing) {
    await tx
      .update(staffCommissions)
      .set({
        basis,
        amount: commissionAmount(basis, existing.percentageBasisPoints),
        voidedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(staffCommissions.id, existing.id))
    return
  }

  const [profile] = await tx
    .select({ id: staffProfiles.id })
    .from(staffProfiles)
    .where(
      and(
        eq(staffProfiles.salonId, after.salonId),
        or(
          eq(staffProfiles.id, after.staffId),
          eq(staffProfiles.userId, after.staffId),
        ),
      ),
    )
    .limit(1)
  if (!profile) return

  const [agreement] = await tx
    .select()
    .from(commissionAgreements)
    .where(
      and(
        eq(commissionAgreements.salonId, after.salonId),
        eq(commissionAgreements.staffProfileId, profile.id),
        eq(commissionAgreements.active, true),
      ),
    )
    .limit(1)
  if (!agreement) return

  await tx
    .insert(staffCommissions)
    .values({
      salonId: after.salonId,
      staffProfileId: profile.id,
      appointmentId: after.id,
      basis,
      percentageBasisPoints: agreement.percentageBasisPoints,
      amount: commissionAmount(basis, agreement.percentageBasisPoints),
    })
    .onConflictDoNothing({ target: staffCommissions.appointmentId })
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
  staffRef: string
  startDate: string
  endDate: string
}): Promise<StaffCommissionReport | null> {
  const profile = await resolveStaffProfile(input.salonId, input.staffRef)
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
    agreement: agreementRows[0] ? agreementView(agreementRows[0]) : null,
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
  staffRef?: string
}): Promise<SalonCommissionReport | null> {
  const profile = input.staffRef
    ? await resolveStaffProfile(input.salonId, input.staffRef)
    : null
  if (input.staffRef && !profile) return null
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
