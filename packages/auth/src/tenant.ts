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

/** Assignment authority follows active Staff Profile Access, never the login identity. */
export function staffOwnsAppointment(
  appointmentStaffId: string | readonly string[],
  tenant: Pick<TenantUser, 'userId' | 'staffProfileId'>,
): boolean {
  if (!tenant.staffProfileId) return false
  return typeof appointmentStaffId === 'string'
    ? appointmentStaffId === tenant.staffProfileId
    : appointmentStaffId.includes(tenant.staffProfileId)
}

export function staffAppointmentStaffIds(
  tenant: Pick<TenantUser, 'role' | 'userId' | 'staffProfileId'>,
): string[] | undefined {
  if (tenant.role !== 'staff') return undefined
  return tenant.staffProfileId ? [tenant.staffProfileId] : []
}
