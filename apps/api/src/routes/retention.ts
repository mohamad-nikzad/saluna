import { Hono } from 'hono'
import { z } from 'zod'
import { getRetentionQueue } from '@repo/database/retention'
import { updateClientFollowUpStatus } from '@repo/database/clients'
import type { FollowUpStatus } from '@repo/salon-core/types'
import type { AppEnv } from '../factory'
import { requireTenant } from '../middleware/auth'
import { error, ok } from '../lib/responses'

const allowedStatuses = new Set<FollowUpStatus>(['open', 'reviewed', 'dismissed'])

const idParamSchema = z.object({ id: z.string().min(1) })

export const retention = new Hono<AppEnv>()
  .use(requireTenant('manage_settings'))
  .get('/', async (c) => {
    const { salonId } = c.var.tenant
    const items = await getRetentionQueue(salonId)
    return ok(c, { items })
  })
  .patch('/:id', async (c) => {
    const parsedParam = idParamSchema.safeParse({ id: c.req.param('id') })
    if (!parsedParam.success) return error(c, 'شناسه نامعتبر است', 400)

    const body = (await c.req.json().catch(() => ({}))) as { status?: unknown }
    if (!allowedStatuses.has(body.status as FollowUpStatus)) {
      return error(c, 'وضعیت نامعتبر است', 400)
    }
    const { salonId } = c.var.tenant
    const followUp = await updateClientFollowUpStatus(
      salonId,
      parsedParam.data.id,
      body.status as FollowUpStatus,
    )
    if (!followUp) return error(c, 'پیگیری یافت نشد', 404)
    return ok(c, { followUp })
  })

export type RetentionRoute = typeof retention
