import { Hono } from 'hono'
import { z } from 'zod'
import { isManagerRole } from '@repo/auth/tenant'
import {
  createServiceCategory,
  getAllServiceCategories,
  updateServiceCategory,
} from '@repo/database/services'
import { isClientProvidedEntityId } from '@repo/database/clients'
import {
  serviceCategoryCreateSchema,
  serviceCategoryUpdateSchema,
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

export const serviceCategories = new Hono<AppEnv>()
  .get(
    '/',
    requireTenant(),
    zValidator('query', listQuerySchema),
    async (c) => {
      const { salonId, role } = c.var.tenant
      const { all } = c.req.valid('query')
      const includeInactive = all === '1' && isManagerRole(role)
      const categories = await getAllServiceCategories(salonId, includeInactive)
      return ok(c, { categories })
    },
  )
  .post(
    '/',
    requireTenant('manage_services'),
    zValidator('json', serviceCategoryCreateSchema),
    async (c) => {
      const { salonId } = c.var.tenant
      const { id, name, active } = c.req.valid('json')

      if (
        id !== undefined &&
        id !== null &&
        !isClientProvidedEntityId(String(id))
      ) {
        return error(c, 'شناسه بخش نامعتبر است', 400)
      }

      try {
        const category = await createServiceCategory({
          name,
          active: active !== false,
          salonId,
          ...(isClientProvidedEntityId(String(id)) ? { id: String(id) } : {}),
        })
        return ok(c, { category })
      } catch (err) {
        if (isDuplicateError(err)) {
          return error(c, 'این نام بخش برای این سالن قبلاً ثبت شده است', 409)
        }
        throw err
      }
    },
  )
  .patch(
    '/:id',
    requireTenant('manage_services'),
    zValidator('param', idParamSchema),
    zValidator('json', serviceCategoryUpdateSchema),
    async (c) => {
      const { salonId } = c.var.tenant
      const { id } = c.req.valid('param')
      const data = c.req.valid('json')
      try {
        const category = await updateServiceCategory(id, salonId, data)
        if (!category) return error(c, 'بخش خدمات یافت نشد', 404)
        return ok(c, { category })
      } catch (err) {
        if (isDuplicateError(err)) {
          return error(c, 'این نام بخش برای این سالن قبلاً ثبت شده است', 409)
        }
        throw err
      }
    },
  )

export type ServiceCategoriesRoute = typeof serviceCategories
