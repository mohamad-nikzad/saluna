import { Hono } from 'hono'
import { z } from 'zod'
import { isManagerRole } from '@repo/auth/tenant'
import {
  CatalogReferenceError,
  createService,
  getActiveServiceAddonsForService,
  getAllServices,
  getServiceById,
  importStarterServiceTemplates,
  updateService,
} from '@repo/database/services'
import { isClientProvidedEntityId } from '@repo/database/clients'
import {
  serviceCreateSchema,
  serviceUpdateSchema,
} from '@repo/salon-core/forms/service'
import type { Service } from '@repo/salon-core/types'
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

export const services = new Hono<AppEnv>()
  .get(
    '/',
    requireTenant(),
    zValidator('query', listQuerySchema),
    async (c) => {
      const { salonId, role } = c.var.tenant
      const { all } = c.req.valid('query')
      const includeInactive = all === '1' && isManagerRole(role)
      const list = await getAllServices(salonId, includeInactive)
      return ok(c, { services: list })
    },
  )
  .post(
    '/',
    requireTenant('manage_services'),
    zValidator('json', serviceCreateSchema),
    async (c) => {
      const { salonId } = c.var.tenant
      const {
        name,
        categoryId,
        duration,
        price,
        color,
        active,
        id,
        description,
      } = c.req.valid('json')

      if (!categoryId) {
        return error(c, 'بخش خدمات را انتخاب کنید', 400)
      }

      if (
        id !== undefined &&
        id !== null &&
        !isClientProvidedEntityId(String(id))
      ) {
        return error(c, 'شناسه خدمت نامعتبر است', 400)
      }

      try {
        const service = await createService({
          name,
          categoryId,
          duration,
          price,
          color,
          active: active !== false,
          description,
          salonId,
          ...(isClientProvidedEntityId(String(id)) ? { id: String(id) } : {}),
        })
        return ok(c, { service })
      } catch (err) {
        if (isDuplicateError(err)) {
          return error(c, 'این نام خدمت برای این سالن قبلاً ثبت شده است', 409)
        }
        if (err instanceof CatalogReferenceError) {
          return error(c, 'بخش انتخاب‌شده معتبر نیست', 400)
        }
        throw err
      }
    },
  )
  .post(
    '/import-starter-templates',
    requireTenant('manage_services'),
    async (c) => {
      const { salonId } = c.var.tenant
      const result = await importStarterServiceTemplates(salonId)
      return ok(c, result)
    },
  )
  .get(
    '/:id',
    requireTenant(),
    zValidator('param', idParamSchema),
    async (c) => {
      const { salonId } = c.var.tenant
      const { id } = c.req.valid('param')
      const service = await getServiceById(id, salonId)
      if (!service) return error(c, 'خدمت یافت نشد', 404)
      return ok(c, { service })
    },
  )
  .patch(
    '/:id',
    requireTenant('manage_services'),
    zValidator('param', idParamSchema),
    zValidator('json', serviceUpdateSchema),
    async (c) => {
      const { salonId } = c.var.tenant
      const { id } = c.req.valid('param')
      const { name, categoryId, duration, price, color, active, description } =
        c.req.valid('json')

      const patch: Partial<Service> = {}
      if (name !== undefined) patch.name = name
      if (categoryId !== undefined) patch.categoryId = categoryId
      if (duration !== undefined) patch.duration = duration
      if (price !== undefined) patch.price = price
      if (color !== undefined) patch.color = color
      if (active !== undefined) patch.active = Boolean(active)
      if (description !== undefined) patch.description = description

      try {
        const service = await updateService(id, salonId, patch)
        if (!service) return error(c, 'خدمت یافت نشد', 404)
        return ok(c, { service })
      } catch (err) {
        if (isDuplicateError(err)) {
          return error(c, 'این نام خدمت برای این سالن قبلاً ثبت شده است', 409)
        }
        if (err instanceof CatalogReferenceError) {
          return error(c, 'بخش انتخاب‌شده معتبر نیست', 400)
        }
        throw err
      }
    },
  )
  .get(
    '/:id/addons',
    requireTenant(),
    zValidator('param', idParamSchema),
    async (c) => {
      const { salonId } = c.var.tenant
      const { id } = c.req.valid('param')
      const addons = await getActiveServiceAddonsForService(id, salonId)
      return ok(c, { addons })
    },
  )

export type ServicesRoute = typeof services
