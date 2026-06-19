import { Hono } from 'hono'
import { z } from 'zod'
import {
  countActivePlatformOwners,
  createAdminAuditEvent,
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
import { presetTreeSchema } from '@repo/salon-core/forms/catalog-preset'
import type { AppEnv } from '../factory'
import { getEnv } from '../env'
import { requirePlatformAdmin } from '../middleware/auth'
import { error, ok, created } from '../lib/responses'
import { zValidator } from '../lib/validate'

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

const reasonSchema = z.string().trim().min(3).max(500)

const statusBodySchema = z.object({
  status: z.enum(['active', 'suspended', 'archived']),
  reason: reasonSchema,
  liveConfirmation: z.string().trim().optional(),
})

const noteBodySchema = z.object({
  body: z.string().trim().min(1).max(5000),
  reason: reasonSchema,
})

const catalogPresetCreateSchema = z.object({
  slug: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  tree: presetTreeSchema,
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  reason: reasonSchema,
  liveConfirmation: z.string().trim().optional(),
})

const catalogPresetUpdateSchema = catalogPresetCreateSchema
  .partial()
  .extend({ reason: reasonSchema })

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
  reason: reasonSchema,
  liveConfirmation: z.string().trim().optional(),
})

const platformAdminUpdateSchema = z.object({
  role: platformRoleSchema.optional(),
  active: z.boolean().optional(),
  reason: reasonSchema,
  liveConfirmation: z.string().trim().optional(),
})

function runtime() {
  return { dataSource: getEnv().ADMIN_DATA_SOURCE }
}

function requireLiveConfirmation(
  c: Parameters<typeof error>[0],
  confirmation: string | undefined,
) {
  if (getEnv().ADMIN_DATA_SOURCE !== 'live') return null
  if (confirmation === 'LIVE') return null
  return error(c, 'برای تغییر داده زنده عبارت LIVE را وارد کنید', 400)
}

function auditMeta(c: {
  req: { header: (name: string) => string | undefined }
}) {
  return {
    ip:
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
      c.req.header('x-real-ip') ??
      null,
    userAgent: c.req.header('user-agent') ?? null,
    requestId: c.req.header('x-request-id') ?? null,
  }
}

async function writeAudit(input: {
  actorUserId: string
  actorPlatformRole: PlatformRole
  action: string
  targetType: string
  targetId: string
  reason: string
  salonId?: string | null
  metadata?: Record<string, unknown>
  request: ReturnType<typeof auditMeta>
}) {
  await createAdminAuditEvent({
    actorUserId: input.actorUserId,
    actorPlatformRole: input.actorPlatformRole,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    reason: input.reason,
    salonId: input.salonId ?? null,
    metadata: input.metadata,
    requestId: input.request.requestId,
    ip: input.request.ip,
    userAgent: input.request.userAgent,
  })
}

async function requireExistingSalon(
  c: Parameters<typeof error>[0],
  id: string,
) {
  const salon = await getAdminSalon(id)
  if (salon) return null
  return error(c, 'سالن یافت نشد', 404)
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
      const liveConfirmationError = requireLiveConfirmation(
        c,
        body.liveConfirmation,
      )
      if (liveConfirmationError) return liveConfirmationError
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
        reason: body.reason,
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
        reason: body.reason,
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
        reason: body.reason,
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
      const liveConfirmationError = requireLiveConfirmation(
        c,
        body.liveConfirmation,
      )
      if (liveConfirmationError) return liveConfirmationError
      const preset = await createAdminCatalogPreset(body)
      await writeAudit({
        actorUserId: c.var.platformAdmin.userId,
        actorPlatformRole: c.var.platformAdmin.role,
        action: 'catalog_preset.create',
        targetType: 'catalog_preset',
        targetId: preset.id,
        reason: body.reason,
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
      const liveConfirmationError = requireLiveConfirmation(
        c,
        body.liveConfirmation,
      )
      if (liveConfirmationError) return liveConfirmationError
      const preset = await updateAdminCatalogPreset({ id, ...body })
      if (!preset) return error(c, 'قالب یافت نشد', 404)
      await writeAudit({
        actorUserId: c.var.platformAdmin.userId,
        actorPlatformRole: c.var.platformAdmin.role,
        action: 'catalog_preset.update',
        targetType: 'catalog_preset',
        targetId: id,
        reason: body.reason,
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
      const liveConfirmationError = requireLiveConfirmation(
        c,
        body.liveConfirmation,
      )
      if (liveConfirmationError) return liveConfirmationError
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
        reason: body.reason,
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
      const liveConfirmationError = requireLiveConfirmation(
        c,
        body.liveConfirmation,
      )
      if (liveConfirmationError) return liveConfirmationError
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
        reason: body.reason,
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
