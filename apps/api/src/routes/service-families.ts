import { Hono } from 'hono'
import { z } from 'zod'
import { isManagerRole } from '@repo/auth/tenant'
import {
  createServiceFamily,
  getAllServiceFamilies,
  updateServiceFamily,
} from '@repo/database/services'
import { isClientProvidedEntityId } from '@repo/database/clients'
import {
  serviceFamilyCreateSchema,
  serviceFamilyUpdateSchema,
} from '@repo/salon-core/forms/service'
import type { AppEnv } from '../factory'
import { requireTenant } from '../middleware/auth'
import { zValidator } from '../lib/validate'
import { error, ok } from '../lib/responses'

const idParamSchema = z.object({ id: z.string().min(1) })
const listQuerySchema = z.object({ all: z.string().optional() })

function isDuplicateError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : ''
  return msg.includes('unique') || msg.includes('duplicate')
}

function isNotFoundError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : ''
  return msg.includes('not found')
}

export const serviceFamilies = new Hono<AppEnv>()
  .get(
    '/',
    requireTenant(),
    zValidator('query', listQuerySchema),
    async (c) => {
      const { salonId, role } = c.var.tenant
      const { all } = c.req.valid('query')
      const includeInactive = all === '1' && isManagerRole(role)
      const families = await getAllServiceFamilies(salonId, includeInactive)
      return ok(c, { families })
    },
  )
  .post(
    '/',
    requireTenant('manage_services'),
    zValidator('json', serviceFamilyCreateSchema),
    async (c) => {
      const { salonId } = c.var.tenant
      const { id, categoryId, name, active } = c.req.valid('json')

      if (
        id !== undefined &&
        id !== null &&
        !isClientProvidedEntityId(String(id))
      ) {
        return error(c, 'شناسه گروه خدمات نامعتبر است', 400)
      }

      try {
        const family = await createServiceFamily({
          categoryId,
          name,
          active: active !== false,
          salonId,
          ...(isClientProvidedEntityId(String(id)) ? { id: String(id) } : {}),
        })
        return ok(c, { family })
      } catch (err) {
        if (isDuplicateError(err)) {
          return error(c, 'این نام گروه برای این بخش قبلاً ثبت شده است', 409)
        }
        if (isNotFoundError(err)) {
          return error(c, 'بخش خدمات یافت نشد', 400)
        }
        throw err
      }
    },
  )
  .patch(
    '/:id',
    requireTenant('manage_services'),
    zValidator('param', idParamSchema),
    zValidator('json', serviceFamilyUpdateSchema),
    async (c) => {
      const { salonId } = c.var.tenant
      const { id } = c.req.valid('param')
      const data = c.req.valid('json')
      try {
        const family = await updateServiceFamily(id, salonId, data)
        if (!family) return error(c, 'گروه خدمات یافت نشد', 404)
        return ok(c, { family })
      } catch (err) {
        if (isDuplicateError(err)) {
          return error(c, 'این نام گروه برای این بخش قبلاً ثبت شده است', 409)
        }
        if (isNotFoundError(err)) {
          return error(c, 'بخش خدمات یافت نشد', 400)
        }
        throw err
      }
    },
  )

export type ServiceFamiliesRoute = typeof serviceFamilies
