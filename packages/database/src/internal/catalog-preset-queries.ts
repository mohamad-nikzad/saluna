import { and, asc, eq } from 'drizzle-orm'

import {
  normalizeCatalogPresetTree,
  type CatalogPresetTree,
} from '@repo/salon-core/forms/catalog-preset'

import { getDb } from '../client'
import {
  catalogPresets,
  presetApplications,
  serviceCategories,
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
  serviceIndices: number[]
}>

type CatalogPresetImportPlan = Array<{
  name: string
  services: CatalogPresetTree[number]['services']
}>

export function buildCatalogPresetImportPlan(
  tree: CatalogPresetTree,
  selection: ApplyPresetSelection,
): CatalogPresetImportPlan {
  const selectedByCategory = new Map<number, Set<number>>()
  for (const categorySelection of selection) {
    const category = tree[categorySelection.categoryIndex]
    if (!category) continue

    const serviceIndices =
      selectedByCategory.get(categorySelection.categoryIndex) ??
      new Set<number>()
    for (const serviceIndex of categorySelection.serviceIndices) {
      if (category.services[serviceIndex]) serviceIndices.add(serviceIndex)
    }
    if (serviceIndices.size > 0) {
      selectedByCategory.set(categorySelection.categoryIndex, serviceIndices)
    }
  }

  const plan = Array.from(selectedByCategory.entries())
    .map(([categoryIndex, serviceIndices]) => {
      const category = tree[categoryIndex]
      if (!category) return null
      const selectedServices = category.services.filter((_, serviceIndex) =>
        serviceIndices.has(serviceIndex),
      )
      if (selectedServices.length === 0) return null
      return { name: category.name, services: selectedServices }
    })
    .filter(
      (category): category is CatalogPresetImportPlan[number] =>
        category !== null,
    )

  if (plan.length === 0) throw new Error('catalog preset selection is empty')

  const serviceNames = new Set<string>()
  for (const category of plan) {
    for (const service of category.services) {
      if (serviceNames.has(service.name)) {
        throw new Error('catalog preset selection contains duplicate services')
      }
      serviceNames.add(service.name)
    }
  }

  return plan
}

export async function listActiveCatalogPresets(
  salonId: string,
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
    const tree = normalizeCatalogPresetTree(row.tree)
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
      and(
        eq(catalogPresets.id, input.presetId),
        eq(catalogPresets.isActive, true),
      ),
    )
    .limit(1)
  if (!preset) throw new Error('catalog preset not found or inactive')

  const tree = normalizeCatalogPresetTree(preset.tree)
  const plan = buildCatalogPresetImportPlan(tree, input.selection)

  const [existingCategoryRows, existingServiceRows] = await Promise.all([
    db
      .select({ name: serviceCategories.name })
      .from(serviceCategories)
      .where(eq(serviceCategories.salonId, input.salonId)),
    db
      .select({ name: services.name })
      .from(services)
      .where(eq(services.salonId, input.salonId)),
  ])
  const existingNames = new Set(existingCategoryRows.map((row) => row.name))
  for (const category of plan) {
    if (existingNames.has(category.name)) {
      throw new Error('catalog preset collides with existing categories')
    }
  }
  const existingServiceNames = new Set(
    existingServiceRows.map((row) => row.name),
  )
  for (const category of plan) {
    for (const service of category.services) {
      if (existingServiceNames.has(service.name)) {
        throw new Error('catalog preset selection contains duplicate services')
      }
    }
  }

  const importedCategoryIds: string[] = []
  const importedVariantIds: string[] = []

  await db.transaction(async (tx) => {
    for (const category of plan) {
      const [categoryRow] = await tx
        .insert(serviceCategories)
        .values({ salonId: input.salonId, name: category.name })
        .returning({ id: serviceCategories.id })
      importedCategoryIds.push(categoryRow.id)

      for (const service of category.services) {
        const [variantRow] = await tx
          .insert(services)
          .values({
            salonId: input.salonId,
            categoryId: categoryRow.id,
            name: service.name,
            duration: service.duration,
            price: service.price,
            color: service.color,
            description: service.description ?? null,
            active: true,
          })
          .returning({ id: services.id })
        importedVariantIds.push(variantRow.id)
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
