import { createRoute } from '@hono/zod-openapi'
import { apiErrorSchema, idParamSchema, tenantSecurity } from '../schemas/common'
import {
  includeInactiveQuerySchema,
  serviceCategoriesListResponseSchema,
  serviceCategoryCreateBodySchema,
  serviceCategoryResponseSchema,
  serviceCategoryUpdateBodySchema,
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
  description: 'Service category not found',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const validationErrorResponse = {
  description: 'Invalid request body or parameters',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const duplicateNameResponse = {
  description: 'Category name already registered for this salon',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

export const listServiceCategoriesRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Service categories'],
  summary: 'List service categories',
  security: tenantSecurity,
  request: { query: includeInactiveQuerySchema },
  responses: {
    200: {
      description: 'Service categories list',
      content: {
        'application/json': { schema: serviceCategoriesListResponseSchema },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
})

export const createServiceCategoryRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Service categories'],
  summary: 'Create service category',
  security: tenantSecurity,
  request: {
    body: {
      required: true,
      content: {
        'application/json': { schema: serviceCategoryCreateBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Created category',
      content: {
        'application/json': { schema: serviceCategoryResponseSchema },
      },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    409: duplicateNameResponse,
  },
})

export const updateServiceCategoryRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  tags: ['Service categories'],
  summary: 'Update service category',
  security: tenantSecurity,
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: {
        'application/json': { schema: serviceCategoryUpdateBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Updated category',
      content: {
        'application/json': { schema: serviceCategoryResponseSchema },
      },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
    409: duplicateNameResponse,
  },
})
