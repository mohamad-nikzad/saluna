import { validateWorkAllocations } from './commissions'
import type { AppointmentStaffAssignment } from './types'

/** Wire / command shape for one roster row (no persisted assignment id). */
export type AppointmentStaffAssignmentInput = {
  staffId: string
  isLead: boolean
  allocationBasisPoints: number
}

export class EmptyAppointmentRosterError extends Error {
  constructor(message = 'Appointment roster is empty') {
    super(message)
    this.name = 'EmptyAppointmentRosterError'
  }
}

export class InvalidAppointmentRosterError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidAppointmentRosterError'
  }
}

export function isValidAppointmentRoster(
  assignments: readonly AppointmentStaffAssignmentInput[],
): boolean {
  if (assignments.length === 0) return false
  const leadCount = assignments.filter((row) => row.isLead).length
  if (leadCount !== 1) return false
  const staffIds = assignments.map((row) => row.staffId)
  if (new Set(staffIds).size !== staffIds.length) return false
  if (staffIds.some((id) => id.trim() === '')) return false
  return validateWorkAllocations(
    staffIds,
    assignments.map((row) => ({
      staffId: row.staffId,
      allocationBasisPoints: row.allocationBasisPoints,
    })),
  )
}

export function assertValidAppointmentRoster(
  assignments: readonly AppointmentStaffAssignmentInput[],
): void {
  if (assignments.length === 0) {
    throw new EmptyAppointmentRosterError()
  }
  if (!isValidAppointmentRoster(assignments)) {
    throw new InvalidAppointmentRosterError(
      'Appointment roster must have exactly one lead, unique staff ids, and allocations summing to 10000',
    )
  }
}

export function leadAssignment<T extends { isLead: boolean }>(
  assignments: readonly T[],
): T {
  if (assignments.length === 0) {
    throw new EmptyAppointmentRosterError()
  }
  const lead = assignments.find((row) => row.isLead)
  if (!lead) {
    throw new InvalidAppointmentRosterError(
      'Appointment roster has no lead assignment',
    )
  }
  return lead
}

export function leadStaffId(
  assignments: readonly AppointmentStaffAssignmentInput[],
): string {
  return leadAssignment(assignments).staffId
}

export function rosterStaffIds(
  assignments: readonly AppointmentStaffAssignmentInput[],
): string[] {
  assertValidAppointmentRoster(assignments)
  return assignments.map((row) => row.staffId)
}

/** Lead first, then extras in input order (stable for equal-split remainder). */
export function orderedRoster(
  assignments: readonly AppointmentStaffAssignmentInput[],
): AppointmentStaffAssignmentInput[] {
  assertValidAppointmentRoster(assignments)
  const lead = leadAssignment(assignments)
  const extras = assignments.filter((row) => !row.isLead)
  return [lead, ...extras]
}

export function assignmentStaffIds(
  assignments: readonly Pick<AppointmentStaffAssignment, 'staffId'>[],
): string[] {
  if (assignments.length === 0) {
    throw new EmptyAppointmentRosterError()
  }
  return assignments.map((row) => row.staffId)
}
