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
  .enum(['setup', 'active', 'suspended', 'archived'])
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

export const adminSetupAccessQuerySchema = z.object({
  override: z
    .boolean()
    .optional()
    .openapi({
      param: { name: 'override', in: 'query' },
      description: 'Explicit Platform Owner Override for an active salon',
    }),
})

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
      setup: z.number().int(),
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
    overview: z
      .object({
        appointmentStatusCounts: anyRecordSchema,
        recentRequests: z.array(anyRecordSchema),
        upcomingAppointments: z.array(anyRecordSchema),
      })
      .passthrough(),
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
    status: z.enum(['active', 'suspended', 'archived']),
  })
  .openapi('AdminSalonStatusUpdateRequest')

export const adminSetupSalonCreateBodySchema = z
  .object({
    name: z.string().min(1).max(120),
    intendedOwnerPhone: z.string().regex(/^09\d{9}$/),
  })
  .openapi('AdminSetupSalonCreateRequest')

export const adminSetupSalonResponseSchema = z
  .object({
    salon: anyRecordSchema,
    ownerConflict: z
      .object({
        salonId: z.string(),
        salonName: z.string(),
        salonStatus: z.enum(['setup', 'active', 'suspended', 'archived']),
      })
      .nullable(),
  })
  .openapi('AdminSetupSalonResponse')

export const adminSetupOwnerPhonePatchBodySchema = z
  .object({
    intendedOwnerPhone: z.string().regex(/^09\d{9}$/),
  })
  .openapi('AdminSetupOwnerPhonePatchRequest')

export const adminSetupOwnerPhoneResponseSchema = z
  .object({
    salon: z.object({
      salonId: z.string(),
      intendedOwnerPhone: z.string().nullable(),
    }),
  })
  .openapi('AdminSetupOwnerPhoneResponse')

export const adminSetupHandoffCreateBodySchema = z
  .object({
    enablePublicPage: z.boolean().default(false),
  })
  .openapi('AdminSetupHandoffCreateRequest')

export const adminSetupHandoffResponseSchema = z
  .object({ url: z.string().url(), expiresAt: isoDateTimeSchema })
  .openapi('AdminSetupHandoffResponse')

export const adminSetupHoursSchema = z
  .object({
    workingStart: z.string(),
    workingEnd: z.string(),
    slotDurationMinutes: z.number().int(),
    workingDays: z.number().int().min(1).max(127),
  })
  .openapi('AdminSetupSalonHours')

export const adminSetupPresenceSchema = z
  .object({
    address: z.string().nullable(),
    mapGoogle: z.string().nullable(),
    mapNeshan: z.string().nullable(),
    mapBalad: z.string().nullable(),
    socialInstagram: z.string().nullable(),
    socialTelegram: z.string().nullable(),
    socialWhatsapp: z.string().nullable(),
    website: z.string().nullable(),
  })
  .openapi('AdminSetupSalonPresence')

export const adminSetupSalonConfigurationResponseSchema = z
  .object({ hours: adminSetupHoursSchema, presence: adminSetupPresenceSchema })
  .openapi('AdminSetupSalonConfigurationResponse')

const adminSetupStaffScheduleSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  active: z.boolean(),
  workingStart: z.string(),
  workingEnd: z.string(),
})

export const adminSetupStaffCreateBodySchema = z
  .object({
    name: z.string().min(1).max(120),
    phone: z.string().regex(/^09\d{9}$/),
    color: z.string(),
    active: z.boolean(),
    serviceIds: z.array(z.string()).nullable(),
    schedule: z.array(adminSetupStaffScheduleSchema).max(7),
    override: z.literal(true).optional(),
  })
  .openapi('AdminSetupStaffCreateRequest')

export const adminSetupStaffListResponseSchema = z
  .object({ staff: z.array(anyRecordSchema) })
  .openapi('AdminSetupStaffListResponse')

export const adminSetupStaffCreateResponseSchema = z
  .object({ profile: anyRecordSchema })
  .openapi('AdminSetupStaffCreateResponse')

export const adminSetupStaffAccessQuerySchema = z.object({
  phone: z.string().regex(/^09\d{9}$/),
  override: z.boolean().optional(),
})

export const adminSetupStaffAccessResponseSchema = z
  .object({
    access: z
      .object({
        salonId: z.string().uuid(),
        salonName: z.string(),
        salonStatus: z.enum(['setup', 'active', 'suspended', 'archived']),
      })
      .nullable(),
  })
  .openapi('AdminSetupStaffAccessResponse')

export const adminSetupClientCreateBodySchema = z
  .object({
    name: z.string().min(1),
    phone: z.string().regex(/^09\d{9}$/),
    notes: z.string().optional(),
    tags: z.array(z.string()).max(8).default([]),
    override: z.literal(true).optional(),
  })
  .openapi('AdminSetupClientCreateRequest')

export const adminSetupClientCreateResponseSchema = z
  .object({ client: anyRecordSchema })
  .openapi('AdminSetupClientCreateResponse')

export const adminSetupClientImportSourceSchema = z
  .object({
    format: z.enum(['csv', 'vcf']),
    source: z.string().min(1).max(2_000_000),
    override: z.literal(true).optional(),
  })
  .openapi('AdminSetupClientImportSource')

const adminSetupClientImportCountsSchema = z.object({
  totalInFile: z.number().int(),
  eligible: z.number().int(),
  invalid: z.number().int(),
  duplicateExisting: z.number().int(),
  duplicateInFile: z.number().int(),
  truncated: z.boolean(),
})

export const adminSetupClientImportPreviewResponseSchema = z
  .object({
    counts: adminSetupClientImportCountsSchema,
    rows: z.array(
      z.object({
        localId: z.string(),
        name: z.string(),
        phone: z.string(),
        selected: z.boolean(),
      }),
    ),
    skippedRows: z.array(
      z.object({
        localId: z.string(),
        name: z.string(),
        phone: z.string().nullable(),
        reason: z.enum(['invalid', 'duplicate-existing', 'duplicate-in-file']),
        invalidDetail: z
          .enum(['name', 'missing-phone', 'invalid-phone'])
          .optional(),
      }),
    ),
  })
  .openapi('AdminSetupClientImportPreviewResponse')

export const adminSetupClientImportBodySchema =
  adminSetupClientImportSourceSchema
    .extend({
      selectedLocalIds: z.array(z.string()).min(1).max(200),
    })
    .openapi('AdminSetupClientImportRequest')

export const adminSetupClientImportResponseSchema = z
  .object({
    imported: z.number().int(),
    skipped: z.number().int(),
    duplicate: z.number().int(),
    invalid: z.number().int(),
  })
  .openapi('AdminSetupClientImportResponse')

const adminSetupMutationMetaShape = {
  override: z.literal(true).optional(),
}

export const adminSetupHoursPatchBodySchema = adminSetupHoursSchema
  .partial()
  .extend(adminSetupMutationMetaShape)
  .openapi('AdminSetupSalonHoursPatchRequest')

export const adminSetupHoursResponseSchema = z
  .object({ hours: adminSetupHoursSchema })
  .openapi('AdminSetupSalonHoursResponse')

export const adminSetupPresencePatchBodySchema = adminSetupPresenceSchema
  .partial()
  .extend(adminSetupMutationMetaShape)
  .openapi('AdminSetupSalonPresencePatchRequest')

export const adminSetupPresenceResponseSchema = z
  .object({ presence: adminSetupPresenceSchema })
  .openapi('AdminSetupSalonPresenceResponse')

const adminSetupCatalogMutationMetaShape = {
  override: z.literal(true).optional(),
}

const adminSetupCatalogScopeSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('all') }),
  z.object({ type: z.literal('category'), categoryId: z.string() }),
  z.object({ type: z.literal('service'), serviceId: z.string() }),
])

export const adminSetupCatalogResponseSchema = z
  .object({
    categories: z.array(anyRecordSchema),
    services: z.array(anyRecordSchema),
    addons: z.array(anyRecordSchema),
    presets: z.array(anyRecordSchema),
  })
  .openapi('AdminSetupCatalogResponse')

export const adminSetupCatalogPresetApplyBodySchema = z
  .object({
    selection: z.array(
      z.object({
        categoryIndex: z.number().int().nonnegative(),
        serviceIndices: z.array(z.number().int().nonnegative()).min(1),
      }),
    ),
    ...adminSetupCatalogMutationMetaShape,
  })
  .openapi('AdminSetupCatalogPresetApplyRequest')

export const adminSetupCategoryCreateBodySchema = z
  .object({
    name: z.string(),
    active: z.boolean().optional(),
    ...adminSetupCatalogMutationMetaShape,
  })
  .openapi('AdminSetupCategoryCreateRequest')

export const adminSetupCategoryUpdateBodySchema = z
  .object({
    name: z.string().optional(),
    active: z.boolean().optional(),
    ...adminSetupCatalogMutationMetaShape,
  })
  .openapi('AdminSetupCategoryUpdateRequest')

const adminSetupServiceShape = {
  name: z.string(),
  categoryId: z.string(),
  duration: z.number().int().positive(),
  price: z.number().int().nonnegative(),
  color: z.string(),
  active: z.boolean().optional(),
  description: z.string().optional(),
}

export const adminSetupServiceCreateBodySchema = z
  .object({
    ...adminSetupServiceShape,
    ...adminSetupCatalogMutationMetaShape,
  })
  .openapi('AdminSetupServiceCreateRequest')

export const adminSetupServiceUpdateBodySchema = z
  .object({
    name: z.string().optional(),
    categoryId: z.string().optional(),
    duration: z.number().int().positive().optional(),
    price: z.number().int().nonnegative().optional(),
    color: z.string().optional(),
    active: z.boolean().optional(),
    description: z.string().optional(),
    ...adminSetupCatalogMutationMetaShape,
  })
  .openapi('AdminSetupServiceUpdateRequest')

const adminSetupAddonShape = {
  name: z.string(),
  priceDelta: z.number().int().nonnegative(),
  durationDelta: z.number().int().nonnegative(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  description: z.string().optional(),
  color: z.string().nullable().optional(),
  scopes: z.array(adminSetupCatalogScopeSchema).optional(),
}

export const adminSetupAddonCreateBodySchema = z
  .object({
    ...adminSetupAddonShape,
    ...adminSetupCatalogMutationMetaShape,
  })
  .openapi('AdminSetupAddonCreateRequest')

export const adminSetupAddonUpdateBodySchema = z
  .object({
    name: z.string().optional(),
    priceDelta: z.number().int().nonnegative().optional(),
    durationDelta: z.number().int().nonnegative().optional(),
    active: z.boolean().optional(),
    sortOrder: z.number().int().nonnegative().optional(),
    description: z.string().optional(),
    color: z.string().nullable().optional(),
    scopes: z.array(adminSetupCatalogScopeSchema).optional(),
    ...adminSetupCatalogMutationMetaShape,
  })
  .openapi('AdminSetupAddonUpdateRequest')

export const adminSetupCatalogMutationResponseSchema = z
  .object({
    category: anyRecordSchema.optional(),
    service: anyRecordSchema.optional(),
    addon: anyRecordSchema.optional(),
    importedCategoryIds: z.array(z.string()).optional(),
    importedVariantIds: z.array(z.string()).optional(),
  })
  .openapi('AdminSetupCatalogMutationResponse')

export const adminNoteCreateBodySchema = z
  .object({
    body: z.string().min(1).max(5000),
  })
  .openapi('AdminNoteCreateRequest')

export const adminNoteResponseSchema = z
  .object({ note: anyRecordSchema })
  .openapi('AdminNoteResponse')

const adminCatalogPresetTreeSchema = z.array(
  z.object({
    name: z.string(),
    services: z.array(
      z.object({
        name: z.string(),
        duration: z.number().int(),
        price: z.number(),
        color: z.string(),
        description: z.string().optional(),
      }),
    ),
  }),
)

export const adminCatalogPresetBodySchema = z
  .object({
    slug: z.string().min(1).max(80),
    name: z.string().min(1).max(120),
    description: z.string().nullable().optional(),
    tree: adminCatalogPresetTreeSchema.min(1),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
  })
  .openapi('AdminCatalogPresetCreateRequest')

export const adminCatalogPresetPatchBodySchema = adminCatalogPresetBodySchema
  .partial()
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
  })
  .openapi('AdminPlatformAdminCreateRequest')

export const adminPlatformAdminPatchBodySchema = z
  .object({
    role: platformRoleSchema.optional(),
    active: z.boolean().optional(),
  })
  .openapi('AdminPlatformAdminUpdateRequest')

export const adminPlatformAdminResponseSchema = z
  .object({ admin: anyRecordSchema })
  .openapi('AdminPlatformAdminResponse')
