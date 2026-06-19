/**
 * Service form schema shared by Saluna clients.
 * Normalizes category/color/number fields into API-ready payload values.
 */
import { z } from 'zod'

import { normalizeCalendarColorId } from '../calendar-colors'
import { SERVICE_CATEGORIES, STAFF_COLORS } from '../types'
import { formMessages } from './messages'
import {
  durationMinutesSchema,
  nonNegativeIntegerSchema,
  nonNegativeMoneySchema,
  requiredTextSchema,
} from './primitives'

export const catalogEntityIdSchema = z
  .string({ error: formMessages.required })
  .trim()
  .min(1, formMessages.required)

const SERVICE_CATEGORY_REQUIRED = 'بخش خدمات را انتخاب کنید'

/** Service's required category reference, with a service-specific message. */
export const serviceCategoryIdSchema = z
  .string({ error: SERVICE_CATEGORY_REQUIRED })
  .trim()
  .min(1, SERVICE_CATEGORY_REQUIRED)

/** Optional catalog reference: empty string / null collapses to `undefined`. */
export const optionalCatalogEntityIdSchema = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => {
    const trimmed = typeof value === 'string' ? value.trim() : ''
    return trimmed.length > 0 ? trimmed : undefined
  })

/**
 * Nullable catalog reference for patch payloads: preserves the `null` vs
 * `undefined` distinction so the API can tell "clear this field" (`null`)
 * apart from "leave it alone" (`undefined`). Empty / whitespace strings
 * are treated as `null` (clear).
 */
export const nullableCatalogEntityIdSchema = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined
    if (value === null) return null
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  })

const legacyServiceCategoryKeys = Object.keys(SERVICE_CATEGORIES) as [
  keyof typeof SERVICE_CATEGORIES,
  ...(keyof typeof SERVICE_CATEGORIES)[],
]

export const serviceCategorySchema = z.enum(legacyServiceCategoryKeys, {
  error: formMessages.required,
})

export const calendarColorIdSchema = z
  .string({ error: formMessages.required })
  .trim()
  .min(1, formMessages.required)
  .transform((value) => normalizeCalendarColorId(value))

export const serviceFormSchema = z.object({
  name: requiredTextSchema,
  categoryId: serviceCategoryIdSchema,
  familyId: optionalCatalogEntityIdSchema,
  category: serviceCategorySchema.default('hair'),
  duration: durationMinutesSchema,
  price: nonNegativeMoneySchema,
  color: calendarColorIdSchema.default(STAFF_COLORS[0]),
  active: z.boolean().default(true),
  description: z.string().trim().optional(),
  kind: z.enum(['standard', 'combo']).default('standard'),
})

export const serviceCreateSchema = serviceFormSchema.extend({
  id: z.string().optional(),
})

export const serviceUpdateSchema = z.object({
  name: requiredTextSchema.optional(),
  categoryId: serviceCategoryIdSchema.optional(),
  familyId: nullableCatalogEntityIdSchema,
  duration: durationMinutesSchema.optional(),
  price: nonNegativeMoneySchema.optional(),
  color: calendarColorIdSchema.optional(),
  active: z.boolean().optional(),
  description: z.string().trim().optional(),
  kind: z.enum(['standard', 'combo']).optional(),
})

export const serviceCategoryFormSchema = z.object({
  name: requiredTextSchema,
  active: z.boolean().default(true),
})

export const serviceCategoryCreateSchema = serviceCategoryFormSchema.extend({
  id: z.string().optional(),
})

export const serviceCategoryUpdateSchema = z.object({
  name: requiredTextSchema.optional(),
  active: z.boolean().optional(),
})

export const serviceFamilyFormSchema = z.object({
  categoryId: catalogEntityIdSchema,
  name: requiredTextSchema,
  active: z.boolean().default(true),
})

export const serviceFamilyCreateSchema = serviceFamilyFormSchema.extend({
  id: z.string().optional(),
})

export const serviceFamilyUpdateSchema = z.object({
  categoryId: catalogEntityIdSchema.optional(),
  name: requiredTextSchema.optional(),
  active: z.boolean().optional(),
})

export const comboComponentsUpdateSchema = z.object({
  componentServiceIds: z.array(catalogEntityIdSchema).default([]),
})

export const serviceAddonScopeInputSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('category'),
    categoryId: catalogEntityIdSchema,
  }),
  z.object({
    type: z.literal('family'),
    familyId: catalogEntityIdSchema,
  }),
  z.object({
    type: z.literal('service'),
    serviceId: catalogEntityIdSchema,
  }),
])

const serviceAddonBaseSchema = z.object({
  name: requiredTextSchema,
  priceDelta: nonNegativeMoneySchema.default(0),
  durationDelta: nonNegativeIntegerSchema.default(0),
  active: z.boolean().default(true),
  sortOrder: nonNegativeIntegerSchema.default(0),
  description: z.string().trim().optional(),
  color: z.string().trim().optional().nullable(),
  scopes: z.array(serviceAddonScopeInputSchema).default([]),
})

export const serviceAddonFormSchema = serviceAddonBaseSchema.refine(
  (value) => value.priceDelta > 0 || value.durationDelta > 0,
  {
    message: 'قیمت یا زمان افزوده باید بیشتر از صفر باشد',
    path: ['priceDelta'],
  },
)

export type ServiceAddonFormInput = z.input<typeof serviceAddonFormSchema>
export type ServiceAddonFormPayload = z.output<typeof serviceAddonFormSchema>

export const serviceAddonCreateSchema = serviceAddonBaseSchema
  .extend({
    id: z.string().optional(),
  })
  .refine((value) => value.priceDelta > 0 || value.durationDelta > 0, {
    message: 'قیمت یا زمان افزوده باید بیشتر از صفر باشد',
    path: ['priceDelta'],
  })

export const serviceAddonUpdateSchema = z
  .object({
    name: requiredTextSchema.optional(),
    priceDelta: nonNegativeMoneySchema.optional(),
    durationDelta: nonNegativeIntegerSchema.optional(),
    active: z.boolean().optional(),
    sortOrder: nonNegativeIntegerSchema.optional(),
    description: z.string().trim().optional(),
    color: z.string().trim().optional().nullable(),
    scopes: z.array(serviceAddonScopeInputSchema).optional(),
  })
  .refine(
    (value) =>
      value.priceDelta === undefined ||
      value.durationDelta === undefined ||
      value.priceDelta > 0 ||
      value.durationDelta > 0,
    {
      message: 'قیمت یا زمان افزوده باید بیشتر از صفر باشد',
      path: ['priceDelta'],
    },
  )

export type ServiceFormInput = z.input<typeof serviceFormSchema>
export type ServiceFormPayload = z.output<typeof serviceFormSchema>
export type ServiceCreateInput = z.input<typeof serviceCreateSchema>
export type ServiceCreatePayload = z.output<typeof serviceCreateSchema>
export type ServiceUpdateInput = z.input<typeof serviceUpdateSchema>
export type ServiceUpdatePayload = z.output<typeof serviceUpdateSchema>
export type ServiceCategoryCreateInput = z.input<
  typeof serviceCategoryCreateSchema
>
export type ServiceCategoryCreatePayload = z.output<
  typeof serviceCategoryCreateSchema
>
export type ServiceCategoryUpdateInput = z.input<
  typeof serviceCategoryUpdateSchema
>
export type ServiceCategoryUpdatePayload = z.output<
  typeof serviceCategoryUpdateSchema
>
export type ServiceFamilyCreateInput = z.input<typeof serviceFamilyCreateSchema>
export type ServiceFamilyCreatePayload = z.output<
  typeof serviceFamilyCreateSchema
>
export type ServiceFamilyUpdateInput = z.input<typeof serviceFamilyUpdateSchema>
export type ServiceFamilyUpdatePayload = z.output<
  typeof serviceFamilyUpdateSchema
>
export type ComboComponentsUpdateInput = z.input<
  typeof comboComponentsUpdateSchema
>
export type ComboComponentsUpdatePayload = z.output<
  typeof comboComponentsUpdateSchema
>
export type ServiceAddonScopeInput = z.input<
  typeof serviceAddonScopeInputSchema
>
export type ServiceAddonScopePayload = z.output<
  typeof serviceAddonScopeInputSchema
>
export type ServiceAddonCreateInput = z.input<typeof serviceAddonCreateSchema>
export type ServiceAddonCreatePayload = z.output<
  typeof serviceAddonCreateSchema
>
export type ServiceAddonUpdateInput = z.input<typeof serviceAddonUpdateSchema>
export type ServiceAddonUpdatePayload = z.output<
  typeof serviceAddonUpdateSchema
>
