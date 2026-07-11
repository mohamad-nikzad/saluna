import { createRoute } from '@hono/zod-openapi'
import { apiErrorSchema } from '../schemas/common'
import {
  publicAppointmentRequestBodySchema,
  publicAppointmentRequestCreatedSchema,
  publicAppointmentRequestStatusViewSchema,
  publicAvailabilityQuerySchema,
  publicAvailabilityResponseSchema,
  publicCancelAppointmentRequestResponseSchema,
  publicSalonViewSchema,
  publicSlugParamSchema,
  publicSlugTokenParamSchema,
} from '../schemas/public'

const notFoundResponse = {
  description: 'Salon, service, or appointment request not found',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const validationErrorResponse = {
  description: 'Invalid request body or parameters',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const forbiddenResponse = {
  description: 'Public booking is disabled for this salon',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const rateLimitedResponse = {
  description: 'Too many public booking submissions from this IP',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const conflictResponse = {
  description: 'Appointment request cannot be cancelled in its current state',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

export const getPublicSalonRoute = createRoute({
  method: 'get',
  path: '/salons/{slug}',
  tags: ['Public booking'],
  summary: 'Get public salon page data',
  description:
    'Unauthenticated salon profile, public page settings, and visible services for the booking site.',
  request: { params: publicSlugParamSchema },
  responses: {
    200: {
      description: 'Public salon view',
      content: { 'application/json': { schema: publicSalonViewSchema } },
    },
    404: notFoundResponse,
  },
})

export const getPublicAvailabilityRoute = createRoute({
  method: 'get',
  path: '/salons/{slug}/availability',
  tags: ['Public booking'],
  summary: 'Search public booking availability',
  description:
    'Returns unioned free slots across staff qualified for the service. Customers do not pick staff in v1.',
  request: {
    params: publicSlugParamSchema,
    query: publicAvailabilityQuerySchema,
  },
  responses: {
    200: {
      description: 'Day or nearest availability slots',
      content: {
        'application/json': { schema: publicAvailabilityResponseSchema },
      },
    },
    400: validationErrorResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
})

export const createPublicAppointmentRequestRoute = createRoute({
  method: 'post',
  path: '/salons/{slug}/appointment-requests',
  tags: ['Public booking'],
  summary: 'Submit a public appointment request',
  request: {
    params: publicSlugParamSchema,
    body: {
      required: true,
      content: {
        'application/json': { schema: publicAppointmentRequestBodySchema },
      },
    },
  },
  responses: {
    201: {
      description: 'Request created; token authorizes status lookup and cancel',
      content: {
        'application/json': { schema: publicAppointmentRequestCreatedSchema },
      },
    },
    400: validationErrorResponse,
    404: notFoundResponse,
    429: rateLimitedResponse,
  },
})

export const getPublicAppointmentRequestRoute = createRoute({
  method: 'get',
  path: '/salons/{slug}/appointment-requests/{token}',
  tags: ['Public booking'],
  summary: 'Get public appointment request status',
  description:
    'Token-authorized status view. Customer identity fields are intentionally omitted.',
  request: { params: publicSlugTokenParamSchema },
  responses: {
    200: {
      description: 'Appointment request status for the customer',
      content: {
        'application/json': {
          schema: publicAppointmentRequestStatusViewSchema,
        },
      },
    },
    404: notFoundResponse,
  },
})

export const cancelPublicAppointmentRequestRoute = createRoute({
  method: 'post',
  path: '/salons/{slug}/appointment-requests/{token}/cancel',
  tags: ['Public booking'],
  summary: 'Cancel a pending public appointment request',
  request: { params: publicSlugTokenParamSchema },
  responses: {
    200: {
      description: 'Request cancelled',
      content: {
        'application/json': {
          schema: publicCancelAppointmentRequestResponseSchema,
        },
      },
    },
    404: notFoundResponse,
    409: conflictResponse,
  },
})
