import { createRoute } from '@hono/zod-openapi'

import {
  apiErrorSchema,
  idParamSchema,
  tenantSecurity,
} from '../schemas/common'
import {
  commissionAgreementBodySchema,
  commissionAgreementResponseSchema,
  commissionPeriodQuerySchema,
  salonCommissionReportResponseSchema,
  staffCommissionReportResponseSchema,
} from '../schemas/commissions'

const errors = {
  400: {
    description: 'Invalid percentage or report period',
    content: { 'application/json': { schema: apiErrorSchema } },
  },
  401: {
    description: 'Missing or invalid session',
    content: { 'application/json': { schema: apiErrorSchema } },
  },
  403: {
    description: 'Authenticated but not authorized for this report or write',
    content: { 'application/json': { schema: apiErrorSchema } },
  },
  404: {
    description: 'Staff Profile or Commission Agreement not found in salon',
    content: { 'application/json': { schema: apiErrorSchema } },
  },
} as const

export const putCommissionAgreementRoute = createRoute({
  method: 'put',
  path: '/staff/{id}/agreement',
  tags: ['Staff Commissions'],
  summary: 'Activate or change a Staff Profile Commission Agreement',
  security: tenantSecurity,
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: {
        'application/json': { schema: commissionAgreementBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Active Commission Agreement',
      content: {
        'application/json': { schema: commissionAgreementResponseSchema },
      },
    },
    ...errors,
  },
})

export const deleteCommissionAgreementRoute = createRoute({
  method: 'delete',
  path: '/staff/{id}/agreement',
  tags: ['Staff Commissions'],
  summary: 'Disable a Staff Profile Commission Agreement',
  security: tenantSecurity,
  request: { params: idParamSchema },
  responses: {
    200: {
      description: 'Disabled Commission Agreement',
      content: {
        'application/json': { schema: commissionAgreementResponseSchema },
      },
    },
    ...errors,
  },
})

export const getStaffCommissionReportRoute = createRoute({
  method: 'get',
  path: '/staff/{id}/report',
  tags: ['Staff Commissions'],
  summary: 'Get a manager-visible Staff Profile commission report',
  security: tenantSecurity,
  request: { params: idParamSchema, query: commissionPeriodQuerySchema },
  responses: {
    200: {
      description: 'Per-staff Commission report',
      content: {
        'application/json': { schema: staffCommissionReportResponseSchema },
      },
    },
    ...errors,
  },
})

export const getMyCommissionReportRoute = createRoute({
  method: 'get',
  path: '/me',
  tags: ['Staff Commissions'],
  summary: 'Get the active staff identity own Commission report',
  security: tenantSecurity,
  request: { query: commissionPeriodQuerySchema },
  responses: {
    200: {
      description: 'Private self Commission report',
      content: {
        'application/json': { schema: staffCommissionReportResponseSchema },
      },
    },
    ...errors,
  },
})

export const getSalonCommissionReportRoute = createRoute({
  method: 'get',
  path: '/salon',
  tags: ['Staff Commissions'],
  summary: 'Get the manager-only salon Commission report',
  security: tenantSecurity,
  request: { query: commissionPeriodQuerySchema },
  responses: {
    200: {
      description: 'Salon-wide Commission report',
      content: {
        'application/json': { schema: salonCommissionReportResponseSchema },
      },
    },
    ...errors,
  },
})
