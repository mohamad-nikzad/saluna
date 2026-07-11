import { createRoute } from '@hono/zod-openapi'
import {
  apiErrorSchema,
  idParamSchema,
  tenantSecurity,
} from '../schemas/common'
import {
  retentionBaleMessageBodySchema,
  retentionBaleMessageResponseSchema,
  retentionListResponseSchema,
  retentionUpdateBodySchema,
  retentionUpdateResponseSchema,
} from '../schemas/retention'

const unauthorizedResponse = {
  description: 'Missing or invalid session',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const forbiddenResponse = {
  description: 'Authenticated but missing manage_settings permission',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const notFoundResponse = {
  description: 'Follow-up not found',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const validationErrorResponse = {
  description: 'Invalid request body or parameters',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const conflictResponse = {
  description: 'Follow-up not open, message already sent, or retry required',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

export const listRetentionRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Retention'],
  summary: 'List retention follow-up queue',
  description:
    'Open client follow-ups derived from appointment history. Does not send messages automatically.',
  security: tenantSecurity,
  responses: {
    200: {
      description: 'Retention queue items for the authenticated salon',
      content: {
        'application/json': { schema: retentionListResponseSchema },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
})

export const updateRetentionRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  tags: ['Retention'],
  summary: 'Update retention follow-up status',
  security: tenantSecurity,
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: {
        'application/json': { schema: retentionUpdateBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Updated follow-up',
      content: {
        'application/json': { schema: retentionUpdateResponseSchema },
      },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
})

export const sendRetentionBaleMessageRoute = createRoute({
  method: 'post',
  path: '/{id}/bale-message',
  tags: ['Retention'],
  summary: 'Send Bale retention message',
  description:
    'Sends a one-off follow-up message via Bale Safir for an open retention item.',
  security: tenantSecurity,
  request: {
    params: idParamSchema,
    body: {
      content: {
        'application/json': { schema: retentionBaleMessageBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Message delivery result',
      content: {
        'application/json': { schema: retentionBaleMessageResponseSchema },
      },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
    409: conflictResponse,
  },
})
