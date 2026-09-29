import type {
  Appointment,
  AppointmentStaffAssignment,
  BookedAppointmentAddonLine,
  AppointmentWithDetails,
  BusinessHours,
  Client,
  ClientFollowUp,
  ClientTag,
  Service,
  ServiceCategory,
  ServiceFamily,
  StaffSchedule,
  User,
} from '@repo/salon-core/types'
import { STAFF_COLORS } from '@repo/salon-core/types'
import { normalizeCalendarColorId } from '@repo/salon-core/calendar-colors'
import {
  appointments,
  appointmentAddonLines,
  businessSettings,
  clientFollowUps,
  clientTags,
  clients,
  member,
  salonMember,
  services,
  staffProfiles,
  staffSchedules,
  user,
} from '../schema'

const DEFAULT_STAFF_COLOR = normalizeCalendarColorId(STAFF_COLORS[0])

/**
 * Drizzle select shape that reconstructs the legacy `User` from the Better Auth
 * model. Use it after joining `user` (the staff), `member` (role + org), and a
 * LEFT join on `salonMember` (color sidecar). Appointment reads use nullable
 * joins here because a prepared Staff Profile has no user or member yet.
 */
export const staffUserSelect = {
  id: user.id,
  salonId: member.organizationId,
  fullName: user.name,
  displayName: salonMember.displayName,
  phone: user.phoneNumber,
  fallbackPhone: user.username,
  role: member.role,
  color: salonMember.color,
  createdAt: user.createdAt,
}

export type StaffUserRow = {
  id: string
  salonId: string
  fullName: string
  displayName: string | null
  phone: string | null
  fallbackPhone: string | null
  role: string
  color: string | null
  createdAt: Date
}

type NullableStaffUserRow = {
  [K in keyof StaffUserRow]: StaffUserRow[K] | null
}

type PreparedStaffRow = Pick<
  typeof staffProfiles.$inferSelect,
  'id' | 'salonId' | 'name' | 'phone' | 'color' | 'createdAt'
>

type NullablePreparedStaffRow = {
  [K in keyof PreparedStaffRow]: PreparedStaffRow[K] | null
}

export function rowToUser(row: StaffUserRow): User {
  const fullName = row.fullName.trim()
  const displayName = row.displayName?.trim() || null
  const nickname = displayName && displayName !== fullName ? displayName : null
  return {
    id: row.id,
    salonId: row.salonId,
    name: nickname ?? fullName,
    fullName,
    nickname,
    phone: row.phone ?? row.fallbackPhone ?? '',
    role: row.role === 'owner' || row.role === 'admin' ? 'manager' : 'staff',
    color: row.color ?? DEFAULT_STAFF_COLOR,
    createdAt: row.createdAt,
  }
}

export function rowToService(row: typeof services.$inferSelect): Service {
  return {
    id: row.id,
    name: row.name,
    category: 'hair',
    categoryId: row.categoryId,
    familyId: row.familyId,
    duration: row.duration,
    price: row.price,
    color: row.color,
    active: row.active,
    description: row.description,
    kind: row.kind,
    allowMultipleStaff: row.allowMultipleStaff,
  }
}

export function rowToClient(row: typeof clients.$inferSelect): Client {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    isPlaceholder: row.isPlaceholder,
    birthDate: row.birthDate,
    acquisitionSource: row.acquisitionSource,
    notes: row.notes ?? undefined,
    createdAt: row.createdAt,
  }
}

export function rowToClientTag(row: typeof clientTags.$inferSelect): ClientTag {
  return {
    id: row.id,
    salonId: row.salonId,
    clientId: row.clientId,
    label: row.label,
    color: row.color,
    createdAt: row.createdAt,
  }
}

export function rowToClientFollowUp(
  row: typeof clientFollowUps.$inferSelect,
): ClientFollowUp {
  return {
    id: row.id,
    salonId: row.salonId,
    clientId: row.clientId,
    reason: row.reason,
    status: row.status,
    dueDate: row.dueDate,
    occurrenceYear: row.occurrenceYear,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    reviewedAt: row.reviewedAt,
  }
}

export function rowToAppointment(row: typeof appointments.$inferSelect): Omit<
  Appointment,
  'staffAssignments'
> & {
  staffAssignments: AppointmentStaffAssignment[]
} {
  return {
    id: row.id,
    clientId: row.clientId,
    staffAssignments: [],
    serviceId: row.serviceId,
    bookedServiceName: row.bookedServiceName,
    bookedServiceDuration: row.bookedServiceDuration,
    bookedServicePrice: row.bookedServicePrice,
    bookedTotalDuration: row.bookedTotalDuration,
    bookedTotalPrice: row.bookedTotalPrice,
    bookedAddonCount: 0,
    date: row.date,
    startTime: row.startTime,
    endTime: row.endTime,
    status: row.status as Appointment['status'],
    notes: row.notes ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function rowToAppointmentAddonLine(
  row: typeof appointmentAddonLines.$inferSelect,
): BookedAppointmentAddonLine {
  return {
    id: row.id,
    appointmentId: row.appointmentId,
    serviceAddonId: row.serviceAddonId,
    bookedAddonName: row.bookedAddonName,
    bookedAddonPriceDelta: row.bookedAddonPriceDelta,
    bookedAddonDurationDelta: row.bookedAddonDurationDelta,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
  }
}

export function rowToStaffSchedule(
  row: typeof staffSchedules.$inferSelect,
): StaffSchedule {
  return {
    id: row.id,
    salonId: row.salonId,
    staffId: row.staffId,
    dayOfWeek: row.dayOfWeek,
    workingStart: row.workingStart,
    workingEnd: row.workingEnd,
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function rowToBusinessHours(
  row: typeof businessSettings.$inferSelect,
): BusinessHours {
  return {
    workingStart: row.workingStart,
    workingEnd: row.workingEnd,
    slotDurationMinutes: row.slotDurationMinutes,
    workingDays: row.workingDays,
  }
}

export function attachAppointmentDetails(row: {
  appointment: typeof appointments.$inferSelect
  client: typeof clients.$inferSelect
  staff: NullableStaffUserRow | null
  preparedStaff: NullablePreparedStaffRow | null
  service: typeof services.$inferSelect
}): AppointmentWithDetails {
  const staff = row.staff?.salonId
    ? rowToUser(row.staff as StaffUserRow)
    : row.preparedStaff?.id
      ? {
          id: row.preparedStaff.id,
          salonId: row.preparedStaff.salonId!,
          name: row.preparedStaff.name!,
          fullName: row.preparedStaff.name!,
          nickname: null,
          phone: row.preparedStaff.phone!,
          role: 'staff' as const,
          color: row.preparedStaff.color!,
          createdAt: row.preparedStaff.createdAt!,
        }
      : null
  if (!staff) {
    throw new Error(`Appointment ${row.appointment.id} has no lead staff`)
  }
  return {
    ...rowToAppointment(row.appointment),
    client: rowToClient(row.client),
    staff,
    service: rowToService(row.service),
  }
}

export function rowToServiceCategory(row: {
  id: string
  name: string
  active: boolean
  createdAt: Date
  updatedAt: Date
}): ServiceCategory {
  return {
    id: row.id,
    name: row.name,
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function rowToServiceFamily(row: {
  id: string
  categoryId: string
  categoryName?: string | null
  name: string
  active: boolean
  createdAt: Date
  updatedAt: Date
}): ServiceFamily {
  return {
    id: row.id,
    categoryId: row.categoryId,
    categoryName: row.categoryName ?? null,
    name: row.name,
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function joinedRowToService(row: {
  service: typeof services.$inferSelect
  family?: { id: string; name: string } | null
  category?: { id: string; name: string } | null
}): Service {
  return {
    ...rowToService(row.service),
    category: legacyCategoryFromCatalogName(row.category?.name),
    familyId: row.family?.id ?? row.service.familyId ?? null,
    familyName: row.family?.name ?? null,
    categoryId: row.category?.id ?? row.service.categoryId,
    categoryName: row.category?.name ?? null,
    description: row.service.description,
    kind: row.service.kind,
  }
}

function legacyCategoryFromCatalogName(
  name: string | null | undefined,
): Service['category'] {
  if (name === 'ناخن') return 'nails'
  if (name === 'پوست') return 'skincare'
  if (name === 'اسپا') return 'spa'
  return 'hair'
}
