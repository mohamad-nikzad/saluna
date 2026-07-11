import { createRoute } from '@hono/zod-openapi'
import {
  apiErrorSchema,
  idParamSchema,
  tenantSecurity,
} from '../schemas/common'
import {
  includeInactiveQuerySchema,
  serviceAddonCreateBodySchema,
  serviceAddonResponseSchema,
  serviceAddonUpdateBodySchema,
  serviceAddonsListResponseSchema,
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
  description: 'Service addon not found',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const validationErrorResponse = {
  description: 'Invalid request body or parameters',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const duplicateNameResponse = {
  description: 'Addon name already registered for this salon',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

export const listServiceAddonsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Service addons'],
  summary: 'List service addons',
  security: tenantSecurity,
  request: { query: includeInactiveQuerySchema },
  responses: {
    200: {
      description: 'Service addons list',
      content: {
        'application/json': { schema: serviceAddonsListResponseSchema },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
})

export const createServiceAddonRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Service addons'],
  summary: 'Create service addon',
  security: tenantSecurity,
  request: {
    body: {
      required: true,
      content: {
        'application/json': { schema: serviceAddonCreateBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Created addon',
      content: {
        'application/json': { schema: serviceAddonResponseSchema },
      },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    409: duplicateNameResponse,
  },
})

export const updateServiceAddonRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  tags: ['Service addons'],
  summary: 'Update service addon',
  security: tenantSecurity,
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: {
        'application/json': { schema: serviceAddonUpdateBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Updated addon',
      content: {
        'application/json': { schema: serviceAddonResponseSchema },
      },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
    409: duplicateNameResponse,
  },
})
