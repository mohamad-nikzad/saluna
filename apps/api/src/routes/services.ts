import { Hono } from 'hono'
import type { Context } from 'hono'
import { z } from 'zod'
import { isManagerRole } from '@repo/auth/tenant'
import {
  createService,
  getActiveServiceAddonsForService,
  getAllServices,
  getComboComponents,
  getServiceById,
  importStarterServiceTemplates,
  replaceComboComponents,
  updateService,
} from '@repo/database/services'
import { isClientProvidedEntityId } from '@repo/database/clients'
import {
  comboComponentsUpdateSchema,
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

function isActiveComboMissingComponentsError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : ''
  return msg.includes('active combo service must have at least one component')
}

function comboComponentErrorResponse(c: Context, err: unknown) {
  const msg = err instanceof Error ? err.message : ''
  if (msg.includes('combo service not found')) {
    return error(c, 'پکیج یافت نشد', 404)
  }
  if (msg.includes('active combo service must have at least one component')) {
    return error(c, 'پکیج فعال باید حداقل یک خدمت در ترکیب خود داشته باشد', 400)
  }
  if (msg.includes('combo service cannot contain itself')) {
    return error(c, 'پکیج نمی‌تواند شامل خودش باشد', 400)
  }
  if (msg.includes('combo components cannot contain duplicates')) {
    return error(c, 'هر خدمت فقط یک بار می‌تواند در پکیج باشد', 400)
  }
  if (msg.includes('combo component service not found')) {
    return error(c, 'یکی از خدمات انتخاب‌شده پیدا نشد', 400)
  }
  if (msg.includes('combo service cannot contain another combo service')) {
    return error(c, 'پکیج نمی‌تواند شامل پکیج دیگری باشد', 400)
  }
  return null
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
        familyId,
        duration,
        price,
        color,
        active,
        id,
        description,
        kind,
      } = c.req.valid('json')

      if (!familyId) {
        return error(c, 'گروه خدمات را انتخاب کنید', 400)
      }

      if (id !== undefined && id !== null && !isClientProvidedEntityId(String(id))) {
        return error(c, 'شناسه خدمت نامعتبر است', 400)
      }

      try {
        const service = await createService({
          name,
          familyId,
          duration,
          price,
          color,
          active: active !== false,
          description,
          kind,
          salonId,
          ...(isClientProvidedEntityId(String(id)) ? { id: String(id) } : {}),
        })
        return ok(c, { service })
      } catch (err) {
        if (isDuplicateError(err)) {
          return error(c, 'این نام خدمت برای این سالن قبلاً ثبت شده است', 409)
        }
        if (isActiveComboMissingComponentsError(err)) {
          return error(c, 'پکیج فعال باید حداقل یک خدمت در ترکیب خود داشته باشد', 400)
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
      const { name, familyId, duration, price, color, active, description, kind } =
        c.req.valid('json')

      const patch: Partial<Service> = {}
      if (name !== undefined) patch.name = name
      if (familyId !== undefined) patch.familyId = familyId
      if (duration !== undefined) patch.duration = duration
      if (price !== undefined) patch.price = price
      if (color !== undefined) patch.color = color
      if (active !== undefined) patch.active = Boolean(active)
      if (description !== undefined) patch.description = description
      if (kind !== undefined) patch.kind = kind

      try {
        const service = await updateService(id, salonId, patch)
        if (!service) return error(c, 'خدمت یافت نشد', 404)
        return ok(c, { service })
      } catch (err) {
        if (isDuplicateError(err)) {
          return error(c, 'این نام خدمت برای این سالن قبلاً ثبت شده است', 409)
        }
        if (isActiveComboMissingComponentsError(err)) {
          return error(c, 'پکیج فعال باید حداقل یک خدمت در ترکیب خود داشته باشد', 400)
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
  .get(
    '/:id/combo-components',
    requireTenant(),
    zValidator('param', idParamSchema),
    async (c) => {
      const { salonId } = c.var.tenant
      const { id } = c.req.valid('param')
      const combo = await getComboComponents(id, salonId)
      if (!combo) return error(c, 'پکیج یافت نشد', 404)
      return ok(c, { combo })
    },
  )
  .put(
    '/:id/combo-components',
    requireTenant('manage_services'),
    zValidator('param', idParamSchema),
    zValidator('json', comboComponentsUpdateSchema),
    async (c) => {
      const { salonId } = c.var.tenant
      const { id } = c.req.valid('param')
      const { componentServiceIds } = c.req.valid('json')
      try {
        const combo = await replaceComboComponents(id, salonId, componentServiceIds)
        return ok(c, { combo })
      } catch (err) {
        const mapped = comboComponentErrorResponse(c, err)
        if (mapped) return mapped
        throw err
      }
    },
  )

export type ServicesRoute = typeof services
