import { adminAuth, auth } from '@repo/auth/server'
import { mapRole } from '@repo/auth/permissions'
import {
  hasPlatformPermission,
  type PlatformPermission,
} from '@repo/auth/platform'
import { hasTenantPermission, type TenantPermission } from '@repo/auth/tenant'
import {
  bootstrapPlatformOwnerIfNeeded,
  getPlatformAdminForUser,
  getUserPhoneForPlatformBootstrap,
} from '@repo/database/admin'
import { getMemberForUser } from '@repo/database/members'
import { factory } from '../factory'
import { getEnv } from '../env'
import { error } from '../lib/responses'

export function requireTenant(permission?: TenantPermission) {
  return factory.createMiddleware(async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers })
    if (!session?.user) return error(c, 'دسترسی غیرمجاز', 401)

    const member = await getMemberForUser(session.user.id)
    if (!member) return error(c, 'دسترسی غیرمجاز', 403)
    if (member.salonStatus && member.salonStatus !== 'active') {
      return error(c, 'دسترسی سالن غیرفعال است', 403)
    }

    const role = mapRole(member.role)
    if (permission && !hasTenantPermission(role, permission)) {
      return error(c, 'دسترسی غیرمجاز', 403)
    }

    c.set('tenant', {
      userId: member.userId,
      salonId: member.organizationId,
      role,
      name: member.name,
      phone: member.username,
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
