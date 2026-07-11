import { createRoute } from '@hono/zod-openapi'
import {
  apiErrorSchema,
  idParamSchema,
  tenantSecurity,
} from '../schemas/common'
import {
  appointmentCreateBodySchema,
  appointmentDeleteResponseSchema,
  appointmentResponseSchema,
  appointmentUpdateBodySchema,
  appointmentUpdateResponseSchema,
  appointmentsListQuerySchema,
  appointmentsListResponseSchema,
  availabilityQuerySchema,
  availabilityResponseSchema,
  completePlaceholderClientBodySchema,
  completePlaceholderClientResponseSchema,
  duplicateClientErrorSchema,
} from '../schemas/appointments'

const unauthorizedResponse = {
  description: 'Missing or invalid session',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const forbiddenResponse = {
  description: 'Authenticated but missing required permission',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const notFoundResponse = {
  description: 'Appointment not found',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const validationErrorResponse = {
  description: 'Invalid request body or parameters',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const duplicatePhoneResponse = {
  description: 'Phone number already registered for another client',
  content: { 'application/json': { schema: duplicateClientErrorSchema } },
} as const

export const listAppointmentsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Appointments'],
  summary: 'List appointments in date range',
  security: tenantSecurity,
  request: { query: appointmentsListQuerySchema },
  responses: {
    200: {
      description: 'Appointments with client, staff, and service details',
      content: {
        'application/json': { schema: appointmentsListResponseSchema },
      },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
})

export const createAppointmentRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Appointments'],
  summary: 'Create appointment',
  security: tenantSecurity,
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: appointmentCreateBodySchema } },
    },
  },
  responses: {
    200: {
      description: 'Created appointment with details',
      content: { 'application/json': { schema: appointmentResponseSchema } },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
})

export const getAppointmentAvailabilityRoute = createRoute({
  method: 'get',
  path: '/availability',
  tags: ['Appointments'],
  summary: 'Search manager booking availability',
  security: tenantSecurity,
  request: { query: availabilityQuerySchema },
  responses: {
    200: {
      description: 'Day or nearest availability slots',
      content: { 'application/json': { schema: availabilityResponseSchema } },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
})

export const getAppointmentRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Appointments'],
  summary: 'Get appointment by id',
  security: tenantSecurity,
  request: { params: idParamSchema },
  responses: {
    200: {
      description: 'Appointment with details',
      content: { 'application/json': { schema: appointmentResponseSchema } },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
})

export const updateAppointmentRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  tags: ['Appointments'],
  summary: 'Update appointment or status',
  description:
    'Managers may update any field. Staff may patch status on their own appointments. ' +
    'Cancelling a placeholder appointment may return a cleanup payload instead of an appointment.',
  security: tenantSecurity,
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: appointmentUpdateBodySchema } },
    },
  },
  responses: {
    200: {
      description: 'Updated appointment or cleanup result',
      content: {
        'application/json': { schema: appointmentUpdateResponseSchema },
      },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
})

export const deleteAppointmentRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Appointments'],
  summary: 'Delete appointment',
  security: tenantSecurity,
  request: { params: idParamSchema },
  responses: {
    200: {
      description: 'Deletion result',
      content: {
        'application/json': { schema: appointmentDeleteResponseSchema },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
})

export const completePlaceholderClientRoute = createRoute({
  method: 'post',
  path: '/{id}/complete-client',
  tags: ['Appointments'],
  summary: 'Complete placeholder client on appointment',
  security: tenantSecurity,
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: {
        'application/json': { schema: completePlaceholderClientBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Updated appointment after client completion',
      content: {
        'application/json': { schema: completePlaceholderClientResponseSchema },
      },
    },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
    409: duplicatePhoneResponse,
  },
})
