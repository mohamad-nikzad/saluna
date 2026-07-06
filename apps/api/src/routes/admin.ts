import { Hono } from 'hono'
import { z } from 'zod'
import {
  countActivePlatformOwners,
  createSetupSalon,
  createAdminCatalogPreset,
  createAdminInternalNote,
  getAdminMessagingHealth,
  getAdminOverview,
  getAdminSalon,
  getAdminUser,
  getPlatformAdminById,
  getPlatformAdminMe,
  listAdminAuditLog,
  listAdminCatalogPresets,
  listAdminInternalNotes,
  listAdminNotificationDeliveries,
  listAdminSalonAppointmentRequests,
  listAdminSalonAppointments,
  listAdminSalonClients,
  listAdminSalonServices,
  listAdminSalonStaff,
  listAdminSalons,
  listAdminSupportAppointmentRequests,
  listAdminSupportAppointments,
  listAdminUsers,
  listPlatformAdmins,
  updateAdminCatalogPreset,
  updateAdminSalonStatus,
  updatePlatformAdmin,
  upsertPlatformAdmin,
  type PlatformRole,
} from '@repo/database/admin'
import {
  createSalonHandoff,
  getSalonIdentityConflictForPhone,
  updateSetupSalonOwnerPhone,
} from '@repo/database/salon-handoff'
import {
  CatalogReferenceError,
  createService,
  createServiceAddon,
  createServiceCategory,
  getAllServiceAddons,
  getAllServiceCategories,
  getAllServices,
  updateService,
  updateServiceAddon,
  updateServiceCategory,
} from '@repo/database/services'
import {
  applyCatalogPreset,
  listActiveCatalogPresets,
} from '@repo/database/catalog-presets'
import {
  getBusinessSettings,
  updateBusinessSettings,
} from '@repo/database/settings'
import {
  createSetupStaffProfile,
  getClaimedStaffAccessForPhone,
  listSetupStaffProfiles,
  validateActiveServiceIds,
} from '@repo/database/staff'
import {
  getSalonPresence,
  updateSalonPresence,
} from '@repo/database/salon-profile'
import {
  createClient,
  createClientsBulk,
  getAllClients,
  isDuplicatePhoneError,
  setClientTags,
} from '@repo/database/clients'
import { clientFormSchema } from '@repo/salon-core/forms/client'
import { buildClientImportPreview } from '@repo/salon-core/client-import'
import { parseClientCsv } from '@repo/salon-core/csv'
import { parseVcfFile } from '@repo/salon-core/vcf'
import { presetTreeSchema } from '@repo/salon-core/forms/catalog-preset'
import { applyCatalogPresetBodySchema } from '@repo/salon-core/forms/catalog-preset'
import {
  serviceAddonCreateSchema,
  serviceAddonUpdateSchema,
  serviceCategoryCreateSchema,
  serviceCategoryUpdateSchema,
  serviceCreateSchema,
  serviceUpdateSchema,
} from '@repo/salon-core/forms/service'
import type { Service } from '@repo/salon-core/types'
import { phoneSchema } from '@repo/salon-core/forms/primitives'
import { normalizeCalendarColorId } from '@repo/salon-core/calendar-colors'
import { businessSettingsSchema } from '@repo/salon-core/forms/settings'
import { presencePatchSchema } from '@repo/salon-core/forms/presence'
import type { AppEnv } from '../factory'
import { getEnv } from '../env'
import { requirePlatformAdmin } from '../middleware/auth'
import { error, ok, created } from '../lib/responses'
import { zValidator } from '../lib/validate'
import {
  adminAuditRequestMeta as auditMeta,
  writeAdminAudit as writeAudit,
} from '../lib/admin-audit'

const idParamSchema = z.object({ id: z.string().uuid() })

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().trim().optional(),
})

const auditQuerySchema = listQuerySchema.extend({
  action: z.string().trim().optional(),
  targetType: z.string().trim().optional(),
  targetId: z.string().trim().optional(),
  salonId: z.string().uuid().optional(),
})

const statusBodySchema = z.object({
  status: z.enum(['active', 'suspended', 'archived']),
})

const setupSalonBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  intendedOwnerPhone: phoneSchema,
})

const setupOwnerPhoneBodySchema = z.object({
  intendedOwnerPhone: phoneSchema,
})

const setupHandoffBodySchema = z.object({
  enablePublicPage: z.boolean().default(false),
})

const setupMutationMetaSchema = z.object({
  override: z.literal(true).optional(),
})

const setupAccessQuerySchema = z.object({
  override: z
    .literal('true')
    .transform(() => true)
    .optional(),
})

const setupHoursBodySchema = businessSettingsSchema.and(setupMutationMetaSchema)
const setupPresenceBodySchema = presencePatchSchema.and(setupMutationMetaSchema)
const setupStaffScheduleSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  active: z.boolean(),
  workingStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  workingEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
})
const setupStaffCreateBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: phoneSchema,
  color: z.string().trim().min(1).max(40),
  active: z.boolean().default(true),
  serviceIds: z.array(z.string().uuid()).nullable(),
  schedule: z.array(setupStaffScheduleSchema).max(7),
  override: z.literal(true).optional(),
})
const setupStaffAccessQuerySchema = z.object({
  phone: phoneSchema,
  override: z
    .literal('true')
    .transform(() => true)
    .optional(),
})
const setupClientCreateBodySchema = clientFormSchema.and(
  setupMutationMetaSchema,
)
const setupClientImportSourceSchema = z.object({
  format: z.enum(['csv', 'vcf']),
  source: z.string().min(1).max(2_000_000),
  override: z.literal(true).optional(),
})
const setupClientImportBodySchema = setupClientImportSourceSchema.extend({
  selectedLocalIds: z.array(z.string().min(1)).min(1).max(200),
})
const setupCatalogPresetBodySchema = applyCatalogPresetBodySchema.and(
  setupMutationMetaSchema,
)
const setupCategoryCreateBodySchema = serviceCategoryCreateSchema.and(
  setupMutationMetaSchema,
)
const setupCategoryUpdateBodySchema = serviceCategoryUpdateSchema.and(
  setupMutationMetaSchema,
)
const setupServiceCreateBodySchema = serviceCreateSchema.and(
  setupMutationMetaSchema,
)
const setupServiceUpdateBodySchema = serviceUpdateSchema.and(
  setupMutationMetaSchema,
)
const setupAddonCreateBodySchema = serviceAddonCreateSchema.and(
  setupMutationMetaSchema,
)
const setupAddonUpdateBodySchema = serviceAddonUpdateSchema.and(
  setupMutationMetaSchema,
)
const setupCatalogEntityParamSchema = idParamSchema.extend({
  entityId: z.string().min(1),
})
const setupCatalogPresetParamSchema = idParamSchema.extend({
  presetId: z.string().uuid(),
})

const noteBodySchema = z.object({
  body: z.string().trim().min(1).max(5000),
})

const catalogPresetCreateSchema = z.object({
  slug: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  tree: presetTreeSchema,
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
})

const catalogPresetUpdateSchema = catalogPresetCreateSchema.partial()

const platformRoleSchema = z.enum([
  'platform_owner',
  'platform_admin',
  'platform_support',
  'platform_viewer',
])

const platformAdminCreateSchema = z.object({
  userId: z.string().uuid(),
  role: platformRoleSchema,
  active: z.boolean().optional(),
})

const platformAdminUpdateSchema = z.object({
  role: platformRoleSchema.optional(),
  active: z.boolean().optional(),
})

function runtime() {
  return { dataSource: getEnv().ADMIN_DATA_SOURCE }
}

async function requireExistingSalon(
  c: Parameters<typeof error>[0],
  id: string,
) {
  const salon = await getAdminSalon(id)
  if (salon) return null
  return error(c, 'سالن یافت نشد', 404)
}

async function requireSetupSalon(
  c: Parameters<typeof error>[0],
  id: string,
  override = false,
  role?: PlatformRole,
) {
  const result = await getAdminSalon(id)
  if (!result) return error(c, 'سالن یافت نشد', 404)
  if (result.salon.status === 'setup' && !override) return null
  if (
    result.salon.status === 'active' &&
    override &&
    role === 'platform_owner'
  ) {
    return null
  }
  if (override && role !== 'platform_owner') {
    return error(c, 'فقط مالک فعال پلتفرم می‌تواند وارد حالت Override شود', 403)
  }
  if (override) {
    return error(c, 'Override فقط برای سالن فعال ممکن است', 409)
  }
  if (result.salon.status !== 'setup') {
    return error(
      c,
      'ویرایش راه‌اندازی فقط برای سالن در وضعیت راه‌اندازی ممکن است',
      409,
    )
  }
  return null
}

function setupAction(action: string, override: boolean | undefined) {
  return override ? action.replace('salon.setup.', 'salon.override.') : action
}

function setupCatalogError(c: Parameters<typeof error>[0], err: unknown) {
  const message = err instanceof Error ? err.message : ''
  if (message.includes('not found or inactive')) {
    return error(c, 'قالب خدمات یافت نشد یا فعال نیست', 404)
  }
  if (message.includes('selection is empty')) {
    return error(c, 'حداقل یک خدمت از قالب انتخاب کنید', 400)
  }
  if (message.includes('collides with existing categories')) {
    return error(c, 'یکی از دسته‌های قالب قبلاً در سالن وجود دارد', 409)
  }
  if (message.includes('unique') || message.includes('duplicate')) {
    return error(c, 'رکوردی با این نام قبلاً در کاتالوگ وجود دارد', 409)
  }
  if (message.includes('must be non-negative')) {
    return error(c, 'قیمت و زمان نمی‌توانند منفی باشند', 400)
  }
  if (message.includes('must be positive')) {
    return error(c, 'قیمت یا زمان افزوده باید بیشتر از صفر باشد', 400)
  }
  if (message.includes('scope not found') || message.includes('not found')) {
    return error(c, 'مرجع انتخاب‌شده در کاتالوگ یافت نشد', 400)
  }
  if (err instanceof CatalogReferenceError) {
    return error(c, 'دسته یا گروه انتخاب‌شده معتبر نیست', 400)
  }
  return null
}

async function previewSetupClientImport(
  salonId: string,
  input: z.infer<typeof setupClientImportSourceSchema>,
) {
  const drafts =
    input.format === 'csv'
      ? parseClientCsv(input.source)
      : parseVcfFile(input.source, (index) => `vcf-${index + 1}`)
  const clients = await getAllClients(salonId)
  return buildClientImportPreview(
    drafts,
    new Set(clients.flatMap((client) => (client.phone ? [client.phone] : []))),
  )
}

export const adminRoute = new Hono<AppEnv>()
  .use('*', requirePlatformAdmin('view_admin'))
  .get('/auth/me', async (c) => {
    const me = await getPlatformAdminMe(c.var.platformAdmin.userId)
    if (!me) return error(c, 'دسترسی غیرمجاز', 403)
    return ok(c, { user: me, runtime: runtime() })
  })
  .get('/runtime', async (c) => {
    return ok(c, runtime())
  })
  .get('/overview', async (c) => ok(c, await getAdminOverview()))
  .get(
    '/salons',
    requirePlatformAdmin('view_salons'),
    zValidator('query', listQuerySchema),
    async (c) => ok(c, await listAdminSalons(c.req.valid('query'))),
  )
  .post(
    '/salons',
    requirePlatformAdmin('manage_salons'),
    zValidator('json', setupSalonBodySchema),
    async (c) => {
      const body = c.req.valid('json')

      const salon = await createSetupSalon({
        name: body.name,
        intendedOwnerPhone: body.intendedOwnerPhone,
      })
      const ownerConflict = await getSalonIdentityConflictForPhone({
        phone: body.intendedOwnerPhone,
        excludingSalonId: salon.id,
      })
      await writeAudit({
        actorUserId: c.var.platformAdmin.userId,
        actorPlatformRole: c.var.platformAdmin.role,
        action: 'salon.setup.create',
        targetType: 'salon',
        targetId: salon.id,
        salonId: salon.id,
        metadata: { intendedOwnerPhone: '[REDACTED]' },
        request: auditMeta(c),
      })
      return created(c, { salon, ownerConflict: ownerConflict ?? null })
    },
  )
  .get(
    '/salons/:id',
    requirePlatformAdmin('view_salons'),
    zValidator('param', idParamSchema),
    async (c) => {
      const result = await getAdminSalon(c.req.valid('param').id)
      if (!result) return error(c, 'سالن یافت نشد', 404)
      return ok(c, result)
    },
  )
  .get(
    '/salons/:id/setup',
    requirePlatformAdmin('manage_salons'),
    zValidator('param', idParamSchema),
    zValidator('query', setupAccessQuerySchema),
    async (c) => {
      const { id } = c.req.valid('param')
      const { override } = c.req.valid('query')
      const lifecycleError = await requireSetupSalon(
        c,
        id,
        override,
        c.var.platformAdmin.role,
      )
      if (lifecycleError) return lifecycleError
      const [hours, presence] = await Promise.all([
        getBusinessSettings(id),
        getSalonPresence(id),
      ])
      return ok(c, { hours, presence })
    },
  )
  .patch(
    '/salons/:id/setup/owner-phone',
    requirePlatformAdmin('manage_salons'),
    zValidator('param', idParamSchema),
    zValidator('json', setupOwnerPhoneBodySchema),
    async (c) => {
      const { id } = c.req.valid('param')
      const body = c.req.valid('json')
      const lifecycleError = await requireSetupSalon(c, id)
      if (lifecycleError) return lifecycleError
      const salon = await updateSetupSalonOwnerPhone({
        salonId: id,
        intendedOwnerPhone: body.intendedOwnerPhone,
      })
      if (!salon) return error(c, 'سالن در وضعیت راه‌اندازی نیست', 409)
      await writeAudit({
        actorUserId: c.var.platformAdmin.userId,
        actorPlatformRole: c.var.platformAdmin.role,
        action: 'salon.setup.owner_phone.update',
        targetType: 'salon',
        targetId: id,
        salonId: id,
        metadata: { intendedOwnerPhone: '[REDACTED]' },
        request: auditMeta(c),
      })
      return ok(c, { salon })
    },
  )
  .post(
    '/salons/:id/setup/handoff',
    requirePlatformAdmin('manage_salons'),
    zValidator('param', idParamSchema),
    zValidator('json', setupHandoffBodySchema),
    async (c) => {
      const { id } = c.req.valid('param')
      const body = c.req.valid('json')
      const lifecycleError = await requireSetupSalon(c, id)
      if (lifecycleError) return lifecycleError
      const salon = await getAdminSalon(id)
      const intendedOwnerPhone = salon?.salon.intendedOwnerPhone
      if (!intendedOwnerPhone) {
        return error(c, 'شماره مالک موردنظر ثبت نشده است', 409)
      }
      const ownerConflict = await getSalonIdentityConflictForPhone({
        phone: intendedOwnerPhone,
        excludingSalonId: id,
      })
      if (ownerConflict) {
        return error(
          c,
          `این شماره قبلاً به سالن «${ownerConflict.salonName}» با وضعیت ${ownerConflict.salonStatus} متصل است`,
          409,
          'HANDOFF_IDENTITY_CONFLICT',
        )
      }
      const handoff = await createSalonHandoff({
        salonId: id,
        createdByUserId: c.var.platformAdmin.userId,
        enablePublicPage: body.enablePublicPage,
      })
      const baseUrl = (
        process.env.PWA_ORIGIN ?? 'http://localhost:3000'
      ).replace(/\/$/, '')
      const url = `${baseUrl}/handoff/${handoff.token}`
      await writeAudit({
        actorUserId: c.var.platformAdmin.userId,
        actorPlatformRole: c.var.platformAdmin.role,
        action: 'salon.setup.handoff_link.create',
        targetType: 'salon',
        targetId: id,
        salonId: id,
        metadata: {
          expiresAt: handoff.expiresAt.toISOString(),
          enablePublicPage: body.enablePublicPage,
        },
        request: auditMeta(c),
      })
      return ok(c, { url, expiresAt: handoff.expiresAt })
    },
  )
  .patch(
    '/salons/:id/setup/hours',
    requirePlatformAdmin('manage_salons'),
    zValidator('param', idParamSchema),
    zValidator('json', setupHoursBodySchema),
    async (c) => {
      const { id } = c.req.valid('param')
      const body = c.req.valid('json')
      const lifecycleError = await requireSetupSalon(
        c,
        id,
        body.override,
        c.var.platformAdmin.role,
      )
      if (lifecycleError) return lifecycleError
      const hours = await updateBusinessSettings(id, {
        ...(body.workingStart !== undefined
          ? { workingStart: body.workingStart }
          : {}),
        ...(body.workingEnd !== undefined
          ? { workingEnd: body.workingEnd }
          : {}),
        ...(body.slotDurationMinutes !== undefined
          ? { slotDurationMinutes: body.slotDurationMinutes }
          : {}),
        ...(body.workingDays !== undefined
          ? { workingDays: body.workingDays }
          : {}),
      })
      await writeAudit({
        actorUserId: c.var.platformAdmin.userId,
        actorPlatformRole: c.var.platformAdmin.role,
        action: setupAction('salon.setup.hours.update', body.override),
        targetType: 'salon',
        targetId: id,
        salonId: id,
        metadata: {
          fields: [
            ...(body.workingStart !== undefined ? ['workingStart'] : []),
            ...(body.workingEnd !== undefined ? ['workingEnd'] : []),
            ...(body.slotDurationMinutes !== undefined
              ? ['slotDurationMinutes']
              : []),
            ...(body.workingDays !== undefined ? ['workingDays'] : []),
          ],
        },
        request: auditMeta(c),
      })
      return ok(c, { hours })
    },
  )
  .patch(
    '/salons/:id/setup/presence',
    requirePlatformAdmin('manage_salons'),
    zValidator('param', idParamSchema),
    zValidator('json', setupPresenceBodySchema),
    async (c) => {
      const { id } = c.req.valid('param')
      const body = c.req.valid('json')
      const lifecycleError = await requireSetupSalon(
        c,
        id,
        body.override,
        c.var.platformAdmin.role,
      )
      if (lifecycleError) return lifecycleError
      const { override, ...payload } = body
      const presence = await updateSalonPresence(id, payload)
      await writeAudit({
        actorUserId: c.var.platformAdmin.userId,
        actorPlatformRole: c.var.platformAdmin.role,
        action: setupAction('salon.setup.presence.update', override),
        targetType: 'salon',
        targetId: id,
        salonId: id,
        metadata: { fields: Object.keys(payload) },
        request: auditMeta(c),
      })
      return ok(c, { presence })
    },
  )
  .get(
    '/salons/:id/setup/staff/access',
    requirePlatformAdmin('manage_salons'),
    zValidator('param', idParamSchema),
    zValidator('query', setupStaffAccessQuerySchema),
    async (c) => {
      const { id } = c.req.valid('param')
      const { override } = c.req.valid('query')
      const lifecycleError = await requireSetupSalon(
        c,
        id,
        override,
        c.var.platformAdmin.role,
      )
      if (lifecycleError) return lifecycleError
      const access = await getClaimedStaffAccessForPhone({
        phone: c.req.valid('query').phone,
        excludingSalonId: id,
      })
      return ok(c, { access })
    },
  )
  .post(
    '/salons/:id/setup/clients',
    requirePlatformAdmin('manage_salons'),
    zValidator('param', idParamSchema),
    zValidator('json', setupClientCreateBodySchema),
    async (c) => {
      const { id } = c.req.valid('param')
      const body = c.req.valid('json')
      const lifecycleError = await requireSetupSalon(
        c,
        id,
        body.override,
        c.var.platformAdmin.role,
      )
      if (lifecycleError) return lifecycleError
      try {
        const client = await createClient({
          salonId: id,
          name: body.name,
          phone: body.phone,
          notes: body.notes,
        })
        const tags = await setClientTags(client.id, id, body.tags)
        await writeAudit({
          actorUserId: c.var.platformAdmin.userId,
          actorPlatformRole: c.var.platformAdmin.role,
          action: setupAction('salon.setup.client.create', body.override),
          targetType: 'client',
          targetId: client.id,
          salonId: id,
          metadata: { personalData: '[REDACTED]' },
          request: auditMeta(c),
        })
        return created(c, { client: { ...client, tags } })
      } catch (err) {
        if (isDuplicatePhoneError(err)) {
          return error(c, 'این شماره تماس برای این سالن قبلاً ثبت شده است', 409)
        }
        throw err
      }
    },
  )
  .post(
    '/salons/:id/setup/clients/import/preview',
    requirePlatformAdmin('manage_salons'),
    zValidator('param', idParamSchema),
    zValidator('json', setupClientImportSourceSchema),
    async (c) => {
      const { id } = c.req.valid('param')
      const body = c.req.valid('json')
      const lifecycleError = await requireSetupSalon(
        c,
        id,
        body.override,
        c.var.platformAdmin.role,
      )
      if (lifecycleError) return lifecycleError
      const preview = await previewSetupClientImport(id, body)
      if (preview.counts.totalInFile === 0) {
        return error(c, 'هیچ ردیف مشتری در فایل پیدا نشد', 400)
      }
      return ok(c, preview)
    },
  )
  .post(
    '/salons/:id/setup/clients/import',
    requirePlatformAdmin('manage_salons'),
    zValidator('param', idParamSchema),
    zValidator('json', setupClientImportBodySchema),
    async (c) => {
      const { id } = c.req.valid('param')
      const body = c.req.valid('json')
      const lifecycleError = await requireSetupSalon(
        c,
        id,
        body.override,
        c.var.platformAdmin.role,
      )
      if (lifecycleError) return lifecycleError
      const preview = await previewSetupClientImport(id, body)
      const selectedIds = new Set(body.selectedLocalIds)
      const selectedRows = preview.rows.filter((row) =>
        selectedIds.has(row.localId),
      )
      if (selectedRows.length === 0) {
        return error(c, 'حداقل یک ردیف معتبر را برای ورود انتخاب کنید', 400)
      }
      const result = await createClientsBulk(
        id,
        selectedRows.map(({ name, phone }) => ({ name, phone })),
      )
      const duplicateCount =
        preview.counts.duplicateExisting +
        preview.counts.duplicateInFile +
        result.skipped.filter((row) => row.reason === 'duplicate-phone').length
      await writeAudit({
        actorUserId: c.var.platformAdmin.userId,
        actorPlatformRole: c.var.platformAdmin.role,
        action: setupAction('salon.setup.client_import.create', body.override),
        targetType: 'salon',
        targetId: id,
        salonId: id,
        metadata: {
          format: body.format,
          imported: result.created.length,
          skipped: preview.counts.totalInFile - result.created.length,
          duplicate: duplicateCount,
          invalid: preview.counts.invalid,
        },
        request: auditMeta(c),
      })
      return ok(c, {
        imported: result.created.length,
        skipped: preview.counts.totalInFile - result.created.length,
        duplicate: duplicateCount,
        invalid: preview.counts.invalid,
      })
    },
  )
  .get(
    '/salons/:id/setup/staff',
    requirePlatformAdmin('manage_salons'),
    zValidator('param', idParamSchema),
    zValidator('query', setupAccessQuerySchema),
    async (c) => {
      const { id } = c.req.valid('param')
      const { override } = c.req.valid('query')
      const lifecycleError = await requireSetupSalon(
        c,
        id,
        override,
        c.var.platformAdmin.role,
      )
      if (lifecycleError) return lifecycleError
      return ok(c, { staff: await listSetupStaffProfiles(id) })
    },
  )
  .post(
    '/salons/:id/setup/staff',
    requirePlatformAdmin('manage_salons'),
    zValidator('param', idParamSchema),
    zValidator('json', setupStaffCreateBodySchema),
    async (c) => {
      const { id } = c.req.valid('param')
      const body = c.req.valid('json')
      const lifecycleError = await requireSetupSalon(
        c,
        id,
        body.override,
        c.var.platformAdmin.role,
      )
      if (lifecycleError) return lifecycleError
      if (
        new Set(body.schedule.map((row) => row.dayOfWeek)).size !==
        body.schedule.length
      ) {
        return error(c, 'برای هر روز فقط یک برنامه ثبت کنید', 400)
      }
      if (
        body.schedule.some(
          (row) => row.active && row.workingStart >= row.workingEnd,
        )
      ) {
        return error(c, 'ساعت پایان باید بعد از ساعت شروع باشد', 400)
      }
      if (
        body.serviceIds &&
        !(await validateActiveServiceIds(body.serviceIds, id))
      ) {
        return error(c, 'یکی از خدمات انتخاب‌شده معتبر یا فعال نیست', 400)
      }
      try {
        const profile = await createSetupStaffProfile({
          salonId: id,
          name: body.name,
          phone: body.phone,
          color: normalizeCalendarColorId(body.color),
          active: body.active,
          schedule: body.schedule,
          serviceIds: body.serviceIds,
        })
        await writeAudit({
          actorUserId: c.var.platformAdmin.userId,
          actorPlatformRole: c.var.platformAdmin.role,
          action: setupAction(
            'salon.setup.staff_profile.create',
            body.override,
          ),
          targetType: 'staff_profile',
          targetId: profile.id,
          salonId: id,
          metadata: {
            phone: '[REDACTED]',
            serviceCount: body.serviceIds?.length ?? 0,
            scheduleDays: body.schedule.length,
          },
          request: auditMeta(c),
        })
        return created(c, { profile })
      } catch (err) {
        const message = err instanceof Error ? err.message.toLowerCase() : ''
        if (message.includes('unique') || message.includes('duplicate')) {
          return error(
            c,
            'برای این شماره قبلاً پروفایل پرسنل ساخته شده است',
            409,
          )
        }
        throw err
      }
    },
  )
  .get(
    '/salons/:id/setup/catalog',
    requirePlatformAdmin('manage_salons'),
    zValidator('param', idParamSchema),
    zValidator('query', setupAccessQuerySchema),
    async (c) => {
      const { id } = c.req.valid('param')
      const { override } = c.req.valid('query')
      const lifecycleError = await requireSetupSalon(
        c,
        id,
        override,
        c.var.platformAdmin.role,
      )
      if (lifecycleError) return lifecycleError
      const [categories, services, addons, presets] = await Promise.all([
        getAllServiceCategories(id, true),
        getAllServices(id, true),
        getAllServiceAddons(id, true),
        listActiveCatalogPresets(id),
      ])
      return ok(c, { categories, services, addons, presets })
    },
  )
  .post(
    '/salons/:id/setup/catalog/presets/:presetId/apply',
    requirePlatformAdmin('manage_salons'),
    zValidator('param', setupCatalogPresetParamSchema),
    zValidator('json', setupCatalogPresetBodySchema),
    async (c) => {
      const { id, presetId } = c.req.valid('param')
      const body = c.req.valid('json')
      const lifecycleError = await requireSetupSalon(
        c,
        id,
        body.override,
        c.var.platformAdmin.role,
      )
      if (lifecycleError) return lifecycleError
      try {
        const result = await applyCatalogPreset({
          salonId: id,
          presetId,
          selection: body.selection,
        })
        await writeAudit({
          actorUserId: c.var.platformAdmin.userId,
          actorPlatformRole: c.var.platformAdmin.role,
          action: setupAction(
            'salon.setup.catalog_preset.apply',
            body.override,
          ),
          targetType: 'catalog_preset',
          targetId: presetId,
          salonId: id,
          metadata: result,
          request: auditMeta(c),
        })
        return ok(c, result)
      } catch (err) {
        const mapped = setupCatalogError(c, err)
        if (mapped) return mapped
        throw err
      }
    },
  )
  .post(
    '/salons/:id/setup/catalog/categories',
    requirePlatformAdmin('manage_salons'),
    zValidator('param', idParamSchema),
    zValidator('json', setupCategoryCreateBodySchema),
    async (c) => {
      const { id } = c.req.valid('param')
      const body = c.req.valid('json')
      const lifecycleError = await requireSetupSalon(
        c,
        id,
        body.override,
        c.var.platformAdmin.role,
      )
      if (lifecycleError) return lifecycleError
      try {
        const category = await createServiceCategory({
          salonId: id,
          name: body.name,
          active: body.active,
        })
        await writeAudit({
          actorUserId: c.var.platformAdmin.userId,
          actorPlatformRole: c.var.platformAdmin.role,
          action: setupAction(
            'salon.setup.catalog_category.create',
            body.override,
          ),
          targetType: 'service_category',
          targetId: category.id,
          salonId: id,
          metadata: { fields: ['name', 'active'] },
          request: auditMeta(c),
        })
        return created(c, { category })
      } catch (err) {
        const mapped = setupCatalogError(c, err)
        if (mapped) return mapped
        throw err
      }
    },
  )
  .patch(
    '/salons/:id/setup/catalog/categories/:entityId',
    requirePlatformAdmin('manage_salons'),
    zValidator('param', setupCatalogEntityParamSchema),
    zValidator('json', setupCategoryUpdateBodySchema),
    async (c) => {
      const { id, entityId } = c.req.valid('param')
      const body = c.req.valid('json')
      const lifecycleError = await requireSetupSalon(
        c,
        id,
        body.override,
        c.var.platformAdmin.role,
      )
      if (lifecycleError) return lifecycleError
      const { override, ...patch } = body
      try {
        const category = await updateServiceCategory(entityId, id, patch)
        if (!category) return error(c, 'دسته خدمات یافت نشد', 404)
        await writeAudit({
          actorUserId: c.var.platformAdmin.userId,
          actorPlatformRole: c.var.platformAdmin.role,
          action: setupAction('salon.setup.catalog_category.update', override),
          targetType: 'service_category',
          targetId: entityId,
          salonId: id,
          metadata: { fields: Object.keys(patch) },
          request: auditMeta(c),
        })
        return ok(c, { category })
      } catch (err) {
        const mapped = setupCatalogError(c, err)
        if (mapped) return mapped
        throw err
      }
    },
  )
  .post(
    '/salons/:id/setup/catalog/services',
    requirePlatformAdmin('manage_salons'),
    zValidator('param', idParamSchema),
    zValidator('json', setupServiceCreateBodySchema),
    async (c) => {
      const { id } = c.req.valid('param')
      const body = c.req.valid('json')
      const lifecycleError = await requireSetupSalon(
        c,
        id,
        body.override,
        c.var.platformAdmin.role,
      )
      if (lifecycleError) return lifecycleError
      try {
        const service = await createService({
          salonId: id,
          name: body.name,
          categoryId: body.categoryId,
          duration: body.duration,
          price: body.price,
          color: body.color,
          active: body.active,
          description: body.description,
        })
        await writeAudit({
          actorUserId: c.var.platformAdmin.userId,
          actorPlatformRole: c.var.platformAdmin.role,
          action: setupAction(
            'salon.setup.service_variant.create',
            body.override,
          ),
          targetType: 'service',
          targetId: service.id,
          salonId: id,
          metadata: {
            fields: [
              'name',
              'categoryId',
              'duration',
              'price',
              'color',
              'active',
              'description',
            ],
          },
          request: auditMeta(c),
        })
        return created(c, { service })
      } catch (err) {
        const mapped = setupCatalogError(c, err)
        if (mapped) return mapped
        throw err
      }
    },
  )
  .patch(
    '/salons/:id/setup/catalog/services/:entityId',
    requirePlatformAdmin('manage_salons'),
    zValidator('param', setupCatalogEntityParamSchema),
    zValidator('json', setupServiceUpdateBodySchema),
    async (c) => {
      const { id, entityId } = c.req.valid('param')
      const body = c.req.valid('json')
      const lifecycleError = await requireSetupSalon(
        c,
        id,
        body.override,
        c.var.platformAdmin.role,
      )
      if (lifecycleError) return lifecycleError
      const { override, ...input } = body
      const patch: Partial<Service> = { ...input }
      try {
        const service = await updateService(entityId, id, patch)
        if (!service) return error(c, 'خدمت یافت نشد', 404)
        await writeAudit({
          actorUserId: c.var.platformAdmin.userId,
          actorPlatformRole: c.var.platformAdmin.role,
          action: setupAction('salon.setup.service_variant.update', override),
          targetType: 'service',
          targetId: entityId,
          salonId: id,
          metadata: { fields: Object.keys(patch) },
          request: auditMeta(c),
        })
        return ok(c, { service })
      } catch (err) {
        const mapped = setupCatalogError(c, err)
        if (mapped) return mapped
        throw err
      }
    },
  )
  .post(
    '/salons/:id/setup/catalog/addons',
    requirePlatformAdmin('manage_salons'),
    zValidator('param', idParamSchema),
    zValidator('json', setupAddonCreateBodySchema),
    async (c) => {
      const { id } = c.req.valid('param')
      const body = c.req.valid('json')
      const lifecycleError = await requireSetupSalon(
        c,
        id,
        body.override,
        c.var.platformAdmin.role,
      )
      if (lifecycleError) return lifecycleError
      const { override, id: _clientId, ...input } = body
      try {
        const addon = await createServiceAddon({ ...input, salonId: id })
        await writeAudit({
          actorUserId: c.var.platformAdmin.userId,
          actorPlatformRole: c.var.platformAdmin.role,
          action: setupAction('salon.setup.service_addon.create', override),
          targetType: 'service_addon',
          targetId: addon.id,
          salonId: id,
          metadata: { fields: Object.keys(input) },
          request: auditMeta(c),
        })
        return created(c, { addon })
      } catch (err) {
        const mapped = setupCatalogError(c, err)
        if (mapped) return mapped
        throw err
      }
    },
  )
  .patch(
    '/salons/:id/setup/catalog/addons/:entityId',
    requirePlatformAdmin('manage_salons'),
    zValidator('param', setupCatalogEntityParamSchema),
    zValidator('json', setupAddonUpdateBodySchema),
    async (c) => {
      const { id, entityId } = c.req.valid('param')
      const body = c.req.valid('json')
      const lifecycleError = await requireSetupSalon(
        c,
        id,
        body.override,
        c.var.platformAdmin.role,
      )
      if (lifecycleError) return lifecycleError
      const { override, ...patch } = body
      try {
        const addon = await updateServiceAddon(entityId, id, patch)
        if (!addon) return error(c, 'افزودنی یافت نشد', 404)
        await writeAudit({
          actorUserId: c.var.platformAdmin.userId,
          actorPlatformRole: c.var.platformAdmin.role,
          action: setupAction('salon.setup.service_addon.update', override),
          targetType: 'service_addon',
          targetId: entityId,
          salonId: id,
          metadata: { fields: Object.keys(patch) },
          request: auditMeta(c),
        })
        return ok(c, { addon })
      } catch (err) {
        const mapped = setupCatalogError(c, err)
        if (mapped) return mapped
        throw err
      }
    },
  )
  .get(
    '/salons/:id/clients',
    requirePlatformAdmin('view_salons'),
    zValidator('param', idParamSchema),
    zValidator('query', listQuerySchema),
    async (c) => {
      const { id } = c.req.valid('param')
      const missingSalon = await requireExistingSalon(c, id)
      if (missingSalon) return missingSalon
      return ok(c, await listAdminSalonClients(id, c.req.valid('query')))
    },
  )
  .get(
    '/salons/:id/appointments',
    requirePlatformAdmin('view_salons'),
    zValidator('param', idParamSchema),
    zValidator('query', listQuerySchema),
    async (c) => {
      const { id } = c.req.valid('param')
      const missingSalon = await requireExistingSalon(c, id)
      if (missingSalon) return missingSalon
      return ok(c, await listAdminSalonAppointments(id, c.req.valid('query')))
    },
  )
  .get(
    '/salons/:id/appointment-requests',
    requirePlatformAdmin('view_salons'),
    zValidator('param', idParamSchema),
    zValidator('query', listQuerySchema),
    async (c) => {
      const { id } = c.req.valid('param')
      const missingSalon = await requireExistingSalon(c, id)
      if (missingSalon) return missingSalon
      return ok(
        c,
        await listAdminSalonAppointmentRequests(id, c.req.valid('query')),
      )
    },
  )
  .get(
    '/salons/:id/staff',
    requirePlatformAdmin('view_salons'),
    zValidator('param', idParamSchema),
    zValidator('query', listQuerySchema),
    async (c) => {
      const { id } = c.req.valid('param')
      const missingSalon = await requireExistingSalon(c, id)
      if (missingSalon) return missingSalon
      return ok(c, await listAdminSalonStaff(id, c.req.valid('query')))
    },
  )
  .get(
    '/salons/:id/services',
    requirePlatformAdmin('view_salons'),
    zValidator('param', idParamSchema),
    zValidator('query', listQuerySchema),
    async (c) => {
      const { id } = c.req.valid('param')
      const missingSalon = await requireExistingSalon(c, id)
      if (missingSalon) return missingSalon
      return ok(c, await listAdminSalonServices(id, c.req.valid('query')))
    },
  )
  .patch(
    '/salons/:id/status',
    requirePlatformAdmin('manage_salons'),
    zValidator('param', idParamSchema),
    zValidator('json', statusBodySchema),
    async (c) => {
      const { id } = c.req.valid('param')
      const body = c.req.valid('json')
      const existing = await getAdminSalon(id)
      if (!existing) return error(c, 'سالن یافت نشد', 404)
      if (existing.salon.status === 'setup') {
        return error(
          c,
          'فعال‌سازی سالن راه‌اندازی فقط از مسیر تحویل به مالک ممکن است',
          409,
        )
      }
      const updated = await updateAdminSalonStatus({
        salonId: id,
        status: body.status,
      })
      if (!updated) return error(c, 'سالن یافت نشد', 404)
      await writeAudit({
        actorUserId: c.var.platformAdmin.userId,
        actorPlatformRole: c.var.platformAdmin.role,
        action: 'salon.status.update',
        targetType: 'salon',
        targetId: id,
        salonId: id,
        metadata: { status: body.status },
        request: auditMeta(c),
      })
      return ok(c, { salon: updated })
    },
  )
  .get(
    '/salons/:id/notes',
    requirePlatformAdmin('view_salons'),
    zValidator('param', idParamSchema),
    async (c) => {
      const { id } = c.req.valid('param')
      const missingSalon = await requireExistingSalon(c, id)
      if (missingSalon) return missingSalon
      return ok(c, {
        notes: await listAdminInternalNotes({
          subjectType: 'salon',
          subjectId: id,
        }),
      })
    },
  )
  .post(
    '/salons/:id/notes',
    requirePlatformAdmin('write_internal_notes'),
    zValidator('param', idParamSchema),
    zValidator('json', noteBodySchema),
    async (c) => {
      const { id } = c.req.valid('param')
      const body = c.req.valid('json')
      const missingSalon = await requireExistingSalon(c, id)
      if (missingSalon) return missingSalon
      const note = await createAdminInternalNote({
        subjectType: 'salon',
        subjectId: id,
        body: body.body,
        authorUserId: c.var.platformAdmin.userId,
      })
      await writeAudit({
        actorUserId: c.var.platformAdmin.userId,
        actorPlatformRole: c.var.platformAdmin.role,
        action: 'salon.note.create',
        targetType: 'salon',
        targetId: id,
        salonId: id,
        metadata: { noteId: note.id },
        request: auditMeta(c),
      })
      return created(c, { note })
    },
  )
  .get(
    '/users',
    requirePlatformAdmin('view_users'),
    zValidator('query', listQuerySchema),
    async (c) => ok(c, await listAdminUsers(c.req.valid('query'))),
  )
  .get(
    '/users/:id',
    requirePlatformAdmin('view_users'),
    zValidator('param', idParamSchema),
    async (c) => {
      const result = await getAdminUser(c.req.valid('param').id)
      if (!result) return error(c, 'کاربر یافت نشد', 404)
      return ok(c, result)
    },
  )
  .get(
    '/users/:id/notes',
    requirePlatformAdmin('view_users'),
    zValidator('param', idParamSchema),
    async (c) => {
      const { id } = c.req.valid('param')
      return ok(c, {
        notes: await listAdminInternalNotes({
          subjectType: 'user',
          subjectId: id,
        }),
      })
    },
  )
  .post(
    '/users/:id/notes',
    requirePlatformAdmin('write_internal_notes'),
    zValidator('param', idParamSchema),
    zValidator('json', noteBodySchema),
    async (c) => {
      const { id } = c.req.valid('param')
      const body = c.req.valid('json')
      const note = await createAdminInternalNote({
        subjectType: 'user',
        subjectId: id,
        body: body.body,
        authorUserId: c.var.platformAdmin.userId,
      })
      await writeAudit({
        actorUserId: c.var.platformAdmin.userId,
        actorPlatformRole: c.var.platformAdmin.role,
        action: 'user.note.create',
        targetType: 'user',
        targetId: id,
        metadata: { noteId: note.id },
        request: auditMeta(c),
      })
      return created(c, { note })
    },
  )
  .get(
    '/catalog-presets',
    requirePlatformAdmin('manage_catalog_presets'),
    zValidator('query', listQuerySchema),
    async (c) => ok(c, await listAdminCatalogPresets(c.req.valid('query'))),
  )
  .post(
    '/catalog-presets',
    requirePlatformAdmin('manage_catalog_presets'),
    zValidator('json', catalogPresetCreateSchema),
    async (c) => {
      const body = c.req.valid('json')
      const preset = await createAdminCatalogPreset(body)
      await writeAudit({
        actorUserId: c.var.platformAdmin.userId,
        actorPlatformRole: c.var.platformAdmin.role,
        action: 'catalog_preset.create',
        targetType: 'catalog_preset',
        targetId: preset.id,
        metadata: { slug: preset.slug },
        request: auditMeta(c),
      })
      return created(c, { preset })
    },
  )
  .patch(
    '/catalog-presets/:id',
    requirePlatformAdmin('manage_catalog_presets'),
    zValidator('param', idParamSchema),
    zValidator('json', catalogPresetUpdateSchema),
    async (c) => {
      const { id } = c.req.valid('param')
      const body = c.req.valid('json')
      const preset = await updateAdminCatalogPreset({ id, ...body })
      if (!preset) return error(c, 'قالب یافت نشد', 404)
      await writeAudit({
        actorUserId: c.var.platformAdmin.userId,
        actorPlatformRole: c.var.platformAdmin.role,
        action: 'catalog_preset.update',
        targetType: 'catalog_preset',
        targetId: id,
        metadata: { slug: preset.slug, isActive: preset.isActive },
        request: auditMeta(c),
      })
      return ok(c, { preset })
    },
  )
  .get(
    '/messaging/health',
    requirePlatformAdmin('view_messaging_health'),
    async (c) => ok(c, await getAdminMessagingHealth()),
  )
  .get(
    '/notifications/deliveries',
    requirePlatformAdmin('view_messaging_health'),
    zValidator('query', listQuerySchema),
    async (c) =>
      ok(c, await listAdminNotificationDeliveries(c.req.valid('query'))),
  )
  .get(
    '/support/appointments',
    requirePlatformAdmin('view_support_lookup'),
    zValidator('query', listQuerySchema),
    async (c) =>
      ok(c, await listAdminSupportAppointments(c.req.valid('query'))),
  )
  .get(
    '/support/appointment-requests',
    requirePlatformAdmin('view_support_lookup'),
    zValidator('query', listQuerySchema),
    async (c) =>
      ok(c, await listAdminSupportAppointmentRequests(c.req.valid('query'))),
  )
  .get(
    '/audit-log',
    requirePlatformAdmin('view_audit_log'),
    zValidator('query', auditQuerySchema),
    async (c) => ok(c, await listAdminAuditLog(c.req.valid('query'))),
  )
  .get(
    '/platform-admins',
    requirePlatformAdmin('manage_platform_admins'),
    zValidator('query', listQuerySchema),
    async (c) => ok(c, await listPlatformAdmins(c.req.valid('query'))),
  )
  .post(
    '/platform-admins',
    requirePlatformAdmin('manage_platform_admins'),
    zValidator('json', platformAdminCreateSchema),
    async (c) => {
      const body = c.req.valid('json')
      const admin = await upsertPlatformAdmin({
        userId: body.userId,
        role: body.role,
        active: body.active,
        actorUserId: c.var.platformAdmin.userId,
      })
      await writeAudit({
        actorUserId: c.var.platformAdmin.userId,
        actorPlatformRole: c.var.platformAdmin.role,
        action: 'platform_admin.upsert',
        targetType: 'platform_admin',
        targetId: admin.id,
        metadata: {
          userId: admin.userId,
          role: admin.role,
          active: admin.active,
        },
        request: auditMeta(c),
      })
      return created(c, { admin })
    },
  )
  .patch(
    '/platform-admins/:id',
    requirePlatformAdmin('manage_platform_admins'),
    zValidator('param', idParamSchema),
    zValidator('json', platformAdminUpdateSchema),
    async (c) => {
      const { id } = c.req.valid('param')
      const body = c.req.valid('json')
      const target = await getPlatformAdminById(id)
      if (!target) return error(c, 'ادمین پلتفرم یافت نشد', 404)
      const ownerCount = await countActivePlatformOwners()
      const wouldRemoveActiveOwner =
        target.active &&
        target.role === 'platform_owner' &&
        (body.active === false ||
          (body.role !== undefined && body.role !== 'platform_owner'))
      if (ownerCount <= 1 && wouldRemoveActiveOwner) {
        return error(c, 'آخرین مالک فعال پلتفرم قابل تغییر یا لغو نیست', 409)
      }
      const admin = await updatePlatformAdmin({
        id,
        role: body.role,
        active: body.active,
        actorUserId: c.var.platformAdmin.userId,
      })
      if (!admin) return error(c, 'ادمین پلتفرم یافت نشد', 404)
      await writeAudit({
        actorUserId: c.var.platformAdmin.userId,
        actorPlatformRole: c.var.platformAdmin.role,
        action: 'platform_admin.update',
        targetType: 'platform_admin',
        targetId: admin.id,
        metadata: {
          userId: admin.userId,
          role: admin.role,
          active: admin.active,
        },
        request: auditMeta(c),
      })
      return ok(c, { admin })
    },
  )
