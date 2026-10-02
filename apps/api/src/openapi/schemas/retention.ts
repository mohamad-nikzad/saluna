import { z } from '@hono/zod-openapi'
import {
  clientFollowUpSchema,
  clientSchema,
  followUpReasonSchema,
  followUpStatusSchema,
} from './clients'

export const retentionItemSchema = z
  .object({
    id: z.string(),
    client: clientSchema,
    reason: followUpReasonSchema,
    status: followUpStatusSchema,
    dueDate: z.string(),
    occurrenceYear: z.number().int().nullable(),
    lastVisitDate: z.string().nullable(),
    lastServiceName: z.string().nullable(),
    completedCount: z.number(),
    estimatedSpend: z.number(),
    noShowCount: z.number(),
    suggestedReason: z.string(),
  })
  .openapi('RetentionItem')

export const retentionListResponseSchema = z
  .object({
    items: z.array(retentionItemSchema),
  })
  .openapi('RetentionListResponse')

export const retentionUpdateBodySchema = z
  .object({
    status: followUpStatusSchema,
  })
  .openapi('RetentionUpdateRequest')

export const retentionUpdateResponseSchema = z
  .object({
    followUp: clientFollowUpSchema,
  })
  .openapi('RetentionUpdateResponse')

export const retentionBaleMessageBodySchema = z
  .object({
    retry: z.boolean().optional().default(false),
    message: z.string().trim().min(1).max(500).optional(),
  })
  .openapi('RetentionBaleMessageRequest')

export const retentionMessageDeliverySchema = z
  .object({
    id: z.string(),
    provider: z.enum(['bale_safir', 'sms_ir']),
    status: z.enum(['sent', 'failed', 'skipped']),
    providerMessageId: z.string().nullable(),
    error: z.string().nullable(),
  })
  .openapi('RetentionMessageDelivery')

export const retentionBaleMessageResultSchema = z
  .object({
    status: z.enum(['sent', 'failed', 'skipped']),
    providerMessageId: z.string().nullable().optional(),
    error: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
  })
  .openapi('RetentionBaleMessageResult')

export const retentionBaleMessageResponseSchema = z
  .object({
    delivery: retentionMessageDeliverySchema,
    result: retentionBaleMessageResultSchema,
  })
  .openapi('RetentionBaleMessageResponse')

export const retentionSmsMessageBodySchema = z
  .object({
    retry: z.boolean().optional().default(false),
    message: z.string().trim().min(1).max(500),
  })
  .openapi('RetentionSmsMessageRequest')

export const retentionSmsMessageResponseSchema = z
  .object({
    delivery: retentionMessageDeliverySchema,
    result: z.object({
      status: z.enum(['sent', 'failed', 'skipped']),
      provider: z.literal('sms_ir').nullable().optional(),
      providerMessageId: z.string().nullable().optional(),
      error: z.string().nullable().optional(),
    }),
  })
  .openapi('RetentionSmsMessageResponse')
