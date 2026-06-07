import { createRoute } from '@hono/zod-openapi'
import { apiErrorSchema, idParamSchema, tenantSecurity } from '../schemas/common'
import {
  bookingAvailabilityQuerySchema,
  staffBookingAvailabilityResponseSchema,
  staffCreateBodySchema,
  staffCreateResponseSchema,
  staffListResponseSchema,
  staffMemberResponseSchema,
  staffPasswordBodySchema,
  staffScheduleBodySchema,
  staffScheduleBundleResponseSchema,
  staffScheduleUpdateResponseSchema,
  staffServiceIdsBodySchema,
  staffUpdateBodySchema,
  successResponseSchema,
} from '../schemas/staff'

const unauthorizedResponse = {
  description: 'Missing or invalid session',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const forbiddenResponse = {
  description: 'Authenticated but missing manage_settings permission',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const notFoundResponse = {
  description: 'Staff member not found',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const validationErrorResponse = {
  description: 'Invalid request body or parameters',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const duplicatePhoneResponse = {
  description: 'Phone number already registered',
  content: {
    'application/json': {
      schema: apiErrorSchema.openapi({
        example: {
          error: 'این شماره موبایل قبلاً ثبت شده است',
          code: 'duplicate-phone',
        },
      }),
    },
  },
} as const

export const listStaffRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Staff'],
  summary: 'List staff',
  description: 'Returns all active staff and managers for the authenticated salon tenant.',
  security: tenantSecurity,
  responses: {
    200: {
      description: 'Staff list',
      content: { 'application/json': { schema: staffListResponseSchema } },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
})

export const createStaffRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Staff'],
  summary: 'Create staff member',
  security: tenantSecurity,
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: staffCreateBodySchema } },
    },
  },
  responses: {
    200: {
      description: 'Created staff user',
      content: { 'application/json': { schema: staffCreateResponseSchema } },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    409: duplicatePhoneResponse,
  },
})

export const updateStaffRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  tags: ['Staff'],
  summary: 'Update staff member',
  security: tenantSecurity,
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: staffUpdateBodySchema } },
    },
  },
  responses: {
    200: {
      description: 'Updated staff member',
      content: { 'application/json': { schema: staffMemberResponseSchema } },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
    409: duplicatePhoneResponse,
  },
})

export const updateStaffPasswordRoute = createRoute({
  method: 'patch',
  path: '/{id}/password',
  tags: ['Staff'],
  summary: 'Update staff password',
  security: tenantSecurity,
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: staffPasswordBodySchema } },
    },
  },
  responses: {
    200: {
      description: 'Password updated',
      content: { 'application/json': { schema: successResponseSchema } },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
})

export const deleteStaffRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Staff'],
  summary: 'Deactivate staff member',
  security: tenantSecurity,
  request: { params: idParamSchema },
  responses: {
    200: {
      description: 'Staff deactivated',
      content: { 'application/json': { schema: successResponseSchema } },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
})

export const getStaffBookingAvailabilityRoute = createRoute({
  method: 'get',
  path: '/booking-availability',
  tags: ['Staff'],
  summary: 'Staff booking availability for a slot',
  security: tenantSecurity,
  request: { query: bookingAvailabilityQuerySchema },
  responses: {
    200: {
      description: 'Per-staff availability for the requested slot',
      content: {
        'application/json': { schema: staffBookingAvailabilityResponseSchema },
      },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
})

export const getStaffScheduleRoute = createRoute({
  method: 'get',
  path: '/{id}/schedule',
  tags: ['Staff'],
  summary: 'Get staff schedule bundle',
  security: tenantSecurity,
  request: { params: idParamSchema },
  responses: {
    200: {
      description: 'Weekly schedule and salon business hours',
      content: {
        'application/json': { schema: staffScheduleBundleResponseSchema },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
})

export const updateStaffScheduleRoute = createRoute({
  method: 'put',
  path: '/{id}/schedule',
  tags: ['Staff'],
  summary: 'Update staff schedule',
  security: tenantSecurity,
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: staffScheduleBodySchema } },
    },
  },
  responses: {
    200: {
      description: 'Updated weekly schedule',
      content: {
        'application/json': { schema: staffScheduleUpdateResponseSchema },
      },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
})

export const updateStaffServicesRoute = createRoute({
  method: 'patch',
  path: '/{id}/services',
  tags: ['Staff'],
  summary: 'Update staff service assignments',
  security: tenantSecurity,
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: staffServiceIdsBodySchema } },
    },
  },
  responses: {
    200: {
      description: 'Updated staff with service assignments',
      content: { 'application/json': { schema: staffMemberResponseSchema } },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
})
