import { createRoute } from '@hono/zod-openapi'
import { apiErrorSchema, idParamSchema, tenantSecurity } from '../schemas/common'
import {
  comboComponentsResponseSchema,
  comboComponentsUpdateBodySchema,
  importStarterTemplatesResponseSchema,
  includeInactiveQuerySchema,
  serviceCreateBodySchema,
  serviceResponseSchema,
  serviceUpdateBodySchema,
  serviceAddonsListResponseSchema,
  servicesListResponseSchema,
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
  description: 'Service not found',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const validationErrorResponse = {
  description: 'Invalid request body or parameters',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const duplicateNameResponse = {
  description: 'Service name already registered for this salon',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

export const listServicesRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Services'],
  summary: 'List services',
  security: tenantSecurity,
  request: { query: includeInactiveQuerySchema },
  responses: {
    200: {
      description: 'Services list',
      content: { 'application/json': { schema: servicesListResponseSchema } },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
})

export const createServiceRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Services'],
  summary: 'Create service',
  security: tenantSecurity,
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: serviceCreateBodySchema } },
    },
  },
  responses: {
    200: {
      description: 'Created service',
      content: { 'application/json': { schema: serviceResponseSchema } },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    409: duplicateNameResponse,
  },
})

export const importStarterTemplatesRoute = createRoute({
  method: 'post',
  path: '/import-starter-templates',
  tags: ['Services'],
  summary: 'Import starter service templates',
  security: tenantSecurity,
  responses: {
    200: {
      description: 'Imported starter catalog',
      content: {
        'application/json': { schema: importStarterTemplatesResponseSchema },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
})

export const getServiceRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Services'],
  summary: 'Get service',
  security: tenantSecurity,
  request: { params: idParamSchema },
  responses: {
    200: {
      description: 'Service',
      content: { 'application/json': { schema: serviceResponseSchema } },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
})

export const updateServiceRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  tags: ['Services'],
  summary: 'Update service',
  security: tenantSecurity,
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: serviceUpdateBodySchema } },
    },
  },
  responses: {
    200: {
      description: 'Updated service',
      content: { 'application/json': { schema: serviceResponseSchema } },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
    409: duplicateNameResponse,
  },
})

export const getServiceAddonsRoute = createRoute({
  method: 'get',
  path: '/{id}/addons',
  tags: ['Services'],
  summary: 'List active addons for a service',
  security: tenantSecurity,
  request: { params: idParamSchema },
  responses: {
    200: {
      description: 'Active addons applicable to the service',
      content: {
        'application/json': { schema: serviceAddonsListResponseSchema },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
})

export const getComboComponentsRoute = createRoute({
  method: 'get',
  path: '/{id}/combo-components',
  tags: ['Services'],
  summary: 'Get combo service components',
  security: tenantSecurity,
  request: { params: idParamSchema },
  responses: {
    200: {
      description: 'Combo components summary',
      content: {
        'application/json': { schema: comboComponentsResponseSchema },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
})

export const updateComboComponentsRoute = createRoute({
  method: 'put',
  path: '/{id}/combo-components',
  tags: ['Services'],
  summary: 'Replace combo service components',
  security: tenantSecurity,
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: {
        'application/json': { schema: comboComponentsUpdateBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Updated combo components',
      content: {
        'application/json': { schema: comboComponentsResponseSchema },
      },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
})
