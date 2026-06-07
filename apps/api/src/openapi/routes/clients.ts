import { createRoute } from '@hono/zod-openapi'
import { apiErrorSchema, idParamSchema, tenantSecurity } from '../schemas/common'
import {
  clientCreateBodySchema,
  clientFollowUpResponseSchema,
  clientResponseSchema,
  clientSummarySchema,
  clientUpdateBodySchema,
  clientsListResponseSchema,
  followUpBodySchema,
} from '../schemas/clients'

const unauthorizedResponse = {
  description: 'Missing or invalid session',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const forbiddenResponse = {
  description: 'Authenticated but missing manage_clients permission',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const notFoundResponse = {
  description: 'Client not found',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const validationErrorResponse = {
  description: 'Invalid request body or parameters',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const duplicatePhoneResponse = {
  description: 'Phone number already registered for this salon',
  content: {
    'application/json': {
      schema: apiErrorSchema.openapi({
        example: {
          error: 'این شماره تماس برای این سالن قبلاً ثبت شده است',
          code: 'duplicate-phone',
        },
      }),
    },
  },
} as const

export const listClientsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Clients'],
  summary: 'List clients',
  description: 'Returns all non-placeholder clients for the authenticated salon tenant.',
  security: tenantSecurity,
  responses: {
    200: {
      description: 'Client list',
      content: { 'application/json': { schema: clientsListResponseSchema } },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
})

export const createClientRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Clients'],
  summary: 'Create client',
  security: tenantSecurity,
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: clientCreateBodySchema } },
    },
  },
  responses: {
    200: {
      description: 'Created client with tags',
      content: { 'application/json': { schema: clientResponseSchema } },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    409: duplicatePhoneResponse,
  },
})

export const getClientRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Clients'],
  summary: 'Get client by id',
  security: tenantSecurity,
  request: { params: idParamSchema },
  responses: {
    200: {
      description: 'Client with tags',
      content: { 'application/json': { schema: clientResponseSchema } },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
})

export const updateClientRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  tags: ['Clients'],
  summary: 'Update client',
  security: tenantSecurity,
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: clientUpdateBodySchema } },
    },
  },
  responses: {
    200: {
      description: 'Updated client with tags',
      content: { 'application/json': { schema: clientResponseSchema } },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
    409: duplicatePhoneResponse,
  },
})

export const getClientSummaryRoute = createRoute({
  method: 'get',
  path: '/{id}/summary',
  tags: ['Clients'],
  summary: 'Get client summary',
  security: tenantSecurity,
  request: { params: idParamSchema },
  responses: {
    200: {
      description: 'Client profile summary with appointments and follow-ups',
      content: { 'application/json': { schema: clientSummarySchema } },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
})

export const createClientFollowUpRoute = createRoute({
  method: 'post',
  path: '/{id}/follow-ups',
  tags: ['Clients'],
  summary: 'Create client follow-up',
  security: tenantSecurity,
  request: {
    params: idParamSchema,
    body: {
      content: { 'application/json': { schema: followUpBodySchema } },
    },
  },
  responses: {
    200: {
      description: 'Created follow-up',
      content: { 'application/json': { schema: clientFollowUpResponseSchema } },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
})
