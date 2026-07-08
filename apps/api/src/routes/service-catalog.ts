import { Hono } from 'hono'
import { z } from 'zod'
import { isManagerRole } from '@repo/auth/tenant'
import {
  getAllServiceAddons,
  getAllServiceCategories,
  getAllServicePackages,
  getAllServices,
} from '@repo/database/services'
import type { AppEnv } from '../factory'
import { requireTenant } from '../middleware/auth'
import { zValidator } from '../lib/validate'
import { ok } from '../lib/responses'

const listQuerySchema = z.object({ all: z.string().optional() })

export const serviceCatalog = new Hono<AppEnv>().get(
  '/',
  requireTenant(),
  zValidator('query', listQuerySchema),
  async (c) => {
    const { salonId, role } = c.var.tenant
    const { all } = c.req.valid('query')
    const includeInactive = all === '1' && isManagerRole(role)
    const [categories, services, addons, packages] = await Promise.all([
      getAllServiceCategories(salonId, includeInactive),
      getAllServices(salonId, includeInactive),
      getAllServiceAddons(salonId, includeInactive),
      isManagerRole(role)
        ? getAllServicePackages(salonId, includeInactive)
        : Promise.resolve([]),
    ])

    return ok(c, { categories, services, addons, packages })
  },
)

export type ServiceCatalogRoute = typeof serviceCatalog
