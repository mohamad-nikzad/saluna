import { and, eq } from 'drizzle-orm'

import { getDb } from '../client'
import { serviceCategories, serviceFamilies } from '../schema'

export type CatalogReferenceErrorReason =
  | 'family_missing'
  | 'family_category_mismatch'
  | 'category_required'
  | 'category_missing'

/**
 * Thrown when a service references a category/family that cannot be resolved:
 * missing, inactive, or inconsistent with each other. Carries a stable
 * `reason` code so the API layer can map to a user-facing message via
 * `instanceof` instead of matching on `Error.message` substrings.
 */
export class CatalogReferenceError extends Error {
  readonly reason: CatalogReferenceErrorReason
  constructor(reason: CatalogReferenceErrorReason, message: string) {
    super(message)
    this.name = 'CatalogReferenceError'
    this.reason = reason
  }
}

export async function getActiveFamily(familyId: string, salonId: string) {
  const db = getDb()
  const [row] = await db
    .select({
      id: serviceFamilies.id,
      categoryId: serviceFamilies.categoryId,
      categoryName: serviceCategories.name,
    })
    .from(serviceFamilies)
    .innerJoin(
      serviceCategories,
      eq(serviceFamilies.categoryId, serviceCategories.id),
    )
    .where(
      and(
        eq(serviceFamilies.id, familyId),
        eq(serviceFamilies.salonId, salonId),
        eq(serviceFamilies.active, true),
        eq(serviceCategories.active, true),
      ),
    )
    .limit(1)
  return row
}

export async function getActiveCategory(categoryId: string, salonId: string) {
  const db = getDb()
  const [row] = await db
    .select({ id: serviceCategories.id })
    .from(serviceCategories)
    .where(
      and(
        eq(serviceCategories.id, categoryId),
        eq(serviceCategories.salonId, salonId),
        eq(serviceCategories.active, true),
      ),
    )
    .limit(1)
  return row
}

/**
 * Resolves the category a service must belong to. A family (optional) implies
 * its own category; when both are supplied they must agree. Returns the
 * effective categoryId or throws if nothing valid resolves.
 */
export async function resolveServiceCategory(
  salonId: string,
  categoryId: string | null | undefined,
  familyId: string | null | undefined,
): Promise<string> {
  if (familyId) {
    const family = await getActiveFamily(familyId, salonId)
    if (!family) {
      throw new CatalogReferenceError(
        'family_missing',
        'service family not found or inactive',
      )
    }
    if (categoryId && categoryId !== family.categoryId) {
      throw new CatalogReferenceError(
        'family_category_mismatch',
        'service family does not belong to the given category',
      )
    }
    return family.categoryId
  }
  if (!categoryId) {
    throw new CatalogReferenceError(
      'category_required',
      'service category is required',
    )
  }
  const category = await getActiveCategory(categoryId, salonId)
  if (!category) {
    throw new CatalogReferenceError(
      'category_missing',
      'service category not found or inactive',
    )
  }
  return categoryId
}
