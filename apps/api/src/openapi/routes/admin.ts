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
  adminStatusUpdateBodySchema,
  adminSupportAppointmentRequestsResponseSchema,
  adminSupportAppointmentsResponseSchema,
  adminUserDetailResponseSchema,
  adminUserMeResponseSchema,
  adminUsersResponseSchema,
} from '../schemas/admin'

const adminSecurity = tenantSecurity

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

export const listAdminSalonClientsRoute = getSalonListRoute(
  '/salons/{id}/clients',
  'List salon Clients for platform admin',
  adminSalonClientsResponseSchema,
)

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
