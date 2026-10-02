import { z } from '@hono/zod-openapi'

import {
  reportingPeriodDateFields,
  reportingPeriodField,
} from './reporting-period'

export const salonMoneyReportQuerySchema = z
  .object({
    period: reportingPeriodField('month'),
    ...reportingPeriodDateFields,
    staffProfileId: z
      .string()
      .optional()
      .openapi({ param: { name: 'staffProfileId', in: 'query' } }),
    serviceId: z
      .string()
      .optional()
      .openapi({ param: { name: 'serviceId', in: 'query' } }),
    categoryId: z
      .string()
      .optional()
      .openapi({ param: { name: 'categoryId', in: 'query' } }),
  })
  .openapi('SalonMoneyReportQuery')

const salonMoneyReportAppointmentCommissionSchema = z.object({
  staffProfileId: z.string(),
  staffName: z.string(),
  basis: z.number().int(),
  percentage: z.number(),
  amount: z.number().int(),
})

export const salonMoneyReportSchema = z
  .object({
    startDate: z.string(),
    endDate: z.string(),
    summary: z.object({
      bookedTotal: z.number().int(),
      staffCommissionTotal: z.number().int(),
      salonRetainedAmount: z.number().int(),
    }),
    staff: z.array(
      z.object({
        staffProfileId: z.string(),
        staffName: z.string(),
        completedCount: z.number().int(),
        commissionBasisTotal: z.number().int(),
        staffCommissionTotal: z.number().int(),
      }),
    ),
    appointments: z.array(
      z.object({
        appointmentId: z.string(),
        date: z.string(),
        clientName: z.string(),
        serviceName: z.string(),
        staffNames: z.array(z.string()),
        bookedTotal: z.number().int(),
        commissions: z.array(salonMoneyReportAppointmentCommissionSchema),
      }),
    ),
  })
  .openapi('SalonMoneyReport')

export const salonMoneyReportResponseSchema = z
  .object({ report: salonMoneyReportSchema })
  .openapi('SalonMoneyReportResponse')
