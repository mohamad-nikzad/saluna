import { sql, and, asc, desc, eq, exists, inArray } from 'drizzle-orm'
import type { AppointmentStaffAssignment } from '@repo/salon-core/types'
import {
  EmptyAppointmentRosterError,
  assertValidAppointmentRoster,
  orderedRoster,
  type AppointmentStaffAssignmentInput,
} from '@repo/salon-core/appointment-roster'
import { getDb } from '../client'
import { appointmentStaffAssignments, appointments } from '../schema'
import { getAllStaff } from './staff-queries'

type Db = ReturnType<typeof getDb>
type DbTransaction = Parameters<Parameters<Db['transaction']>[0]>[0]
type DbLike = Db | DbTransaction

/** EXISTS filter: appointment has any of the given staff on its roster. */
export function appointmentHasAssignedStaff(
  staffIdFilter: string | readonly string[],
) {
  const staffIds =
    typeof staffIdFilter === 'string' ? [staffIdFilter] : [...staffIdFilter]
  if (staffIds.length === 0) return sql`false`
  return exists(
    getDb()
      .select({ id: appointmentStaffAssignments.id })
      .from(appointmentStaffAssignments)
      .where(
        and(
          eq(appointmentStaffAssignments.appointmentId, appointments.id),
          staffIds.length === 1
            ? eq(appointmentStaffAssignments.staffId, staffIds[0]!)
            : inArray(appointmentStaffAssignments.staffId, staffIds),
        ),
      ),
  )
}

export async function loadAppointmentRosters(
  salonId: string,
  appointmentIds: readonly string[],
  options?: { db?: DbLike; allowEmpty?: boolean },
): Promise<Map<string, AppointmentStaffAssignment[]>> {
  const byAppointment = new Map<string, AppointmentStaffAssignment[]>()
  if (appointmentIds.length === 0) return byAppointment

  const db = options?.db ?? getDb()
  const rows = await db
    .select()
    .from(appointmentStaffAssignments)
    .where(
      and(
        eq(appointmentStaffAssignments.salonId, salonId),
        inArray(appointmentStaffAssignments.appointmentId, [...appointmentIds]),
      ),
    )
    .orderBy(
      desc(appointmentStaffAssignments.isLead),
      asc(appointmentStaffAssignments.createdAt),
    )

  const staff = await getAllStaff(salonId)
  const staffById = new Map(staff.map((member) => [member.id, member]))

  for (const row of rows) {
    const assignments = byAppointment.get(row.appointmentId) ?? []
    assignments.push({
      id: row.id,
      staffId: row.staffId,
      isLead: row.isLead,
      allocationBasisPoints: row.allocationBasisPoints,
      staff: staffById.get(row.staffId),
    })
    byAppointment.set(row.appointmentId, assignments)
  }

  if (!options?.allowEmpty) {
    for (const appointmentId of appointmentIds) {
      const roster = byAppointment.get(appointmentId)
      if (!roster || roster.length === 0) {
        throw new EmptyAppointmentRosterError(
          `Appointment ${appointmentId} has an empty staff roster`,
        )
      }
    }
  }

  return byAppointment
}

export async function attachAppointmentRosters<
  T extends { id: string; staffAssignments?: AppointmentStaffAssignment[] },
>(
  appointmentsList: T[],
  salonId: string,
  options?: { db?: DbLike },
): Promise<Array<T & { staffAssignments: AppointmentStaffAssignment[] }>> {
  if (appointmentsList.length === 0) return []
  const byAppointment = await loadAppointmentRosters(
    salonId,
    appointmentsList.map((appointment) => appointment.id),
    options,
  )
  return appointmentsList.map((appointment) => ({
    ...appointment,
    staffAssignments: byAppointment.get(appointment.id)!,
  }))
}

export async function replaceAppointmentRoster(
  tx: DbTransaction,
  input: {
    salonId: string
    appointmentId: string
    assignments: readonly AppointmentStaffAssignmentInput[]
  },
): Promise<void> {
  const ordered = orderedRoster(input.assignments)
  assertValidAppointmentRoster(ordered)

  await tx
    .delete(appointmentStaffAssignments)
    .where(
      and(
        eq(appointmentStaffAssignments.salonId, input.salonId),
        eq(appointmentStaffAssignments.appointmentId, input.appointmentId),
      ),
    )

  await tx.insert(appointmentStaffAssignments).values(
    ordered.map((assignment) => ({
      salonId: input.salonId,
      appointmentId: input.appointmentId,
      staffId: assignment.staffId,
      isLead: assignment.isLead,
      allocationBasisPoints: assignment.allocationBasisPoints,
    })),
  )
}

export async function insertAppointmentRoster(
  tx: DbTransaction,
  input: {
    salonId: string
    appointmentId: string
    assignments: readonly AppointmentStaffAssignmentInput[]
  },
): Promise<void> {
  const ordered = orderedRoster(input.assignments)
  assertValidAppointmentRoster(ordered)
  await tx.insert(appointmentStaffAssignments).values(
    ordered.map((assignment) => ({
      salonId: input.salonId,
      appointmentId: input.appointmentId,
      staffId: assignment.staffId,
      isLead: assignment.isLead,
      allocationBasisPoints: assignment.allocationBasisPoints,
    })),
  )
}

export async function remapAppointmentAssignmentStaff(
  tx: DbTransaction,
  input: {
    salonId: string
    fromStaffId: string
    toStaffId: string
  },
): Promise<number> {
  if (input.fromStaffId === input.toStaffId) return 0
  const updated = await tx
    .update(appointmentStaffAssignments)
    .set({ staffId: input.toStaffId, updatedAt: new Date() })
    .where(
      and(
        eq(appointmentStaffAssignments.salonId, input.salonId),
        eq(appointmentStaffAssignments.staffId, input.fromStaffId),
      ),
    )
    .returning({ id: appointmentStaffAssignments.id })
  return updated.length
}

export async function assertAppointmentRosterPresent(
  tx: DbLike,
  salonId: string,
  appointmentId: string,
): Promise<AppointmentStaffAssignment[]> {
  const byAppointment = await loadAppointmentRosters(salonId, [appointmentId], {
    db: tx,
  })
  return byAppointment.get(appointmentId)!
}
