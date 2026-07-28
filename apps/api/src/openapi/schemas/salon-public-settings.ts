import { z } from '@hono/zod-openapi'
import { PUBLIC_LAYOUTS } from '@repo/salon-core/public-layouts'
import { PUBLIC_THEMES } from '@repo/salon-core/public-themes'
import { publicSettingsSchema } from '@repo/salon-core/forms/public'
import { slugUpdateSchema } from '@repo/salon-core/forms/slug'

import { serviceSchema } from './services'

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

const themeIdSchema = z.enum(
  PUBLIC_THEMES.map((theme) => theme.id) as [string, ...string[]],
)

const layoutIdSchema = z.enum(
  PUBLIC_LAYOUTS.map((layout) => layout.id) as [string, ...string[]],
)

const serviceVisibilitySchema = z
  .object({
    serviceId: z.string(),
    visible: z.boolean(),
  })
  .openapi('ServiceVisibilityInput')

export const managerPublicSettingsViewSchema = z
  .object({
    enabled: z.boolean(),
    bioText: z.string().nullable(),
    themeId: z.string(),
    layoutId: z.string(),
    appointmentRequestsEnabled: z.boolean(),
  })
  .openapi('ManagerPublicSettingsView')

export const managerServiceVisibilitySchema = z
  .object({
    service: serviceSchema,
    visible: z.boolean(),
  })
  .openapi('ManagerServiceVisibility')

export const managerPublicSettingsResultSchema = z
  .object({
    slug: z.string(),
    salonName: z.string(),
    phone: z.string().nullable(),
    settings: managerPublicSettingsViewSchema,
    services: z.array(managerServiceVisibilitySchema),
  })
  .openapi('ManagerPublicSettingsResult')

export const publicSettingsBodySchema = bodyFromCoreSchema(
  'PublicSettingsUpdateRequest',
  {
    enabled: z.boolean().optional(),
    bioText: z.string().nullable().optional(),
    themeId: themeIdSchema.optional(),
    layoutId: layoutIdSchema.optional(),
    appointmentRequestsEnabled: z.boolean().optional(),
    services: z.array(serviceVisibilitySchema).optional(),
  },
  publicSettingsSchema,
)

export const slugUpdateBodySchema = bodyFromCoreSchema(
  'SlugUpdateRequest',
  {
    slug: z.string().openapi({ example: 'my-salon' }),
  },
  slugUpdateSchema,
)
