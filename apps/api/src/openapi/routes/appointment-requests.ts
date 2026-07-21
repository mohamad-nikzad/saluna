import { createRoute } from '@hono/zod-openapi'
import {
  apiErrorSchema,
  idParamSchema,
  tenantSecurity,
} from '../schemas/common'
import {
  approveAppointmentRequestBodySchema,
  approveAppointmentRequestResponseSchema,
  cancelAppointmentRequestBodySchema,
  cancelAppointmentRequestResponseSchema,
  appointmentRequestsListQuerySchema,
  appointmentRequestsListResponseSchema,
  createFlexibleAppointmentRequestBodySchema,
  createFlexibleAppointmentRequestResponseSchema,
  rejectAppointmentRequestBodySchema,
  rejectAppointmentRequestResponseSchema,
  renewTerminalAppointmentRequestBodySchema,
  renewTerminalAppointmentRequestResponseSchema,
  updateFlexibleAppointmentRequestBodySchema,
  updateFlexibleAppointmentRequestResponseSchema,
} from '../schemas/appointment-requests'

const unauthorizedResponse = {
  description: 'Missing or invalid session',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const forbiddenResponse = {
  description: 'Authenticated but missing manage_appointments permission',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const notFoundResponse = {
  description: 'Appointment request not found or no longer pending',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const validationErrorResponse = {
  description: 'Invalid request body or parameters',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const conflictResponse = {
  description: 'Slot no longer available or intake validation failed',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

export const listAppointmentRequestsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Appointment requests'],
  summary: 'List appointment requests',
  description:
    'Manager inbox for public booking requests. Pending filter excludes past requested dates.',
  security: tenantSecurity,
  request: { query: appointmentRequestsListQuerySchema },
  responses: {
    200: {
      description: 'Appointment requests for the authenticated salon',
      content: {
        'application/json': { schema: appointmentRequestsListResponseSchema },
      },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
})

export const createFlexibleAppointmentRequestRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Appointment requests'],
  summary: 'Record a manager Draft',
  security: tenantSecurity,
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: createFlexibleAppointmentRequestBodySchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Flexible AppointmentRequest recorded',
      content: {
        'application/json': {
          schema: createFlexibleAppointmentRequestResponseSchema,
        },
      },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
})

export const updateFlexibleAppointmentRequestRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  tags: ['Appointment requests'],
  summary: 'Edit a pending manager Draft timing agreement',
  security: tenantSecurity,
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: {
        'application/json': {
          schema: updateFlexibleAppointmentRequestBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Pending flexible AppointmentRequest updated',
      content: {
        'application/json': {
          schema: updateFlexibleAppointmentRequestResponseSchema,
        },
      },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
    409: notFoundResponse,
  },
})

export const renewTerminalAppointmentRequestRoute = createRoute({
  method: 'post',
  path: '/{id}/renew',
  tags: ['Appointment requests'],
  summary: 'Create a new Draft from a terminal request',
  security: tenantSecurity,
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: {
        'application/json': {
          schema: renewTerminalAppointmentRequestBodySchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Renewed flexible AppointmentRequest recorded',
      content: {
        'application/json': {
          schema: renewTerminalAppointmentRequestResponseSchema,
        },
      },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
    409: conflictResponse,
  },
})

export const approveAppointmentRequestRoute = createRoute({
  method: 'post',
  path: '/{id}/approve',
  tags: ['Appointment requests'],
  summary: 'Approve appointment request',
  security: tenantSecurity,
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: {
        'application/json': { schema: approveAppointmentRequestBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Request approved and appointment created',
      content: {
        'application/json': { schema: approveAppointmentRequestResponseSchema },
      },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
    409: conflictResponse,
  },
})

export const rejectAppointmentRequestRoute = createRoute({
  method: 'post',
  path: '/{id}/reject',
  tags: ['Appointment requests'],
  summary: 'Reject appointment request',
  security: tenantSecurity,
  request: {
    params: idParamSchema,
    body: {
      required: false,
      content: {
        'application/json': { schema: rejectAppointmentRequestBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Request rejected',
      content: {
        'application/json': { schema: rejectAppointmentRequestResponseSchema },
      },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
})

export const cancelAppointmentRequestRoute = createRoute({
  method: 'post',
  path: '/{id}/cancel',
  tags: ['Appointment requests'],
  summary: 'Record customer withdrawal from a manager Draft',
  security: tenantSecurity,
  request: {
    params: idParamSchema,
    body: {
      required: false,
      content: {
        'application/json': { schema: cancelAppointmentRequestBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Request cancelled',
      content: {
        'application/json': { schema: cancelAppointmentRequestResponseSchema },
      },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
    409: conflictResponse,
  },
})
