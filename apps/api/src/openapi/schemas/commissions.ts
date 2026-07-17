import { z } from '@hono/zod-openapi'

export const commissionPeriodQuerySchema = z
  .object({
    period: z
      .enum(['today', 'week', 'month', 'custom'])
      .default('today')
      .openapi({ param: { name: 'period', in: 'query' } }),
    startDate: z
      .string()
      .optional()
      .openapi({ param: { name: 'startDate', in: 'query' } }),
    endDate: z
      .string()
      .optional()
      .openapi({ param: { name: 'endDate', in: 'query' } }),
    staffProfileId: z
      .string()
      .optional()
      .openapi({ param: { name: 'staffProfileId', in: 'query' } }),
  })
  .openapi('CommissionPeriodQuery')

export const commissionAgreementBodySchema = z
  .object({
    percentage: z
      .number()
      .gt(0)
      .max(100)
      .multipleOf(0.01)
      .openapi({ example: 20, multipleOf: 0.01 }),
  })
  .openapi('CommissionAgreementRequest')

const commissionAgreementShape = {
  staffProfileId: z.string(),
  percentage: z.number(),
  active: z.boolean(),
  activatedAt: z.string(),
  disabledAt: z.string().nullable(),
}

export const commissionAgreementSchema = z
  .object(commissionAgreementShape)
  .openapi('CommissionAgreement')

export const commissionAgreementResponseSchema = z
  .object({ agreement: commissionAgreementSchema })
  .openapi('CommissionAgreementResponse')

export const staffCommissionReportRowSchema = z
  .object({
    appointmentId: z.string(),
    date: z.string(),
    clientName: z.string(),
    serviceName: z.string(),
    basis: z.number().int(),
    percentage: z.number(),
    amount: z.number().int(),
  })
  .openapi('StaffCommissionReportRow')

export const staffCommissionReportSchema = z
  .object({
    staffProfileId: z.string(),
    staffName: z.string(),
    agreement: z.object(commissionAgreementShape).nullable(),
    startDate: z.string(),
    endDate: z.string(),
    summary: z.object({
      completedCount: z.number().int(),
      grossAppointmentRevenue: z.number().int(),
      staffCommissionTotal: z.number().int(),
    }),
    rows: z.array(staffCommissionReportRowSchema),
  })
  .openapi('StaffCommissionReport')

export const staffCommissionReportResponseSchema = z
  .object({ report: staffCommissionReportSchema })
  .openapi('StaffCommissionReportResponse')

export const salonCommissionReportSchema = z
  .object({
    startDate: z.string(),
    endDate: z.string(),
    summary: z.object({
      grossAppointmentRevenue: z.number().int(),
      staffCommissionTotal: z.number().int(),
      salonRetainedAmount: z.number().int(),
    }),
    staff: z.array(
      z.object({
        staffProfileId: z.string(),
        staffName: z.string(),
        completedCount: z.number().int(),
        grossAppointmentRevenue: z.number().int(),
        staffCommissionTotal: z.number().int(),
      }),
    ),
    rows: z.array(
      staffCommissionReportRowSchema.extend({ staffProfileId: z.string() }),
    ),
  })
  .openapi('SalonCommissionReport')

export const salonCommissionReportResponseSchema = z
  .object({ report: salonCommissionReportSchema })
  .openapi('SalonCommissionReportResponse')
