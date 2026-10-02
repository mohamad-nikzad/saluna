import { z } from '@hono/zod-openapi'

export const reportingPeriodEnum = z.enum([
  'today',
  'week',
  'month',
  'previousMonth',
  'custom',
])

export const reportingPeriodDateFields = {
  startDate: z
    .string()
    .optional()
    .openapi({ param: { name: 'startDate', in: 'query' } }),
  endDate: z
    .string()
    .optional()
    .openapi({ param: { name: 'endDate', in: 'query' } }),
} as const

export function reportingPeriodField(defaultPeriod: 'today' | 'month') {
  return reportingPeriodEnum
    .default(defaultPeriod)
    .openapi({ param: { name: 'period', in: 'query' } })
}
