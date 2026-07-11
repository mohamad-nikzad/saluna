import { createRoute } from '@hono/zod-openapi'
import { apiErrorSchema, tenantSecurity } from '../schemas/common'
import {
  salonPresencePatchBodySchema,
  salonPresenceResponseSchema,
} from '../schemas/salon-profile'

const unauthorizedResponse = {
  description: 'Missing or invalid session',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const forbiddenResponse = {
  description: 'Authenticated but missing manage_settings permission',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const validationErrorResponse = {
  description: 'Invalid request body or parameters',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

export const getSalonPresenceRoute = createRoute({
  method: 'get',
  path: '/presence',
  tags: ['Salon profile'],
  summary: 'Get salon presence',
  description:
    'Address, maps, social links, and website shown on the public page.',
  security: tenantSecurity,
  responses: {
    200: {
      description: 'Salon presence fields',
      content: {
        'application/json': { schema: salonPresenceResponseSchema },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
})

export const updateSalonPresenceRoute = createRoute({
  method: 'patch',
  path: '/presence',
  tags: ['Salon profile'],
  summary: 'Update salon presence',
  security: tenantSecurity,
  request: {
    body: {
      required: true,
      content: {
        'application/json': { schema: salonPresencePatchBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Updated salon presence',
      content: {
        'application/json': { schema: salonPresenceResponseSchema },
      },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
})
