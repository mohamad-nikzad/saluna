import { Hono } from 'hono'
import { z } from 'zod'
import { getRetentionQueue } from '@repo/database/retention'
import {
  createClientFollowUpMessageDelivery,
  getClientFollowUpMessageContext,
  getLatestClientFollowUpMessageDelivery,
  updateClientFollowUpStatus,
} from '@repo/database/clients'
import type { FollowUpStatus } from '@repo/salon-core/types'
import {
  normalizeBaleSafirPhone,
  sendBaleSafirMessage,
} from '@repo/notifications'
import type { AppEnv } from '../factory'
import { requireTenant } from '../middleware/auth'
import { error, ok } from '../lib/responses'

const allowedStatuses = new Set<FollowUpStatus>(['open', 'reviewed', 'dismissed'])

const idParamSchema = z.object({ id: z.string().min(1) })
const baleMessageBodySchema = z.object({
  retry: z.boolean().optional().default(false),
})

function buildBaleRetentionMessage(input: {
  salonName: string
  clientName: string
  reason: string
}): string {
  const reasonText =
    input.reason === 'inactive'
      ? 'مدتی از آخرین مراجعه شما گذشته'
      : input.reason === 'no-show'
        ? 'برای هماهنگی نوبت بعدی'
        : input.reason === 'new-client'
          ? 'برای ادامه مراقبت بعد از مراجعه اول'
          : input.reason === 'vip'
            ? 'به عنوان مشتری ارزشمند ما'
            : 'برای پیگیری نوبت بعدی'

  return [
    `${input.clientName} عزیز، سلام`,
    `از ${input.salonName} پیام می‌دهیم. ${reasonText} خوشحال می‌شویم برای رزرو یا مشاوره کنار شما باشیم.`,
  ].join('\n')
}

function buildBaleRetentionRequestId(followUpId: string): string {
  return `retention:${followUpId}:bale_safir:v1`
}

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
  .post('/:id/bale-message', async (c) => {
    const parsedParam = idParamSchema.safeParse({ id: c.req.param('id') })
    if (!parsedParam.success) return error(c, 'شناسه نامعتبر است', 400)

    const body = await c.req.json().catch(() => ({}))
    const parsedBody = baleMessageBodySchema.safeParse(body)
    if (!parsedBody.success) return error(c, 'درخواست نامعتبر است', 400)

    const { salonId, userId } = c.var.tenant
    const context = await getClientFollowUpMessageContext(salonId, parsedParam.data.id)
    if (!context) return error(c, 'پیگیری یافت نشد', 404)
    if (context.followUp.status !== 'open') {
      return error(c, 'فقط پیگیری باز قابل ارسال است', 409)
    }

    const phone = context.client.phone
    const normalizedPhone = phone ? normalizeBaleSafirPhone(phone) : null
    if (!normalizedPhone) return error(c, 'شماره موبایل مشتری معتبر نیست', 400)

    const previous = await getLatestClientFollowUpMessageDelivery({
      salonId,
      followUpId: context.followUp.id,
      provider: 'bale_safir',
    })
    if (previous?.status === 'sent') {
      return error(c, 'پیام بله قبلا ارسال شده است', 409)
    }
    if (previous && !parsedBody.data.retry) {
      return error(c, 'برای ارسال دوباره، retry را فعال کنید', 409)
    }

    const requestId = buildBaleRetentionRequestId(context.followUp.id)
    const result = await sendBaleSafirMessage({
      phone: normalizedPhone,
      text: buildBaleRetentionMessage({
        salonName: context.salon.name,
        clientName: context.client.name,
        reason: context.followUp.reason,
      }),
      requestId,
    })

    const delivery = await createClientFollowUpMessageDelivery({
      salonId,
      followUpId: context.followUp.id,
      clientId: context.client.id,
      provider: 'bale_safir',
      phone: result.phone ?? normalizedPhone,
      requestId,
      status: result.status,
      providerMessageId: result.providerMessageId ?? null,
      error: result.error ?? null,
      sentByUserId: userId,
    })

    return ok(c, { delivery, result })
  })

export type RetentionRoute = typeof retention
