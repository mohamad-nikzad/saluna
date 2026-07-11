import { z } from '@hono/zod-openapi'
import { appointmentWithDetailsSchema } from './clients'
import { appointmentStatusSchema } from './dashboard'

export const todayQuerySchema = z
  .object({
    date: z
      .string()
      .optional()
      .openapi({
        param: { name: 'date', in: 'query' },
        example: '2026-06-07',
        description:
          'Calendar date (YYYY-MM-DD). Defaults to salon local today.',
      }),
  })
  .openapi('TodayQuery')

export const todayAttentionItemSchema = z
  .object({
    id: z.string(),
    type: z.enum([
      'soon',
      'overdue',
      'no-show-risk',
      'first-time',
      'vip',
      'incomplete-client',
    ]),
    title: z.string(),
    detail: z.string(),
    appointmentId: z.string().optional(),
    clientId: z.string().optional(),
    priority: z.number(),
  })
  .openapi('TodayAttentionItem')

export const todayStaffLoadSchema = z
  .object({
    staffId: z.string(),
    staffName: z.string(),
    appointmentCount: z.number(),
    bookedMinutes: z.number(),
  })
  .openapi('TodayStaffLoad')

export const todayOpenSlotRangeSchema = z
  .object({
    startTime: z.string(),
    endTime: z.string(),
  })
  .openapi('TodayOpenSlotRange')

export const todayOpenSlotSchema = z
  .object({
    staffId: z.string(),
    staffName: z.string(),
    ranges: z.array(todayOpenSlotRangeSchema),
  })
  .openapi('TodayOpenSlot')

export const todayCountsSchema = z
  .object({
    scheduled: z.number(),
    confirmed: z.number(),
    completed: z.number(),
    cancelled: z.number(),
    'no-show': z.number(),
  })
  .openapi('TodayCounts')

export const todayDataSchema = z
  .object({
    date: z.string(),
    counts: todayCountsSchema,
    appointments: z.array(appointmentWithDetailsSchema),
    attentionItems: z.array(todayAttentionItemSchema),
    staffLoad: z.array(todayStaffLoadSchema),
    openSlots: z.array(todayOpenSlotSchema),
  })
  .openapi('TodayData')
