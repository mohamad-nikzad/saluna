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

export const presetVariantSchema = z.object({
  name: requiredTextSchema,
  duration: durationMinutesSchema,
  price: nonNegativeMoneySchema,
  color: calendarColorIdSchema,
  description: optionalTrimmedTextSchema.optional(),
})

export const presetFamilySchema = z.object({
  name: requiredTextSchema,
  variants: z.array(presetVariantSchema).min(1),
})

export const presetCategorySchema = z.object({
  name: requiredTextSchema,
  families: z.array(presetFamilySchema).min(1),
})

export const presetTreeSchema = z.array(presetCategorySchema).min(1)

export type PresetVariantInput = z.input<typeof presetVariantSchema>
export type PresetVariantPayload = z.output<typeof presetVariantSchema>
export type PresetFamilyInput = z.input<typeof presetFamilySchema>
export type PresetFamilyPayload = z.output<typeof presetFamilySchema>
export type PresetCategoryInput = z.input<typeof presetCategorySchema>
export type PresetCategoryPayload = z.output<typeof presetCategorySchema>
export type CatalogPresetTreeInput = z.input<typeof presetTreeSchema>
export type CatalogPresetTree = z.output<typeof presetTreeSchema>
