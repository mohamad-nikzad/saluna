import type { UserRole } from '@repo/salon-core/types'

export type TenantUser = {
  userId: string
  salonId: string
  role: UserRole
  name: string
  phone: string
  /** Linked Staff Profile for staff role; set from active Staff Profile Access. */
  staffProfileId?: string
}

export type TenantPermission =
  | 'manage_settings'
  | 'manage_staff'
  | 'manage_services'
  | 'manage_clients'
  | 'manage_appointments'
  | 'view_support_tickets'
  | 'manage_support_tickets'
  | 'view_dashboard'
  | 'view_own_appointments'

const rolePermissions: Record<UserRole, ReadonlySet<TenantPermission>> = {
  manager: new Set([
    'manage_settings',
    'manage_staff',
    'manage_services',
    'manage_clients',
    'manage_appointments',
    'view_support_tickets',
    'manage_support_tickets',
    'view_dashboard',
    'view_own_appointments',
  ]),
  staff: new Set(['view_own_appointments']),
}

export function isManagerRole(role: UserRole): boolean {
  return hasTenantPermission(role, 'manage_settings')
}

export function hasTenantPermission(
  role: UserRole,
  permission: TenantPermission,
): boolean {
  return rolePermissions[role]?.has(permission) ?? false
}

/** Salon context header for tenant-scoped staff API requests (BL-0016). */
export const SALON_CONTEXT_HEADER = 'X-Saluna-Salon-Id'

/**
 * Whether an appointment belongs to the staff tenant's linked Staff Profile
 * (or the legacy claimed user id used as appointments.staffId).
 */
export function staffOwnsAppointment(
  appointmentStaffId: string,
  tenant: Pick<TenantUser, 'userId' | 'staffProfileId'>,
): boolean {
  if (appointmentStaffId === tenant.userId) return true
  if (
    tenant.staffProfileId != null &&
    appointmentStaffId === tenant.staffProfileId
  ) {
    return true
  }
  return false
}

/**
 * Staff appointment list filter: linked Staff Profile id plus legacy user id
 * so one-salon claim rows and profile-keyed rows both resolve.
 */
export function staffAppointmentStaffIds(
  tenant: Pick<TenantUser, 'role' | 'userId' | 'staffProfileId'>,
): string[] | undefined {
  if (tenant.role !== 'staff') return undefined
  const ids = new Set<string>([tenant.userId])
  if (tenant.staffProfileId) ids.add(tenant.staffProfileId)
  return [...ids]
}
