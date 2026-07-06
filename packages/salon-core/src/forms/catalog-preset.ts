/**
 * Catalog preset (`قالب خدمات`) tree schema — shared between server and UI.
 * Validates the `tree` jsonb column on `catalog_presets` and the picker output.
 */
import { z } from 'zod'

import { calendarColorIdSchema } from './service'
import {
  durationMinutesSchema,
  nonNegativeMoneySchema,
  optionalTrimmedTextSchema,
  requiredTextSchema,
} from './primitives'

export const presetServiceSchema = z.object({
  name: requiredTextSchema,
  duration: durationMinutesSchema,
  price: nonNegativeMoneySchema,
  color: calendarColorIdSchema,
  description: optionalTrimmedTextSchema.optional(),
})

export const presetCategorySchema = z.object({
  name: requiredTextSchema,
  services: z.array(presetServiceSchema).min(1),
})

export const presetTreeSchema = z.array(presetCategorySchema).min(1)

const legacyPresetFamilySchema = z.object({
  name: requiredTextSchema,
  variants: z.array(presetServiceSchema).min(1),
})

const legacyPresetTreeSchema = z.array(
  z.object({
    name: requiredTextSchema,
    families: z.array(legacyPresetFamilySchema).min(1),
  }),
)

export function normalizeCatalogPresetTree(tree: unknown): CatalogPresetTree {
  const flattened = presetTreeSchema.safeParse(tree)
  if (flattened.success) return flattened.data

  const legacy = legacyPresetTreeSchema.parse(tree)
  return legacy.map((category) => ({
    name: category.name,
    services: category.families.flatMap((family) => family.variants),
  }))
}

export type PresetServiceInput = z.input<typeof presetServiceSchema>
export type PresetServicePayload = z.output<typeof presetServiceSchema>
export type PresetCategoryInput = z.input<typeof presetCategorySchema>
export type PresetCategoryPayload = z.output<typeof presetCategorySchema>
export type CatalogPresetTreeInput = z.input<typeof presetTreeSchema>
export type CatalogPresetTree = z.output<typeof presetTreeSchema>

export const applyCatalogPresetBodySchema = z.object({
  selection: z
    .array(
      z.object({
        categoryIndex: z.number().int().nonnegative(),
        serviceIndices: z.array(z.number().int().nonnegative()).min(1),
      }),
    )
    .min(1),
})

export type ApplyCatalogPresetBody = z.infer<
  typeof applyCatalogPresetBodySchema
>
