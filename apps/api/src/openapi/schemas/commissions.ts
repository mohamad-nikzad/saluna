import { z } from '@hono/zod-openapi'

import {
  reportingPeriodDateFields,
  reportingPeriodField,
} from './reporting-period'

export const commissionPeriodQuerySchema = z
  .object({
    period: reportingPeriodField('today'),
    ...reportingPeriodDateFields,
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

export const serviceCommissionOverrideBodySchema = z
  .object({
    percentage: z
      .number()
      .gt(0)
      .max(100)
      .multipleOf(0.01)
      .openapi({ example: 30, multipleOf: 0.01 }),
  })
  .openapi('ServiceCommissionOverrideRequest')

export const staffServiceOverrideParamSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .openapi({
        param: { name: 'id', in: 'path' },
        example: '550e8400-e29b-41d4-a716-446655440000',
      }),
    serviceId: z
      .string()
      .min(1)
      .openapi({
        param: { name: 'serviceId', in: 'path' },
        example: '550e8400-e29b-41d4-a716-446655440000',
      }),
  })
  .openapi('StaffServiceOverrideParam')

const serviceCommissionOverrideShape = {
  serviceId: z.string(),
  serviceName: z.string(),
  serviceActive: z.boolean(),
  percentage: z.number(),
}

export const serviceCommissionOverrideSchema = z
  .object(serviceCommissionOverrideShape)
  .openapi('ServiceCommissionOverride')

const commissionAgreementShape = {
  staffProfileId: z.string(),
  percentage: z.number(),
  active: z.boolean(),
  activatedAt: z.string(),
  disabledAt: z.string().nullable(),
  overrides: z.array(z.object(serviceCommissionOverrideShape)),
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
