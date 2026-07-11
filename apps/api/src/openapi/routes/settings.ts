import { createRoute } from '@hono/zod-openapi'
import { apiErrorSchema, tenantSecurity } from '../schemas/common'
import {
  businessSettingsBodySchema,
  businessSettingsResponseSchema,
} from '../schemas/settings'

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

export const getBusinessSettingsRoute = createRoute({
  method: 'get',
  path: '/business',
  tags: ['Settings'],
  summary: 'Get business settings',
  description:
    'Salon working hours and slot duration. Readable by any tenant member.',
  security: tenantSecurity,
  responses: {
    200: {
      description: 'Business settings for the authenticated salon',
      content: {
        'application/json': { schema: businessSettingsResponseSchema },
      },
    },
    401: unauthorizedResponse,
  },
})

export const updateBusinessSettingsRoute = createRoute({
  method: 'patch',
  path: '/business',
  tags: ['Settings'],
  summary: 'Update business settings',
  security: tenantSecurity,
  request: {
    body: {
      required: true,
      content: {
        'application/json': { schema: businessSettingsBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Updated business settings',
      content: {
        'application/json': { schema: businessSettingsResponseSchema },
      },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
})
