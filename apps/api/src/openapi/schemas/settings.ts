import { z } from '@hono/zod-openapi'
import { businessSettingsSchema } from '@repo/salon-core/forms/settings'

import { businessHoursSchema } from './staff'

function bodyFromCoreSchema<T extends z.ZodType>(
  name: string,
  shape: z.ZodRawShape,
  coreSchema: T,
) {
  return z
    .object(shape)
    .openapi(name)
    .superRefine((data, ctx) => {
      const result = coreSchema.safeParse(data)
      if (!result.success) {
        for (const issue of result.error.issues) {
          ctx.addIssue({
            code: 'custom',
            message: issue.message,
            path: issue.path,
          })
        }
      }
    })
    .transform((data) => coreSchema.parse(data))
}

export const businessSettingsBodySchema = bodyFromCoreSchema(
  'BusinessSettingsUpdateRequest',
  {
    workingStart: z.string().optional().openapi({ example: '09:00' }),
    workingEnd: z.string().optional().openapi({ example: '19:00' }),
    slotDurationMinutes: z.number().int().optional().openapi({ example: 30 }),
    workingDays: z.number().int().optional().openapi({ example: 126 }),
  },
  businessSettingsSchema,
)

export const businessSettingsResponseSchema = z
  .object({
    settings: businessHoursSchema,
  })
  .openapi('BusinessSettingsResponse')

const closureDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .openapi({ example: '2026-08-01' })

export const salonClosureRangeSchema = z
  .object({
    startDate: closureDateSchema,
    endDate: closureDateSchema,
  })
  .openapi('SalonClosureRange')

export const closeSalonDatesBodySchema = salonClosureRangeSchema
  .extend({ confirmed: z.boolean().optional().default(false) })
  .openapi('CloseSalonDatesRequest')

export const salonClosuresResponseSchema = z
  .object({ closures: z.array(closureDateSchema) })
  .openapi('SalonClosuresResponse')

export const changedSalonClosureDatesResponseSchema = z
  .object({ dates: z.array(closureDateSchema) })
  .openapi('ChangedSalonClosureDatesResponse')

export const salonClosureWarningSchema = z
  .object({
    error: z.string(),
    code: z.literal('CLOSURE_CONFIRMATION_REQUIRED'),
    appointmentCount: z.number().int().nonnegative(),
    appointmentsByDate: z.array(
      z.object({
        date: closureDateSchema,
        count: z.number().int().positive(),
      }),
    ),
  })
  .openapi('SalonClosureWarning')
