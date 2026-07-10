import { Hono } from 'hono'
import { z } from 'zod'
import {
  createNotificationForUser,
  listNotificationsForUser,
  listNotificationsForUserAcrossSalons,
  markAllNotificationsRead,
  markAllNotificationsReadAcrossSalons,
  markNotificationRead,
  markNotificationReadAcrossSalons,
} from '@repo/notifications'
import { listActiveStaffProfileAccessesForUser } from '@repo/database/staff'
import type { AppEnv } from '../factory'
import { requireTenant } from '../middleware/auth'
import { zValidator } from '../lib/validate'
import { error, ok } from '../lib/responses'

const idParamSchema = z.object({ id: z.string().min(1) })

const listQuerySchema = z.object({
  unreadOnly: z.string().optional(),
})

function isNotificationTestRouteEnabled() {
  if (process.env.ENABLE_NOTIFICATION_TEST !== '1') return false
  const environment =
    process.env.APP_ENV ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV
  return environment !== 'production'
}

async function acceptedSalonIdsForStaff(userId: string): Promise<string[]> {
  const accesses = await listActiveStaffProfileAccessesForUser(userId)
  return accesses
    .filter((access) => access.profileActive)
    .map((access) => access.salonId)
}

/** Staff → accepted-salon scope; otherwise current-salon path. */
async function forStaffAcrossSalonsOrCurrent<T>(
  role: string,
  userId: string,
  across: (salonIds: string[]) => Promise<T>,
  current: () => Promise<T>,
): Promise<T> {
  if (role === 'staff') {
    return across(await acceptedSalonIdsForStaff(userId))
  }
  return current()
}

export const notifications = new Hono<AppEnv>()
  .use(requireTenant())
  .get('/', zValidator('query', listQuerySchema), async (c) => {
    const { salonId, userId, role } = c.var.tenant
    const { unreadOnly } = c.req.valid('query')
    const unread = unreadOnly === 'true'

    const list = await forStaffAcrossSalonsOrCurrent(
      role,
      userId,
      (salonIds) =>
        listNotificationsForUserAcrossSalons({
          userId,
          salonIds,
          unreadOnly: unread,
        }),
      () =>
        listNotificationsForUser({
          salonId,
          userId,
          unreadOnly: unread,
        }),
    )
    return ok(c, { notifications: list })
  })
  .post('/read-all', async (c) => {
    const { salonId, userId, role } = c.var.tenant
    const updatedCount = await forStaffAcrossSalonsOrCurrent(
      role,
      userId,
      (salonIds) => markAllNotificationsReadAcrossSalons(userId, salonIds),
      () => markAllNotificationsRead(salonId, userId),
    )
    return ok(c, { success: true, updatedCount })
  })
  .post('/test', async (c) => {
    if (!isNotificationTestRouteEnabled()) {
      return error(c, 'مسیر تست اعلان فعال نیست', 404)
    }
    const { salonId, userId } = c.var.tenant
    const now = new Date()
    const notification = await createNotificationForUser({
      salonId,
      userId,
      type: 'appointment_created',
      title: 'اعلان تست',
      body: `این اعلان تست در ${now.toLocaleString('fa-IR', {
        dateStyle: 'short',
        timeStyle: 'short',
      })} ساخته شد.`,
      route: '/notifications',
      data: {
        source: 'notification_test_route',
        createdAt: now.toISOString(),
        route: '/notifications',
        salonId,
      },
    })
    return ok(c, { notification })
  })
  .post('/:id/read', zValidator('param', idParamSchema), async (c) => {
    const { salonId, userId, role } = c.var.tenant
    const { id } = c.req.valid('param')
    const notification = await forStaffAcrossSalonsOrCurrent(
      role,
      userId,
      (salonIds) => markNotificationReadAcrossSalons(userId, id, salonIds),
      () => markNotificationRead(salonId, userId, id),
    )
    if (!notification) return error(c, 'اعلان پیدا نشد', 404)
    return ok(c, { notification })
  })

export type NotificationsRoute = typeof notifications
