import { adminAuth, auth } from '@repo/auth/server'
import { mapRole } from '@repo/auth/permissions'
import {
  hasPlatformPermission,
  type PlatformPermission,
} from '@repo/auth/platform'
import {
  hasTenantPermission,
  SALON_CONTEXT_HEADER,
  type TenantPermission,
} from '@repo/auth/tenant'
import {
  bootstrapPlatformOwnerIfNeeded,
  getPlatformAdminForUser,
  getUserPhoneForPlatformBootstrap,
} from '@repo/database/admin'
import { getManagerMemberForUser } from '@repo/database/members'
import { resolveStaffTenantContext } from '@repo/database/staff'
import { factory } from '../factory'
import { getEnv } from '../env'
import { error } from '../lib/responses'

function requestedSalonIdFromHeaders(headers: Headers): string | null {
  const raw = headers.get(SALON_CONTEXT_HEADER)?.trim()
  return raw ? raw : null
}

export function requireTenant(permission?: TenantPermission) {
  return factory.createMiddleware(async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers })
    if (!session?.user) return error(c, 'دسترسی غیرمجاز', 401)

    const manager = await getManagerMemberForUser(session.user.id)
    if (manager) {
      if (manager.salonStatus && manager.salonStatus !== 'active') {
        return error(c, 'دسترسی سالن غیرفعال است', 403)
      }

      const role = mapRole(manager.role)
      if (permission && !hasTenantPermission(role, permission)) {
        return error(c, 'دسترسی غیرمجاز', 403)
      }

      c.set('tenant', {
        userId: manager.userId,
        salonId: manager.organizationId,
        role,
        name: manager.name,
        phone: manager.username,
      })
      await next()
      return
    }

    const staff = await resolveStaffTenantContext({
      userId: session.user.id,
      requestedSalonId: requestedSalonIdFromHeaders(c.req.raw.headers),
    })
    if (staff.status === 'rejected') {
      return error(c, 'دسترسی غیرمجاز', 403)
    }
    if (staff.salonStatus && staff.salonStatus !== 'active') {
      return error(c, 'دسترسی سالن غیرفعال است', 403)
    }

    const role = 'staff' as const
    if (permission && !hasTenantPermission(role, permission)) {
      return error(c, 'دسترسی غیرمجاز', 403)
    }

    c.set('tenant', {
      userId: staff.userId,
      salonId: staff.salonId,
      role,
      name: staff.name,
      phone: staff.phone,
      staffProfileId: staff.staffProfileId,
    })
    await next()
  })
}

export function requirePlatformAdmin(permission?: PlatformPermission) {
  return factory.createMiddleware(async (c, next) => {
    const session = await adminAuth.api.getSession({
      headers: c.req.raw.headers,
    })
    if (!session?.user) return error(c, 'دسترسی غیرمجاز', 401)

    const allowedPhones = getEnv().PLATFORM_ADMIN_BOOTSTRAP_PHONES
    const sessionPhone =
      session.user.phoneNumber ?? session.user.username ?? undefined
    let admin = await getPlatformAdminForUser(session.user.id)

    if (!admin && allowedPhones.length > 0) {
      const phone =
        sessionPhone ??
        (await getUserPhoneForPlatformBootstrap(session.user.id))
      if (phone) {
        admin = await bootstrapPlatformOwnerIfNeeded({
          userId: session.user.id,
          phone,
          allowedPhones,
        })
      }
    }

    if (!admin || !admin.active) return error(c, 'دسترسی غیرمجاز', 403)
    if (permission && !hasPlatformPermission(admin.role, permission)) {
      return error(c, 'دسترسی غیرمجاز', 403)
    }

    c.set('platformAdmin', {
      userId: admin.userId,
      role: admin.role,
      name:
        session.user.name?.trim() ||
        session.user.email?.trim() ||
        sessionPhone ||
        session.user.id,
    })
    await next()
  })
}
