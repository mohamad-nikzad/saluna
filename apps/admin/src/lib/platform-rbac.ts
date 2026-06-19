import { getApiV1AdminAuthMeOptions } from '@repo/api-client/query'
import {
  hasPlatformPermission,
  type PlatformPermission,
} from '@repo/auth/platform'
import type { QueryClient } from '@tanstack/react-query'
import { redirect } from '@tanstack/react-router'

export const adminRoutePermissions = {
  '/settings': 'manage_platform_admins',
  '/catalog-presets': 'manage_catalog_presets',
  '/audit-log': 'view_audit_log',
} as const satisfies Record<string, PlatformPermission>

export async function requirePermission(
  queryClient: QueryClient,
  permission: PlatformPermission,
): Promise<void> {
  const auth = await queryClient.ensureQueryData(getApiV1AdminAuthMeOptions())

  if (!hasPlatformPermission(auth.user.role, permission)) {
    throw redirect({ to: '/overview' })
  }
}
