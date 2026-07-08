import { createRoute } from '@hono/zod-openapi'
import {
  apiErrorSchema,
  idParamSchema,
  tenantSecurity,
} from '../schemas/common'
import {
  includeInactiveQuerySchema,
  servicePackageComponentsUpdateBodySchema,
  servicePackageBookingCreateBodySchema,
  servicePackageBookingResponseSchema,
  servicePackageResponseSchema,
  servicePackageCreateBodySchema,
  servicePackageStaffUpdateBodySchema,
  servicePackagesListResponseSchema,
  servicePackageUpdateBodySchema,
} from '../schemas/services'

const unauthorizedResponse = {
  description: 'Missing or invalid session',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const forbiddenResponse = {
  description: 'Authenticated but missing manage_services permission',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const notFoundResponse = {
  description: 'Service package not found',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const validationErrorResponse = {
  description: 'Invalid request body or parameters',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const duplicateNameResponse = {
  description: 'Package name already registered for this salon',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

export const listServicePackagesRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Service packages'],
  summary: 'List service packages',
  security: tenantSecurity,
  request: { query: includeInactiveQuerySchema },
  responses: {
    200: {
      description: 'Service packages list',
      content: {
        'application/json': { schema: servicePackagesListResponseSchema },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
})

export const createServicePackageRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Service packages'],
  summary: 'Create service package',
  security: tenantSecurity,
  request: {
    body: {
      required: true,
      content: {
        'application/json': { schema: servicePackageCreateBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Created package',
      content: {
        'application/json': { schema: servicePackageResponseSchema },
      },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    409: duplicateNameResponse,
  },
})

export const createServicePackageBookingRoute = createRoute({
  method: 'post',
  path: '/{id}/bookings',
  tags: ['Service packages'],
  summary: 'Schedule a manager-created service package booking',
  security: tenantSecurity,
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: {
        'application/json': { schema: servicePackageBookingCreateBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Created service package booking with task appointments',
      content: {
        'application/json': { schema: servicePackageBookingResponseSchema },
      },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
    409: validationErrorResponse,
  },
})

export const getServicePackageRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Service packages'],
  summary: 'Get service package',
  security: tenantSecurity,
  request: { params: idParamSchema },
  responses: {
    200: {
      description: 'Service package',
      content: {
        'application/json': { schema: servicePackageResponseSchema },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
})

export const updateServicePackageRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  tags: ['Service packages'],
  summary: 'Update service package',
  security: tenantSecurity,
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: {
        'application/json': { schema: servicePackageUpdateBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Updated package',
      content: {
        'application/json': { schema: servicePackageResponseSchema },
      },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
    409: duplicateNameResponse,
  },
})

export const updateServicePackageComponentsRoute = createRoute({
  method: 'put',
  path: '/{id}/components',
  tags: ['Service packages'],
  summary: 'Replace service package components',
  security: tenantSecurity,
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: {
        'application/json': {
          schema: servicePackageComponentsUpdateBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Updated package components',
      content: {
        'application/json': { schema: servicePackageResponseSchema },
      },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
})

export const updateServicePackageStaffRoute = createRoute({
  method: 'put',
  path: '/{id}/staff',
  tags: ['Service packages'],
  summary: 'Replace service package staff capabilities',
  security: tenantSecurity,
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: {
        'application/json': {
          schema: servicePackageStaffUpdateBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Updated package staff capabilities',
      content: {
        'application/json': { schema: servicePackageResponseSchema },
      },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
})
