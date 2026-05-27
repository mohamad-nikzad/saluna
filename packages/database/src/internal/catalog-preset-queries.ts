import { and, asc, eq } from 'drizzle-orm'

import type { CatalogPresetTree } from '@repo/salon-core/forms/catalog-preset'

import { getDb } from '../client'
import {
  catalogPresets,
  presetApplications,
  serviceCategories,
  serviceFamilies,
  services,
} from '../schema'

export type CatalogPresetListItem = {
  id: string
  slug: string
  name: string
  description: string | null
  tree: CatalogPresetTree
  sortOrder: number
  disabled: boolean
  disabledReason: 'collision' | null
}

export type ApplyPresetSelection = Array<{
  categoryIndex: number
  families: Array<{ familyIndex: number; variantIndices: number[] }>
}>

export async function listActiveCatalogPresets(
  salonId: string
): Promise<CatalogPresetListItem[]> {
  const db = getDb()
  const [presetRows, existingCategoryRows] = await Promise.all([
    db
      .select()
      .from(catalogPresets)
      .where(eq(catalogPresets.isActive, true))
      .orderBy(asc(catalogPresets.sortOrder), asc(catalogPresets.name)),
    db
      .select({ name: serviceCategories.name })
      .from(serviceCategories)
      .where(eq(serviceCategories.salonId, salonId)),
  ])

  const existingNames = new Set(existingCategoryRows.map((row) => row.name))

  return presetRows.map((row) => {
    const tree = row.tree as CatalogPresetTree
    const collides = tree.some((category) => existingNames.has(category.name))
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      tree,
      sortOrder: row.sortOrder,
      disabled: collides,
      disabledReason: collides ? 'collision' : null,
    }
  })
}

export async function applyCatalogPreset(input: {
  salonId: string
  presetId: string
  selection: ApplyPresetSelection
}): Promise<{ importedCategoryIds: string[]; importedVariantIds: string[] }> {
  const db = getDb()

  const [preset] = await db
    .select()
    .from(catalogPresets)
    .where(
      and(eq(catalogPresets.id, input.presetId), eq(catalogPresets.isActive, true))
    )
    .limit(1)
  if (!preset) throw new Error('catalog preset not found or inactive')

  const tree = preset.tree as CatalogPresetTree

  const filtered = input.selection
    .map((catSel) => {
      const category = tree[catSel.categoryIndex]
      if (!category) return null
      const families = catSel.families
        .map((famSel) => {
          const family = category.families[famSel.familyIndex]
          if (!family) return null
          const variants = famSel.variantIndices
            .map((vi) => family.variants[vi])
            .filter((variant): variant is (typeof family.variants)[number] => Boolean(variant))
          if (variants.length === 0) return null
          return { name: family.name, variants }
        })
        .filter((family): family is { name: string; variants: (typeof category.families)[number]['variants'] } => family !== null)
      if (families.length === 0) return null
      return { name: category.name, families }
    })
    .filter((category): category is { name: string; families: Array<{ name: string; variants: CatalogPresetTree[number]['families'][number]['variants'] }> } => category !== null)

  if (filtered.length === 0) throw new Error('catalog preset selection is empty')

  const existingCategoryRows = await db
    .select({ name: serviceCategories.name })
    .from(serviceCategories)
    .where(eq(serviceCategories.salonId, input.salonId))
  const existingNames = new Set(existingCategoryRows.map((row) => row.name))
  for (const category of filtered) {
    if (existingNames.has(category.name)) {
      throw new Error('catalog preset collides with existing categories')
    }
  }

  const importedCategoryIds: string[] = []
  const importedVariantIds: string[] = []

  await db.transaction(async (tx) => {
    for (const category of filtered) {
      const [categoryRow] = await tx
        .insert(serviceCategories)
        .values({ salonId: input.salonId, name: category.name })
        .returning({ id: serviceCategories.id })
      importedCategoryIds.push(categoryRow.id)

      for (const family of category.families) {
        const [familyRow] = await tx
          .insert(serviceFamilies)
          .values({
            salonId: input.salonId,
            categoryId: categoryRow.id,
            name: family.name,
          })
          .returning({ id: serviceFamilies.id })

        for (const variant of family.variants) {
          const [variantRow] = await tx
            .insert(services)
            .values({
              salonId: input.salonId,
              familyId: familyRow.id,
              name: variant.name,
              duration: variant.duration,
              price: variant.price,
              color: variant.color,
              description: variant.description ?? null,
              kind: 'standard',
              active: true,
            })
            .returning({ id: services.id })
          importedVariantIds.push(variantRow.id)
        }
      }
    }

    await tx.insert(presetApplications).values({
      salonId: input.salonId,
      presetId: input.presetId,
      importedVariantIds,
    })
  })

  return { importedCategoryIds, importedVariantIds }
}
