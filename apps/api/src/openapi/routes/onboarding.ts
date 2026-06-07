import { createRoute } from '@hono/zod-openapi'
import { apiErrorSchema, tenantSecurity } from '../schemas/common'
import {
  onboardingResponseSchema,
  onboardingUpdateBodySchema,
} from '../schemas/onboarding'

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

export const getOnboardingRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Onboarding'],
  summary: 'Get onboarding status',
  description:
    'Salon setup progress for the manager onboarding wizard. Step flags are derived from salon data.',
  security: tenantSecurity,
  responses: {
    200: {
      description: 'Current onboarding status for the authenticated salon',
      content: {
        'application/json': { schema: onboardingResponseSchema },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
})

export const updateOnboardingRoute = createRoute({
  method: 'patch',
  path: '/',
  tags: ['Onboarding'],
  summary: 'Update onboarding state',
  description:
    'Apply a wizard action such as confirming business hours, marking the manager as solo staff, completing, skipping, or reopening onboarding.',
  security: tenantSecurity,
  request: {
    body: {
      required: true,
      content: {
        'application/json': { schema: onboardingUpdateBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Updated onboarding status',
      content: {
        'application/json': { schema: onboardingResponseSchema },
      },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
})
