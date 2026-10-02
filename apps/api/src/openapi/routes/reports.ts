import { createRoute } from '@hono/zod-openapi'

import { apiErrorSchema, tenantSecurity } from '../schemas/common'
import {
  salonMoneyReportQuerySchema,
  salonMoneyReportResponseSchema,
} from '../schemas/reports'

const errors = {
  400: {
    description: 'Invalid report period',
    content: { 'application/json': { schema: apiErrorSchema } },
  },
  401: {
    description: 'Missing or invalid session',
    content: { 'application/json': { schema: apiErrorSchema } },
  },
  403: {
    description: 'Authenticated but not authorized for this report',
    content: { 'application/json': { schema: apiErrorSchema } },
  },
  404: {
    description: 'Staff Profile, service, or category not found in salon',
    content: { 'application/json': { schema: apiErrorSchema } },
  },
} as const

export const getSalonMoneyReportRoute = createRoute({
  method: 'get',
  path: '/salon-money',
  tags: ['Reports'],
  summary: 'Get the manager-only salon money report for completed Appointments',
  security: tenantSecurity,
  request: { query: salonMoneyReportQuerySchema },
  responses: {
    200: {
      description: 'Salon money report for completed Appointments',
      content: {
        'application/json': { schema: salonMoneyReportResponseSchema },
      },
    },
    ...errors,
  },
})
