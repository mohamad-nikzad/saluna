import type { PlatformRole } from '@repo/database/admin'

export type PlatformAdminUser = {
  userId: string
  role: PlatformRole
}

export type PlatformPermission =
  | 'view_admin'
  | 'view_salons'
  | 'manage_salons'
  | 'view_users'
  | 'manage_catalog_presets'
  | 'view_messaging_health'
  | 'view_support_lookup'
  | 'view_audit_log'
  | 'manage_platform_admins'
  | 'write_internal_notes'

const rolePermissions: Record<PlatformRole, ReadonlySet<PlatformPermission>> = {
  platform_owner: new Set([
    'view_admin',
    'view_salons',
    'manage_salons',
    'view_users',
    'manage_catalog_presets',
    'view_messaging_health',
    'view_support_lookup',
    'view_audit_log',
    'manage_platform_admins',
    'write_internal_notes',
  ]),
  platform_admin: new Set([
    'view_admin',
    'view_salons',
    'manage_salons',
    'view_users',
    'manage_catalog_presets',
    'view_messaging_health',
    'view_support_lookup',
    'view_audit_log',
    'write_internal_notes',
  ]),
  platform_support: new Set([
    'view_admin',
    'view_salons',
    'view_users',
    'view_messaging_health',
    'view_support_lookup',
    'view_audit_log',
    'write_internal_notes',
  ]),
  platform_viewer: new Set([
    'view_admin',
    'view_salons',
    'view_users',
    'view_messaging_health',
    'view_support_lookup',
    'view_audit_log',
  ]),
}

export function hasPlatformPermission(
  role: PlatformRole,
  permission: PlatformPermission,
): boolean {
  return rolePermissions[role]?.has(permission) ?? false
}
