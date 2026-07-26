import { createRoute } from '@hono/zod-openapi'
import { apiErrorSchema, tenantSecurity } from '../schemas/common'
import {
  businessSettingsBodySchema,
  businessSettingsResponseSchema,
  changedSalonClosureDatesResponseSchema,
  closeSalonDatesBodySchema,
  salonClosureRangeSchema,
  salonClosuresResponseSchema,
  salonClosureWarningSchema,
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

export const listSalonClosuresRoute = createRoute({
  method: 'get',
  path: '/closures',
  tags: ['Settings'],
  summary: 'List salon closure dates',
  security: tenantSecurity,
  responses: {
    200: {
      description: 'Future salon-wide closure dates',
      content: {
        'application/json': { schema: salonClosuresResponseSchema },
      },
    },
    401: unauthorizedResponse,
  },
})

export const closeSalonDatesRoute = createRoute({
  method: 'post',
  path: '/closures',
  tags: ['Settings'],
  summary: 'Close a salon date range',
  security: tenantSecurity,
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: closeSalonDatesBodySchema } },
    },
  },
  responses: {
    200: {
      description: 'Newly closed dates',
      content: {
        'application/json': {
          schema: changedSalonClosureDatesResponseSchema,
        },
      },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    409: {
      description: 'Active appointments require confirmation',
      content: { 'application/json': { schema: salonClosureWarningSchema } },
    },
  },
})

export const reopenSalonDatesRoute = createRoute({
  method: 'delete',
  path: '/closures',
  tags: ['Settings'],
  summary: 'Reopen a salon date range',
  security: tenantSecurity,
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: salonClosureRangeSchema } },
    },
  },
  responses: {
    200: {
      description: 'Reopened dates',
      content: {
        'application/json': {
          schema: changedSalonClosureDatesResponseSchema,
        },
      },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
})
