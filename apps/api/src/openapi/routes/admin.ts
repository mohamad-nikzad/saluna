import { createRoute, z } from '@hono/zod-openapi'
import {
  apiErrorSchema,
  idParamSchema,
  tenantSecurity,
} from '../schemas/common'
import {
  adminAuditLogResponseSchema,
  adminAuditQuerySchema,
  adminCatalogPresetBodySchema,
  adminCatalogPresetPatchBodySchema,
  adminCatalogPresetResponseSchema,
  adminCatalogPresetsResponseSchema,
  adminListQuerySchema,
  adminMessagingHealthResponseSchema,
  adminNoteCreateBodySchema,
  adminNoteResponseSchema,
  adminNotesResponseSchema,
  adminNotificationDeliveriesResponseSchema,
  adminOverviewResponseSchema,
  adminPlatformAdminCreateBodySchema,
  adminPlatformAdminPatchBodySchema,
  adminPlatformAdminResponseSchema,
  adminPlatformAdminsResponseSchema,
  adminRuntimeResponseSchema,
  adminSalonAppointmentRequestsResponseSchema,
  adminSalonAppointmentsResponseSchema,
  adminSalonClientsResponseSchema,
  adminSalonDetailResponseSchema,
  adminSalonServicesResponseSchema,
  adminSalonStaffResponseSchema,
  adminSalonsResponseSchema,
  adminSetupSalonCreateBodySchema,
  adminSetupAccessQuerySchema,
  adminSetupSalonResponseSchema,
  adminSetupSalonConfigurationResponseSchema,
  adminSetupOwnerPhonePatchBodySchema,
  adminSetupOwnerPhoneResponseSchema,
  adminSetupHandoffCreateBodySchema,
  adminSetupHandoffResponseSchema,
  adminSetupStaffCreateBodySchema,
  adminSetupStaffCreateResponseSchema,
  adminSetupStaffAccessQuerySchema,
  adminSetupStaffAccessResponseSchema,
  adminSetupStaffListResponseSchema,
  adminSetupHoursPatchBodySchema,
  adminSetupHoursResponseSchema,
  adminSetupPresencePatchBodySchema,
  adminSetupPresenceResponseSchema,
  adminSetupAddonCreateBodySchema,
  adminSetupAddonUpdateBodySchema,
  adminSetupCatalogMutationResponseSchema,
  adminSetupCatalogPresetApplyBodySchema,
  adminSetupCatalogResponseSchema,
  adminSetupClientCreateBodySchema,
  adminSetupClientCreateResponseSchema,
  adminSetupClientImportBodySchema,
  adminSetupClientImportPreviewResponseSchema,
  adminSetupClientImportResponseSchema,
  adminSetupClientImportSourceSchema,
  adminSetupCategoryCreateBodySchema,
  adminSetupCategoryUpdateBodySchema,
  adminSetupFamilyCreateBodySchema,
  adminSetupFamilyUpdateBodySchema,
  adminSetupServiceCreateBodySchema,
  adminSetupServiceUpdateBodySchema,
  adminStatusUpdateBodySchema,
  adminSupportAppointmentRequestsResponseSchema,
  adminSupportAppointmentsResponseSchema,
  adminUserDetailResponseSchema,
  adminUserMeResponseSchema,
  adminUsersResponseSchema,
} from '../schemas/admin'

const adminSecurity = tenantSecurity
const setupCatalogEntityParamSchema = idParamSchema.extend({
  entityId: z.string(),
})
const setupCatalogPresetParamSchema = idParamSchema.extend({
  presetId: z.string(),
})

const unauthorizedResponse = {
  description: 'Missing or invalid session',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const forbiddenResponse = {
  description:
    'Authenticated user is not an active platform admin or lacks permission',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const notFoundResponse = {
  description: 'Admin resource not found',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const validationResponse = {
  description: 'Invalid request body or query',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const conflictResponse = {
  description: 'Mutation violates platform admin safety rules',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

function getRoute(
  path: string,
  summary: string,
  responseSchema: z.ZodType,
  query?: z.ZodObject,
) {
  return createRoute({
    method: 'get',
    path,
    tags: ['Admin'],
    summary,
    security: adminSecurity,
    request: query ? { query } : undefined,
    responses: {
      200: {
        description: summary,
        content: {
          'application/json': { schema: responseSchema },
        },
      },
      401: unauthorizedResponse,
      403: forbiddenResponse,
    },
  })
}

function getSalonListRoute(
  path: string,
  summary: string,
  responseSchema: z.ZodType,
) {
  return createRoute({
    method: 'get',
    path,
    tags: ['Admin'],
    summary,
    security: adminSecurity,
    request: {
      params: idParamSchema,
      query: adminListQuerySchema,
    },
    responses: {
      200: {
        description: summary,
        content: {
          'application/json': { schema: responseSchema },
        },
      },
      401: unauthorizedResponse,
      403: forbiddenResponse,
      404: notFoundResponse,
    },
  })
}

export const getAdminMeRoute = getRoute(
  '/auth/me',
  'Get current platform admin',
  adminUserMeResponseSchema,
)
export const getAdminRuntimeRoute = getRoute(
  '/runtime',
  'Get admin runtime metadata',
  adminRuntimeResponseSchema,
)
export const getAdminOverviewRoute = getRoute(
  '/overview',
  'Get admin overview metrics',
  adminOverviewResponseSchema,
)
export const listAdminSalonsRoute = getRoute(
  '/salons',
  'List salons for platform admin',
  adminSalonsResponseSchema,
  adminListQuerySchema,
)
export const createSetupSalonRoute = createRoute({
  method: 'post',
  path: '/salons',
  tags: ['Admin'],
  summary: 'Create a non-public Setup Salon',
  security: adminSecurity,
  request: {
    body: {
      required: true,
      content: {
        'application/json': { schema: adminSetupSalonCreateBodySchema },
      },
    },
  },
  responses: {
    201: {
      description: 'Setup Salon created',
      content: {
        'application/json': { schema: adminSetupSalonResponseSchema },
      },
    },
    400: validationResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
})
export const listAdminUsersRoute = getRoute(
  '/users',
  'List users for platform admin',
  adminUsersResponseSchema,
  adminListQuerySchema,
)
export const listAdminCatalogPresetsRoute = getRoute(
  '/catalog-presets',
  'List catalog presets for platform admin',
  adminCatalogPresetsResponseSchema,
  adminListQuerySchema,
)
export const getAdminMessagingHealthRoute = getRoute(
  '/messaging/health',
  'Get messaging health',
  adminMessagingHealthResponseSchema,
)
export const listAdminNotificationDeliveriesRoute = getRoute(
  '/notifications/deliveries',
  'List notification deliveries',
  adminNotificationDeliveriesResponseSchema,
  adminListQuerySchema,
)
export const listAdminSupportAppointmentsRoute = getRoute(
  '/support/appointments',
  'Search support appointments',
  adminSupportAppointmentsResponseSchema,
  adminListQuerySchema,
)
export const listAdminSupportAppointmentRequestsRoute = getRoute(
  '/support/appointment-requests',
  'Search support appointment requests',
  adminSupportAppointmentRequestsResponseSchema,
  adminListQuerySchema,
)
export const listAdminAuditLogRoute = getRoute(
  '/audit-log',
  'List admin audit events',
  adminAuditLogResponseSchema,
  adminAuditQuerySchema,
)
export const listPlatformAdminsRoute = getRoute(
  '/platform-admins',
  'List platform admins',
  adminPlatformAdminsResponseSchema,
  adminListQuerySchema,
)

export const getAdminSalonRoute = createRoute({
  method: 'get',
  path: '/salons/{id}',
  tags: ['Admin'],
  summary: 'Get salon detail for platform admin',
  security: adminSecurity,
  request: { params: idParamSchema },
  responses: {
    200: {
      description: 'Salon detail',
      content: {
        'application/json': { schema: adminSalonDetailResponseSchema },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
})

export const getAdminSetupSalonConfigurationRoute = createRoute({
  method: 'get',
  path: '/salons/{id}/setup',
  tags: ['Admin'],
  summary: 'Get Setup Salon hours and presence',
  security: adminSecurity,
  request: { params: idParamSchema, query: adminSetupAccessQuerySchema },
  responses: {
    200: {
      description: 'Setup Salon configuration',
      content: {
        'application/json': {
          schema: adminSetupSalonConfigurationResponseSchema,
        },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
    409: conflictResponse,
  },
})

export const updateAdminSetupOwnerPhoneRoute = createRoute({
  method: 'patch',
  path: '/salons/{id}/setup/owner-phone',
  tags: ['Admin'],
  summary: 'Update the intended owner phone for a Setup Salon',
  security: adminSecurity,
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: {
        'application/json': { schema: adminSetupOwnerPhonePatchBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Updated intended owner phone',
      content: {
        'application/json': { schema: adminSetupOwnerPhoneResponseSchema },
      },
    },
    400: validationResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
    409: conflictResponse,
  },
})

export const createAdminSetupHandoffRoute = createRoute({
  method: 'post',
  path: '/salons/{id}/setup/handoff',
  tags: ['Admin'],
  summary: 'Create a one-time Setup Salon handoff link',
  security: adminSecurity,
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: {
        'application/json': { schema: adminSetupHandoffCreateBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: 'One-time handoff link',
      content: {
        'application/json': { schema: adminSetupHandoffResponseSchema },
      },
    },
    400: validationResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
    409: conflictResponse,
  },
})

export const updateAdminSetupSalonHoursRoute = createRoute({
  method: 'patch',
  path: '/salons/{id}/setup/hours',
  tags: ['Admin'],
  summary: 'Update Setup Salon hours',
  security: adminSecurity,
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: {
        'application/json': { schema: adminSetupHoursPatchBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Updated Setup Salon hours',
      content: {
        'application/json': { schema: adminSetupHoursResponseSchema },
      },
    },
    400: validationResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
    409: conflictResponse,
  },
})

export const updateAdminSetupSalonPresenceRoute = createRoute({
  method: 'patch',
  path: '/salons/{id}/setup/presence',
  tags: ['Admin'],
  summary: 'Update Setup Salon presence',
  security: adminSecurity,
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: {
        'application/json': { schema: adminSetupPresencePatchBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Updated Setup Salon presence',
      content: {
        'application/json': { schema: adminSetupPresenceResponseSchema },
      },
    },
    400: validationResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
    409: conflictResponse,
  },
})

export const getAdminSetupStaffRoute = createRoute({
  method: 'get',
  path: '/salons/{id}/setup/staff',
  tags: ['Admin'],
  summary: 'List prepared Staff Profiles',
  security: adminSecurity,
  request: { params: idParamSchema, query: adminSetupAccessQuerySchema },
  responses: {
    200: {
      description: 'Prepared Staff Profiles',
      content: {
        'application/json': { schema: adminSetupStaffListResponseSchema },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
    409: conflictResponse,
  },
})

export const getAdminSetupStaffAccessRoute = createRoute({
  method: 'get',
  path: '/salons/{id}/setup/staff/access',
  tags: ['Admin'],
  summary: 'Inspect existing claimed staff access before setup',
  security: adminSecurity,
  request: { params: idParamSchema, query: adminSetupStaffAccessQuerySchema },
  responses: {
    200: {
      description: 'Existing cross-salon staff access, when present',
      content: {
        'application/json': { schema: adminSetupStaffAccessResponseSchema },
      },
    },
    400: validationResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
    409: conflictResponse,
  },
})

export const createAdminSetupStaffRoute = createRoute({
  method: 'post',
  path: '/salons/{id}/setup/staff',
  tags: ['Admin'],
  summary: 'Create an unclaimed Staff Profile',
  security: adminSecurity,
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: {
        'application/json': { schema: adminSetupStaffCreateBodySchema },
      },
    },
  },
  responses: {
    201: {
      description: 'Unclaimed Staff Profile created',
      content: {
        'application/json': { schema: adminSetupStaffCreateResponseSchema },
      },
    },
    400: validationResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
    409: conflictResponse,
  },
})

export const getAdminSetupCatalogRoute = createRoute({
  method: 'get',
  path: '/salons/{id}/setup/catalog',
  tags: ['Admin'],
  summary: 'Get the Setup Salon service catalog workspace',
  security: adminSecurity,
  request: { params: idParamSchema, query: adminSetupAccessQuerySchema },
  responses: {
    200: {
      description: 'Setup Salon catalog',
      content: {
        'application/json': { schema: adminSetupCatalogResponseSchema },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
    409: conflictResponse,
  },
})

function setupCatalogMutationRoute(input: {
  method: 'post' | 'patch'
  path: string
  summary: string
  params: z.ZodObject<any>
  body: z.ZodType
}) {
  return createRoute({
    method: input.method,
    path: input.path,
    tags: ['Admin'],
    summary: input.summary,
    security: adminSecurity,
    request: {
      params: input.params,
      body: {
        required: true,
        content: { 'application/json': { schema: input.body } },
      },
    },
    responses: {
      200: {
        description: 'Updated setup catalog',
        content: {
          'application/json': {
            schema: adminSetupCatalogMutationResponseSchema,
          },
        },
      },
      201: {
        description: 'Created setup catalog record',
        content: {
          'application/json': {
            schema: adminSetupCatalogMutationResponseSchema,
          },
        },
      },
      400: validationResponse,
      401: unauthorizedResponse,
      403: forbiddenResponse,
      404: notFoundResponse,
      409: conflictResponse,
    },
  })
}

export const applyAdminSetupCatalogPresetRoute = setupCatalogMutationRoute({
  method: 'post',
  path: '/salons/{id}/setup/catalog/presets/{presetId}/apply',
  summary: 'Apply a CatalogPreset to a Setup Salon',
  params: setupCatalogPresetParamSchema,
  body: adminSetupCatalogPresetApplyBodySchema,
})
export const createAdminSetupCategoryRoute = setupCatalogMutationRoute({
  method: 'post',
  path: '/salons/{id}/setup/catalog/categories',
  summary: 'Create a Setup Salon service category',
  params: idParamSchema,
  body: adminSetupCategoryCreateBodySchema,
})
export const updateAdminSetupCategoryRoute = setupCatalogMutationRoute({
  method: 'patch',
  path: '/salons/{id}/setup/catalog/categories/{entityId}',
  summary: 'Update a Setup Salon service category',
  params: setupCatalogEntityParamSchema,
  body: adminSetupCategoryUpdateBodySchema,
})
export const createAdminSetupFamilyRoute = setupCatalogMutationRoute({
  method: 'post',
  path: '/salons/{id}/setup/catalog/families',
  summary: 'Create a Setup Salon service family',
  params: idParamSchema,
  body: adminSetupFamilyCreateBodySchema,
})
export const updateAdminSetupFamilyRoute = setupCatalogMutationRoute({
  method: 'patch',
  path: '/salons/{id}/setup/catalog/families/{entityId}',
  summary: 'Update a Setup Salon service family',
  params: setupCatalogEntityParamSchema,
  body: adminSetupFamilyUpdateBodySchema,
})
export const createAdminSetupServiceRoute = setupCatalogMutationRoute({
  method: 'post',
  path: '/salons/{id}/setup/catalog/services',
  summary: 'Create a Setup Salon ServiceVariant',
  params: idParamSchema,
  body: adminSetupServiceCreateBodySchema,
})
export const updateAdminSetupServiceRoute = setupCatalogMutationRoute({
  method: 'patch',
  path: '/salons/{id}/setup/catalog/services/{entityId}',
  summary: 'Update a Setup Salon ServiceVariant',
  params: setupCatalogEntityParamSchema,
  body: adminSetupServiceUpdateBodySchema,
})
export const createAdminSetupAddonRoute = setupCatalogMutationRoute({
  method: 'post',
  path: '/salons/{id}/setup/catalog/addons',
  summary: 'Create a Setup Salon service add-on',
  params: idParamSchema,
  body: adminSetupAddonCreateBodySchema,
})
export const updateAdminSetupAddonRoute = setupCatalogMutationRoute({
  method: 'patch',
  path: '/salons/{id}/setup/catalog/addons/{entityId}',
  summary: 'Update a Setup Salon service add-on',
  params: setupCatalogEntityParamSchema,
  body: adminSetupAddonUpdateBodySchema,
})

export const listAdminSalonClientsRoute = getSalonListRoute(
  '/salons/{id}/clients',
  'List salon Clients for platform admin',
  adminSalonClientsResponseSchema,
)

export const createAdminSetupClientRoute = createRoute({
  method: 'post',
  path: '/salons/{id}/setup/clients',
  tags: ['Admin'],
  summary: 'Create a Setup Salon Client',
  security: adminSecurity,
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: {
        'application/json': { schema: adminSetupClientCreateBodySchema },
      },
    },
  },
  responses: {
    201: {
      description: 'Created Client',
      content: {
        'application/json': { schema: adminSetupClientCreateResponseSchema },
      },
    },
    400: validationResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    409: conflictResponse,
  },
})

export const previewAdminSetupClientImportRoute = createRoute({
  method: 'post',
  path: '/salons/{id}/setup/clients/import/preview',
  tags: ['Admin'],
  summary: 'Preview a Setup Salon Client Import',
  security: adminSecurity,
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: {
        'application/json': { schema: adminSetupClientImportSourceSchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Import preview',
      content: {
        'application/json': {
          schema: adminSetupClientImportPreviewResponseSchema,
        },
      },
    },
    400: validationResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    409: conflictResponse,
  },
})

export const createAdminSetupClientImportRoute = createRoute({
  method: 'post',
  path: '/salons/{id}/setup/clients/import',
  tags: ['Admin'],
  summary: 'Confirm a Setup Salon Client Import',
  security: adminSecurity,
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: {
        'application/json': { schema: adminSetupClientImportBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Import result',
      content: {
        'application/json': { schema: adminSetupClientImportResponseSchema },
      },
    },
    400: validationResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    409: conflictResponse,
  },
})

export const listAdminSalonAppointmentsRoute = getSalonListRoute(
  '/salons/{id}/appointments',
  'List salon Appointments for platform admin',
  adminSalonAppointmentsResponseSchema,
)

export const listAdminSalonAppointmentRequestsRoute = getSalonListRoute(
  '/salons/{id}/appointment-requests',
  'List salon AppointmentRequests for platform admin',
  adminSalonAppointmentRequestsResponseSchema,
)

export const listAdminSalonStaffRoute = getSalonListRoute(
  '/salons/{id}/staff',
  'List salon Staff for platform admin',
  adminSalonStaffResponseSchema,
)

export const listAdminSalonServicesRoute = getSalonListRoute(
  '/salons/{id}/services',
  'List salon ServiceVariants for platform admin',
  adminSalonServicesResponseSchema,
)

export const updateAdminSalonStatusRoute = createRoute({
  method: 'patch',
  path: '/salons/{id}/status',
  tags: ['Admin'],
  summary: 'Update salon platform status',
  security: adminSecurity,
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: adminStatusUpdateBodySchema } },
    },
  },
  responses: {
    200: {
      description: 'Updated salon status',
      content: {
        'application/json': {
          schema: adminSalonDetailResponseSchema.partial(),
        },
      },
    },
    400: validationResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
    409: conflictResponse,
  },
})

export const listAdminSalonNotesRoute = createRoute({
  method: 'get',
  path: '/salons/{id}/notes',
  tags: ['Admin'],
  summary: 'List internal salon notes',
  security: adminSecurity,
  request: { params: idParamSchema },
  responses: {
    200: {
      description: 'Internal salon notes',
      content: { 'application/json': { schema: adminNotesResponseSchema } },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
})

export const createAdminSalonNoteRoute = createRoute({
  method: 'post',
  path: '/salons/{id}/notes',
  tags: ['Admin'],
  summary: 'Create internal salon note',
  security: adminSecurity,
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: adminNoteCreateBodySchema } },
    },
  },
  responses: {
    201: {
      description: 'Created internal salon note',
      content: { 'application/json': { schema: adminNoteResponseSchema } },
    },
    400: validationResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
})

export const getAdminUserRoute = createRoute({
  method: 'get',
  path: '/users/{id}',
  tags: ['Admin'],
  summary: 'Get user detail for platform admin',
  security: adminSecurity,
  request: { params: idParamSchema },
  responses: {
    200: {
      description: 'User detail',
      content: {
        'application/json': { schema: adminUserDetailResponseSchema },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
})

export const listAdminUserNotesRoute = createRoute({
  method: 'get',
  path: '/users/{id}/notes',
  tags: ['Admin'],
  summary: 'List internal user notes',
  security: adminSecurity,
  request: { params: idParamSchema },
  responses: {
    200: {
      description: 'Internal user notes',
      content: { 'application/json': { schema: adminNotesResponseSchema } },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
})

export const createAdminUserNoteRoute = createRoute({
  method: 'post',
  path: '/users/{id}/notes',
  tags: ['Admin'],
  summary: 'Create internal user note',
  security: adminSecurity,
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: adminNoteCreateBodySchema } },
    },
  },
  responses: {
    201: {
      description: 'Created internal user note',
      content: { 'application/json': { schema: adminNoteResponseSchema } },
    },
    400: validationResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
})

export const createAdminCatalogPresetRoute = createRoute({
  method: 'post',
  path: '/catalog-presets',
  tags: ['Admin'],
  summary: 'Create catalog preset',
  security: adminSecurity,
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: adminCatalogPresetBodySchema } },
    },
  },
  responses: {
    201: {
      description: 'Created catalog preset',
      content: {
        'application/json': { schema: adminCatalogPresetResponseSchema },
      },
    },
    400: validationResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
})

export const updateAdminCatalogPresetRoute = createRoute({
  method: 'patch',
  path: '/catalog-presets/{id}',
  tags: ['Admin'],
  summary: 'Update catalog preset',
  security: adminSecurity,
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: {
        'application/json': { schema: adminCatalogPresetPatchBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Updated catalog preset',
      content: {
        'application/json': { schema: adminCatalogPresetResponseSchema },
      },
    },
    400: validationResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
})

export const createPlatformAdminRoute = createRoute({
  method: 'post',
  path: '/platform-admins',
  tags: ['Admin'],
  summary: 'Grant platform admin access',
  security: adminSecurity,
  request: {
    body: {
      required: true,
      content: {
        'application/json': { schema: adminPlatformAdminCreateBodySchema },
      },
    },
  },
  responses: {
    201: {
      description: 'Created or updated platform admin',
      content: {
        'application/json': { schema: adminPlatformAdminResponseSchema },
      },
    },
    400: validationResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
})

export const updatePlatformAdminRoute = createRoute({
  method: 'patch',
  path: '/platform-admins/{id}',
  tags: ['Admin'],
  summary: 'Update platform admin access',
  security: adminSecurity,
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: {
        'application/json': { schema: adminPlatformAdminPatchBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Updated platform admin',
      content: {
        'application/json': { schema: adminPlatformAdminResponseSchema },
      },
    },
    400: validationResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
    409: conflictResponse,
  },
})
