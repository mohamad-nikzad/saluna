import { Hono } from 'hono'
import { z } from 'zod'
import {
  applyCatalogPreset,
  listActiveCatalogPresets,
} from '@repo/database/catalog-presets'
import { applyCatalogPresetBodySchema } from '@repo/salon-core/forms/catalog-preset'
import type { AppEnv } from '../factory'
import { requireTenant } from '../middleware/auth'
import { zValidator } from '../lib/validate'
import { error, ok } from '../lib/responses'

const idParamSchema = z.object({ id: z.string().min(1) })

export const catalogPresets = new Hono<AppEnv>()
  .get('/', requireTenant(), async (c) => {
    const { salonId } = c.var.tenant
    const presets = await listActiveCatalogPresets(salonId)
    return ok(c, { presets })
  })
  .post(
    '/:id/apply',
    requireTenant('manage_services'),
    zValidator('param', idParamSchema),
    zValidator('json', applyCatalogPresetBodySchema),
    async (c) => {
      const { salonId } = c.var.tenant
      const { id } = c.req.valid('param')
      const { selection } = c.req.valid('json')

      try {
        const result = await applyCatalogPreset({
          salonId,
          presetId: id,
          selection,
        })
        return ok(c, result)
      } catch (err) {
        const msg = err instanceof Error ? err.message : ''
        if (msg.includes('not found') || msg.includes('inactive')) {
          return error(c, 'قالب یافت نشد یا غیرفعال است', 404)
        }
        if (msg.includes('collides')) {
          return error(c, 'این قالب با دسته‌های موجود سالن همپوشانی دارد', 409)
        }
        if (msg.includes('selection is empty')) {
          return error(c, 'حداقل یک خدمت برای افزودن انتخاب کنید', 400)
        }
        if (msg.includes('unique') || msg.includes('duplicate')) {
          return error(c, 'برخی از خدمات این قالب در سالن قبلاً ثبت شده‌اند', 409)
        }
        throw err
      }
    },
  )
