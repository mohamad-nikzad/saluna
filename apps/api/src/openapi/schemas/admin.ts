import { z } from '@hono/zod-openapi'

const isoDateTimeSchema = z.string().datetime().or(z.string())

export const platformRoleSchema = z
  .enum([
    'platform_owner',
    'platform_admin',
    'platform_support',
    'platform_viewer',
  ])
  .openapi('PlatformRole')

export const salonStatusSchema = z
  .enum(['active', 'suspended', 'archived'])
  .openapi('AdminSalonStatus')

export const adminListQuerySchema = z
  .object({
    page: z.coerce
      .number()
      .int()
      .positive()
      .optional()
      .openapi({
        param: { name: 'page', in: 'query' },
        example: 1,
      }),
    pageSize: z.coerce
      .number()
      .int()
      .positive()
      .max(100)
      .optional()
      .openapi({
        param: { name: 'pageSize', in: 'query' },
        example: 25,
      }),
    search: z
      .string()
      .optional()
      .openapi({
        param: { name: 'search', in: 'query' },
        example: 'saluna',
      }),
  })
  .openapi('AdminListQuery')

export const adminAuditQuerySchema = adminListQuerySchema
  .extend({
    action: z
      .string()
      .optional()
      .openapi({ param: { name: 'action', in: 'query' } }),
    targetType: z
      .string()
      .optional()
      .openapi({ param: { name: 'targetType', in: 'query' } }),
    targetId: z
      .string()
      .optional()
      .openapi({ param: { name: 'targetId', in: 'query' } }),
    salonId: z
      .string()
      .optional()
      .openapi({ param: { name: 'salonId', in: 'query' } }),
  })
  .openapi('AdminAuditQuery')

export const adminPaginationSchema = z
  .object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
  })
  .openapi('AdminPagination')

export const adminReasonSchema = z
  .string()
  .min(3)
  .max(500)
  .openapi({ example: 'درخواست پشتیبانی داخلی' })

const anyRecordSchema = z.record(z.string(), z.unknown())

export const adminUserMeResponseSchema = z
  .object({
    user: z
      .object({
        userId: z.string(),
        name: z.string(),
        email: z.string(),
        phoneNumber: z.string().nullable(),
        username: z.string().nullable(),
        role: platformRoleSchema,
        active: z.boolean(),
      })
      .passthrough(),
    runtime: z.object({
      dataSource: z.enum(['local', 'live']),
    }),
  })
  .openapi('AdminMeResponse')

export const adminRuntimeResponseSchema = z
  .object({
    dataSource: z.enum(['local', 'live']),
  })
  .openapi('AdminRuntimeResponse')

export const adminOverviewResponseSchema = z
  .object({
    salonsByStatus: z.object({
      active: z.number().int(),
      suspended: z.number().int(),
      archived: z.number().int(),
    }),
    failedDeliveries: z.number().int(),
    messagingAccounts: z.array(anyRecordSchema),
    recentAuditEvents: z.array(anyRecordSchema),
  })
  .openapi('AdminOverviewResponse')

const adminListResponse = (name: string) =>
  z
    .object({
      items: z.array(anyRecordSchema),
      pagination: adminPaginationSchema,
    })
    .openapi(name)

export const adminSalonsResponseSchema = adminListResponse(
  'AdminSalonsResponse',
)
export const adminSalonClientsResponseSchema = adminListResponse(
  'AdminSalonClientsResponse',
)
export const adminSalonAppointmentsResponseSchema = adminListResponse(
  'AdminSalonAppointmentsResponse',
)
export const adminSalonAppointmentRequestsResponseSchema = adminListResponse(
  'AdminSalonAppointmentRequestsResponse',
)
export const adminSalonStaffResponseSchema = adminListResponse(
  'AdminSalonStaffResponse',
)
export const adminSalonServicesResponseSchema = adminListResponse(
  'AdminSalonServicesResponse',
)
export const adminUsersResponseSchema = adminListResponse('AdminUsersResponse')
export const adminCatalogPresetsResponseSchema = adminListResponse(
  'AdminCatalogPresetsResponse',
)
export const adminNotificationDeliveriesResponseSchema = adminListResponse(
  'AdminNotificationDeliveriesResponse',
)
export const adminSupportAppointmentsResponseSchema = adminListResponse(
  'AdminSupportAppointmentsResponse',
)
export const adminSupportAppointmentRequestsResponseSchema = adminListResponse(
  'AdminSupportAppointmentRequestsResponse',
)
export const adminAuditLogResponseSchema = adminListResponse(
  'AdminAuditLogResponse',
)
export const adminPlatformAdminsResponseSchema = adminListResponse(
  'AdminPlatformAdminsResponse',
)

export const adminSalonDetailResponseSchema = z
  .object({
    salon: anyRecordSchema,
    members: z.array(anyRecordSchema),
    stats: anyRecordSchema,
  })
  .openapi('AdminSalonDetailResponse')

export const adminUserDetailResponseSchema = z
  .object({
    user: anyRecordSchema,
    memberships: z.array(anyRecordSchema),
    messagingAccounts: z.array(anyRecordSchema),
  })
  .openapi('AdminUserDetailResponse')

export const adminNotesResponseSchema = z
  .object({
    notes: z.array(
      z
        .object({
          id: z.string(),
          subjectType: z.enum(['salon', 'user']),
          subjectId: z.string(),
          body: z.string(),
          authorUserId: z.string(),
          authorName: z.string(),
          createdAt: isoDateTimeSchema,
        })
        .passthrough(),
    ),
  })
  .openapi('AdminNotesResponse')

export const adminStatusUpdateBodySchema = z
  .object({
    status: salonStatusSchema,
    reason: adminReasonSchema,
    liveConfirmation: z.string().optional(),
  })
  .openapi('AdminSalonStatusUpdateRequest')

export const adminNoteCreateBodySchema = z
  .object({
    body: z.string().min(1).max(5000),
    reason: adminReasonSchema,
  })
  .openapi('AdminNoteCreateRequest')

export const adminNoteResponseSchema = z
  .object({ note: anyRecordSchema })
  .openapi('AdminNoteResponse')

export const adminCatalogPresetBodySchema = z
  .object({
    slug: z.string().min(1).max(80),
    name: z.string().min(1).max(120),
    description: z.string().nullable().optional(),
    tree: z.array(anyRecordSchema).min(1),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
    reason: adminReasonSchema,
    liveConfirmation: z.string().optional(),
  })
  .openapi('AdminCatalogPresetCreateRequest')

export const adminCatalogPresetPatchBodySchema = adminCatalogPresetBodySchema
  .partial()
  .extend({ reason: adminReasonSchema })
  .openapi('AdminCatalogPresetUpdateRequest')

export const adminCatalogPresetResponseSchema = z
  .object({ preset: anyRecordSchema })
  .openapi('AdminCatalogPresetResponse')

export const adminMessagingHealthResponseSchema = z
  .object({
    accounts: z.array(anyRecordSchema),
    failedNotifications: z.array(anyRecordSchema),
    failedFollowUps: z.array(anyRecordSchema),
  })
  .openapi('AdminMessagingHealthResponse')

export const adminPlatformAdminCreateBodySchema = z
  .object({
    userId: z.string(),
    role: platformRoleSchema,
    active: z.boolean().optional(),
    reason: adminReasonSchema,
    liveConfirmation: z.string().optional(),
  })
  .openapi('AdminPlatformAdminCreateRequest')

export const adminPlatformAdminPatchBodySchema = z
  .object({
    role: platformRoleSchema.optional(),
    active: z.boolean().optional(),
    reason: adminReasonSchema,
    liveConfirmation: z.string().optional(),
  })
  .openapi('AdminPlatformAdminUpdateRequest')

export const adminPlatformAdminResponseSchema = z
  .object({ admin: anyRecordSchema })
  .openapi('AdminPlatformAdminResponse')
