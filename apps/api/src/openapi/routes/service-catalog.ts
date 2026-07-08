import { createRoute } from '@hono/zod-openapi'
import { apiErrorSchema, tenantSecurity } from '../schemas/common'
import {
  includeInactiveQuerySchema,
  serviceCatalogResponseSchema,
} from '../schemas/services'

const unauthorizedResponse = {
  description: 'Missing or invalid session',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const forbiddenResponse = {
  description: 'Authenticated but missing service catalog access',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

export const getServiceCatalogRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Service catalog'],
  summary: 'Get combined service catalog',
  security: tenantSecurity,
  request: { query: includeInactiveQuerySchema },
  responses: {
    200: {
      description: 'Combined category, service, add-on, and package catalog',
      content: {
        'application/json': { schema: serviceCatalogResponseSchema },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
})
