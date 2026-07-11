import { createRoute } from '@hono/zod-openapi'
import {
  apiErrorSchema,
  idParamSchema,
  tenantSecurity,
} from '../schemas/common'
import {
  includeInactiveQuerySchema,
  serviceFamiliesListResponseSchema,
  serviceFamilyCreateBodySchema,
  serviceFamilyResponseSchema,
  serviceFamilyUpdateBodySchema,
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
  description: 'Service family not found',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const validationErrorResponse = {
  description: 'Invalid request body or parameters',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const duplicateNameResponse = {
  description: 'Family name already registered for this category',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

export const listServiceFamiliesRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Service families'],
  summary: 'List service families',
  security: tenantSecurity,
  request: { query: includeInactiveQuerySchema },
  responses: {
    200: {
      description: 'Service families list',
      content: {
        'application/json': { schema: serviceFamiliesListResponseSchema },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
})

export const createServiceFamilyRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Service families'],
  summary: 'Create service family',
  security: tenantSecurity,
  request: {
    body: {
      required: true,
      content: {
        'application/json': { schema: serviceFamilyCreateBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Created family',
      content: {
        'application/json': { schema: serviceFamilyResponseSchema },
      },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    409: duplicateNameResponse,
  },
})

export const updateServiceFamilyRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  tags: ['Service families'],
  summary: 'Update service family',
  security: tenantSecurity,
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: {
        'application/json': { schema: serviceFamilyUpdateBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Updated family',
      content: {
        'application/json': { schema: serviceFamilyResponseSchema },
      },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
    409: duplicateNameResponse,
  },
})
