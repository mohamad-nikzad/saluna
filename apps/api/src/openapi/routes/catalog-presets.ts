import { createRoute } from '@hono/zod-openapi'
import {
  apiErrorSchema,
  idParamSchema,
  tenantSecurity,
} from '../schemas/common'
import {
  applyCatalogPresetBodySchemaOpenApi,
  applyCatalogPresetResponseSchema,
  catalogPresetsListResponseSchema,
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
  description: 'Catalog preset not found or inactive',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const validationErrorResponse = {
  description: 'Invalid request body or parameters',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const conflictResponse = {
  description: 'Preset collides with existing salon catalog',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

export const listCatalogPresetsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Catalog presets'],
  summary: 'List active catalog presets',
  security: tenantSecurity,
  responses: {
    200: {
      description: 'Catalog presets available to the salon',
      content: {
        'application/json': { schema: catalogPresetsListResponseSchema },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
})

export const applyCatalogPresetRoute = createRoute({
  method: 'post',
  path: '/{id}/apply',
  tags: ['Catalog presets'],
  summary: 'Apply catalog preset selection',
  security: tenantSecurity,
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: {
        'application/json': { schema: applyCatalogPresetBodySchemaOpenApi },
      },
    },
  },
  responses: {
    200: {
      description: 'Imported preset services',
      content: {
        'application/json': { schema: applyCatalogPresetResponseSchema },
      },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
    409: conflictResponse,
  },
})
