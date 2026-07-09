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
