import { createRoute } from '@hono/zod-openapi'
import {
  apiErrorSchema,
  idParamSchema,
  tenantSecurity,
} from '../schemas/common'
import {
  createMessagingLinkBodySchema,
  createMessagingLinkResponseSchema,
  deleteMessagingAccountResponseSchema,
  listMessagingAccountsResponseSchema,
  messagingAccountResponseSchema,
  patchMessagingAccountBodySchema,
} from '../schemas/messaging'

const unauthorizedResponse = {
  description: 'Missing or invalid session',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const forbiddenResponse = {
  description: 'Authenticated but missing manage_settings permission',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const notFoundResponse = {
  description: 'Messaging account not found',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const validationErrorResponse = {
  description: 'Invalid request body or parameters',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const rateLimitedResponse = {
  description: 'Too many link creation requests',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const providerUnavailableResponse = {
  description: 'Messaging provider is not configured or available',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

export const listMessagingAccountsRoute = createRoute({
  method: 'get',
  path: '/accounts',
  tags: ['Messaging'],
  summary: 'List linked messaging accounts',
  description:
    'Returns configured messaging providers and the authenticated user linked accounts.',
  security: tenantSecurity,
  responses: {
    200: {
      description: 'Configured providers and linked accounts',
      content: {
        'application/json': { schema: listMessagingAccountsResponseSchema },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
})

export const createMessagingLinkRoute = createRoute({
  method: 'post',
  path: '/link',
  tags: ['Messaging'],
  summary: 'Create a messaging account link',
  description:
    'Creates a short-lived deep link token for linking a messaging provider account.',
  security: tenantSecurity,
  request: {
    body: {
      required: true,
      content: {
        'application/json': { schema: createMessagingLinkBodySchema },
      },
    },
  },
  responses: {
    201: {
      description: 'Deep link for the selected provider',
      content: {
        'application/json': { schema: createMessagingLinkResponseSchema },
      },
    },
    400: providerUnavailableResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    429: rateLimitedResponse,
  },
})

export const patchMessagingAccountRoute = createRoute({
  method: 'patch',
  path: '/accounts/{id}',
  tags: ['Messaging'],
  summary: 'Enable or disable a linked messaging account',
  security: tenantSecurity,
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: {
        'application/json': { schema: patchMessagingAccountBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Updated messaging account',
      content: {
        'application/json': { schema: messagingAccountResponseSchema },
      },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
})

export const deleteMessagingAccountRoute = createRoute({
  method: 'delete',
  path: '/accounts/{id}',
  tags: ['Messaging'],
  summary: 'Unlink a messaging account',
  security: tenantSecurity,
  request: {
    params: idParamSchema,
  },
  responses: {
    200: {
      description: 'Account unlinked',
      content: {
        'application/json': { schema: deleteMessagingAccountResponseSchema },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
})
