import { z } from '@hono/zod-openapi'
import { presencePatchSchema } from '@repo/salon-core/forms/presence'

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

export const salonPresenceSchema = z
  .object({
    address: z.string().nullable(),
    mapGoogle: z.string().nullable(),
    mapNeshan: z.string().nullable(),
    mapBalad: z.string().nullable(),
    socialInstagram: z.string().nullable(),
    socialTelegram: z.string().nullable(),
    socialWhatsapp: z.string().nullable(),
    website: z.string().nullable(),
  })
  .openapi('SalonPresence')

export const salonPresenceResponseSchema = z
  .object({
    presence: salonPresenceSchema,
  })
  .openapi('SalonPresenceResponse')

export const salonPresencePatchBodySchema = bodyFromCoreSchema(
  'SalonPresencePatchRequest',
  {
    address: z.string().optional(),
    mapGoogle: z.string().optional(),
    mapNeshan: z.string().optional(),
    mapBalad: z.string().optional(),
    socialInstagram: z.string().optional(),
    socialTelegram: z.string().optional(),
    socialWhatsapp: z.string().optional(),
    website: z.string().optional(),
  },
  presencePatchSchema,
)
