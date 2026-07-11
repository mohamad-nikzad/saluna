import { Hono } from 'hono'
import type { Context } from 'hono'
import { z } from 'zod'
import { isManagerRole } from '@repo/auth/tenant'
import {
  createServiceAddon,
  getAllServiceAddons,
  updateServiceAddon,
} from '@repo/database/services'
import { isClientProvidedEntityId } from '@repo/database/clients'
import {
  serviceAddonCreateSchema,
  serviceAddonUpdateSchema,
} from '@repo/salon-core/forms/service'
import type { AppEnv } from '../factory'
import { requireTenant } from '../middleware/auth'
import { zValidator } from '../lib/validate'
import { error, ok } from '../lib/responses'

const idParamSchema = z.object({ id: z.string().min(1) })
const listQuerySchema = z.object({ all: z.string().optional() })

function addonErrorResponse(c: Context, err: unknown) {
  const msg = err instanceof Error ? err.message : ''
  if (msg.includes('active service add-on name must be unique per salon')) {
    return error(c, 'این نام افزودنی برای این سالن قبلاً ثبت شده است', 409)
  }
  if (
    msg.includes(
      'service add-on price and duration deltas must be non-negative',
    )
  ) {
    return error(c, 'قیمت و زمان افزودنی نمی‌توانند منفی باشند', 400)
  }
  if (msg.includes('service add-on price or duration delta must be positive')) {
    return error(c, 'قیمت یا زمان افزوده باید بیشتر از صفر باشد', 400)
  }
  if (msg.includes('scope not found')) {
    return error(c, 'یکی از محدوده‌های انتخاب‌شده پیدا نشد', 400)
  }
  return null
}

export const serviceAddons = new Hono<AppEnv>()
  .get(
    '/',
    requireTenant(),
    zValidator('query', listQuerySchema),
    async (c) => {
      const { salonId, role } = c.var.tenant
      const { all } = c.req.valid('query')
      const includeInactive = all === '1' && isManagerRole(role)
      const addons = await getAllServiceAddons(salonId, includeInactive)
      return ok(c, { addons })
    },
  )
  .post(
    '/',
    requireTenant('manage_services'),
    zValidator('json', serviceAddonCreateSchema),
    async (c) => {
      const { salonId } = c.var.tenant
      const { id, ...input } = c.req.valid('json')

      if (
        id !== undefined &&
        id !== null &&
        !isClientProvidedEntityId(String(id))
      ) {
        return error(c, 'شناسه افزودنی نامعتبر است', 400)
      }

      try {
        const addon = await createServiceAddon({
          ...input,
          salonId,
          ...(isClientProvidedEntityId(String(id)) ? { id: String(id) } : {}),
        })
        return ok(c, { addon })
      } catch (err) {
        const mapped = addonErrorResponse(c, err)
        if (mapped) return mapped
        throw err
      }
    },
  )
  .patch(
    '/:id',
    requireTenant('manage_services'),
    zValidator('param', idParamSchema),
    zValidator('json', serviceAddonUpdateSchema),
    async (c) => {
      const { salonId } = c.var.tenant
      const { id } = c.req.valid('param')
      const data = c.req.valid('json')
      try {
        const addon = await updateServiceAddon(id, salonId, data)
        if (!addon) return error(c, 'افزودنی یافت نشد', 404)
        return ok(c, { addon })
      } catch (err) {
        const mapped = addonErrorResponse(c, err)
        if (mapped) return mapped
        throw err
      }
    },
  )

export type ServiceAddonsRoute = typeof serviceAddons
