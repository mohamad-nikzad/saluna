import { and, asc, eq } from 'drizzle-orm'
import { allocatePackagePrice } from '@repo/salon-core/commissions'

import { getDb } from '../client'
import {
  appointments,
  servicePackageBookings,
  servicePackageTasks,
} from '../schema'

type Db = ReturnType<typeof getDb>
export type CommissionDbTx = Parameters<Parameters<Db['transaction']>[0]>[0]
export type AppointmentCommissionRow = typeof appointments.$inferSelect

/** Package-aware booked total for one completed Appointment. */
export async function appointmentCommissionBasis(
  tx: CommissionDbTx,
  appointment: AppointmentCommissionRow,
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

/**
 * Unique salon booked total for one completed Appointment.
 * Prefer stored commission bases when every assignment has a non-voided row;
 * otherwise fall back to package-aware booked price.
 */
export async function completedAppointmentBookedTotal(input: {
  tx: CommissionDbTx
  appointment: AppointmentCommissionRow
  commissionBases: number[]
  assignmentCount: number
}): Promise<number> {
  const expectedAssignments = input.assignmentCount || 1
  if (
    input.commissionBases.length > 0 &&
    input.commissionBases.length === expectedAssignments
  ) {
    return input.commissionBases.reduce((sum, basis) => sum + basis, 0)
  }
  return appointmentCommissionBasis(input.tx, input.appointment)
}
