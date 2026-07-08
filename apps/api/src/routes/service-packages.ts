import { Hono } from 'hono'
import type { Context } from 'hono'
import { z } from 'zod'
import { isManagerRole } from '@repo/auth/tenant'
import {
  createServicePackageBooking,
  createServicePackage,
  getAllServicePackages,
  getServicePackageById,
  replaceServicePackageComponents,
  replaceServicePackageStaffCapabilities,
  updateServicePackage,
} from '@repo/database/services'
import { isClientProvidedEntityId } from '@repo/database/clients'
import {
  servicePackageComponentsUpdateSchema,
  servicePackageBookingCreateSchema,
  servicePackageCreateSchema,
  servicePackageStaffUpdateSchema,
  servicePackageUpdateSchema,
} from '@repo/salon-core/forms/service'
import type { AppEnv } from '../factory'
import { requireTenant } from '../middleware/auth'
import { zValidator } from '../lib/validate'
import { error, ok } from '../lib/responses'

const idParamSchema = z.object({ id: z.string().min(1) })
const listQuerySchema = z.object({ all: z.string().optional() })

const packageErrorMap = [
  [
    'active service package name must be unique per salon',
    'این نام پکیج برای این سالن قبلاً ثبت شده است',
    409,
  ],
  ['service package category not found', 'بخش انتخاب‌شده معتبر نیست', 400],
  ['service package not found', 'پکیج یافت نشد', 404],
  [
    'service package components cannot contain duplicates',
    'هر خدمت فقط یک بار می‌تواند در پکیج باشد',
    400,
  ],
  [
    'service package component service not found',
    'یکی از خدمات انتخاب‌شده پیدا نشد',
    400,
  ],
  [
    'service package components must be active services',
    'همه خدمات داخل پکیج باید فعال باشند',
    400,
  ],
  [
    'service package staff capabilities cannot contain duplicates',
    'هر پرسنل فقط یک بار می‌تواند برای پکیج انتخاب شود',
    400,
  ],
  [
    'service package staff capability staff not found',
    'یکی از پرسنل انتخاب‌شده پیدا نشد',
    400,
  ],
  [
    'service package cannot contain legacy combo services',
    'پکیج نمی‌تواند شامل پکیج قدیمی یا خدمت ترکیبی باشد',
    400,
  ],
  [
    'service package booking package inactive',
    'پکیج انتخاب‌شده فعال نیست',
    400,
  ],
  [
    'service package booking package has no components',
    'این پکیج هنوز خدمتی ندارد',
    400,
  ],
  [
    'service package booking tasks must match package components',
    'برای همه خدمات داخل پکیج زمان‌بندی ارسال کنید',
    400,
  ],
  [
    'service package booking task component not found',
    'یکی از اجزای پکیج پیدا نشد',
    400,
  ],
  [
    'service package booking task component duplicate',
    'هر جزء پکیج فقط یک بار قابل زمان‌بندی است',
    400,
  ],
  [
    'service package booking task must identify one component',
    'برای هر ردیف زمان‌بندی فقط یک جزء پکیج را مشخص کنید',
    400,
  ],
  [
    'service package booking add-ons are not supported',
    'افزودنی برای زمان‌بندی پکیج پشتیبانی نمی‌شود',
    400,
  ],
  [
    'service package booking component service inactive',
    'یکی از خدمات داخل پکیج غیرفعال است',
    400,
  ],
  [
    'service package booking component service invalid',
    'یکی از خدمات داخل پکیج معتبر نیست',
    400,
  ],
  ['service package booking client not found', 'مشتری یافت نشد', 404],
  ['service package booking staff not found', 'پرسنل یافت نشد', 404],
  [
    'service package booking staff cannot perform service',
    'این پرسنل برای یکی از خدمات داخل پکیج تعریف نشده است',
    400,
  ],
  [
    'service package booking internal staff conflict',
    'یک پرسنل در زمان‌بندی همین پکیج تداخل دارد',
    409,
  ],
] as const

function packageErrorResponse(c: Context, err: unknown) {
  const msg = err instanceof Error ? err.message : ''
  const mapped = packageErrorMap.find(([fragment]) => msg.includes(fragment))
  if (mapped) {
    return error(c, mapped[1], mapped[2])
  }
  if (msg.includes('service package booking staff unavailable:')) {
    return error(
      c,
      msg.split(':').slice(1).join(':') || 'پرسنل در این زمان در دسترس نیست',
      409,
    )
  }
  if (msg.includes('service package booking staff conflict')) {
    return error(
      c,
      'پرسنل انتخاب‌شده در این بازه زمانی نوبت فعال دیگری دارد',
      409,
      'STAFF_OVERLAP',
    )
  }
  if (msg.includes('service package booking client conflict')) {
    return error(
      c,
      'این مشتری در این بازه زمانی نوبت فعال دیگری دارد',
      409,
      'CLIENT_OVERLAP',
    )
  }
  if (msg.includes('ساعت پایان باید بعد از شروع باشد')) {
    return error(c, msg, 400)
  }
  if (msg.includes('مدت نوبت باید بین')) {
    return error(c, msg, 400)
  }
  return null
}

export const servicePackages = new Hono<AppEnv>()
  .get(
    '/',
    requireTenant('manage_services'),
    zValidator('query', listQuerySchema),
    async (c) => {
      const { salonId, role } = c.var.tenant
      const { all } = c.req.valid('query')
      const includeInactive = all === '1' && isManagerRole(role)
      const packages = await getAllServicePackages(salonId, includeInactive)
      return ok(c, { packages })
    },
  )
  .post(
    '/',
    requireTenant('manage_services'),
    zValidator('json', servicePackageCreateSchema),
    async (c) => {
      const { salonId } = c.var.tenant
      const { id, ...input } = c.req.valid('json')
      const clientId = id !== undefined && id !== null ? String(id) : undefined

      if (clientId !== undefined && !isClientProvidedEntityId(clientId)) {
        return error(c, 'شناسه پکیج نامعتبر است', 400)
      }

      try {
        const servicePackage = await createServicePackage({
          ...input,
          categoryId: input.categoryId ?? null,
          salonId,
          ...(clientId !== undefined && isClientProvidedEntityId(clientId)
            ? { id: clientId }
            : {}),
        })
        return ok(c, { package: servicePackage })
      } catch (err) {
        const mapped = packageErrorResponse(c, err)
        if (mapped) return mapped
        throw err
      }
    },
  )
  .post(
    '/:id/bookings',
    requireTenant('manage_settings'),
    zValidator('param', idParamSchema),
    zValidator('json', servicePackageBookingCreateSchema),
    async (c) => {
      const { salonId, userId } = c.var.tenant
      const { id } = c.req.valid('param')
      const body = c.req.valid('json')
      try {
        const booking = await createServicePackageBooking({
          salonId,
          packageId: id,
          clientId: body.clientId,
          date: body.date,
          tasks: body.tasks,
          notes: body.notes,
          createdByUserId: userId,
        })
        return ok(c, { booking })
      } catch (err) {
        const mapped = packageErrorResponse(c, err)
        if (mapped) return mapped
        throw err
      }
    },
  )
  .get(
    '/:id',
    requireTenant('manage_services'),
    zValidator('param', idParamSchema),
    async (c) => {
      const { salonId } = c.var.tenant
      const { id } = c.req.valid('param')
      const servicePackage = await getServicePackageById(id, salonId)
      if (!servicePackage) return error(c, 'پکیج یافت نشد', 404)
      return ok(c, { package: servicePackage })
    },
  )
  .patch(
    '/:id',
    requireTenant('manage_services'),
    zValidator('param', idParamSchema),
    zValidator('json', servicePackageUpdateSchema),
    async (c) => {
      const { salonId } = c.var.tenant
      const { id } = c.req.valid('param')
      const data = c.req.valid('json')
      try {
        const servicePackage = await updateServicePackage(id, salonId, data)
        if (!servicePackage) return error(c, 'پکیج یافت نشد', 404)
        return ok(c, { package: servicePackage })
      } catch (err) {
        const mapped = packageErrorResponse(c, err)
        if (mapped) return mapped
        throw err
      }
    },
  )
  .put(
    '/:id/components',
    requireTenant('manage_services'),
    zValidator('param', idParamSchema),
    zValidator('json', servicePackageComponentsUpdateSchema),
    async (c) => {
      const { salonId } = c.var.tenant
      const { id } = c.req.valid('param')
      const { serviceIds } = c.req.valid('json')
      try {
        const servicePackage = await replaceServicePackageComponents(
          id,
          salonId,
          serviceIds,
        )
        return ok(c, { package: servicePackage })
      } catch (err) {
        const mapped = packageErrorResponse(c, err)
        if (mapped) return mapped
        throw err
      }
    },
  )
  .put(
    '/:id/staff',
    requireTenant('manage_services'),
    zValidator('param', idParamSchema),
    zValidator('json', servicePackageStaffUpdateSchema),
    async (c) => {
      const { salonId } = c.var.tenant
      const { id } = c.req.valid('param')
      const { staffIds } = c.req.valid('json')
      try {
        const servicePackage = await replaceServicePackageStaffCapabilities(
          id,
          salonId,
          staffIds,
        )
        return ok(c, { package: servicePackage })
      } catch (err) {
        const mapped = packageErrorResponse(c, err)
        if (mapped) return mapped
        throw err
      }
    },
  )

export type ServicePackagesRoute = typeof servicePackages
