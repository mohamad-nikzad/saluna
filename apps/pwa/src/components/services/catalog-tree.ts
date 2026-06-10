import type {
  Service,
  ServiceCategory,
  ServiceFamily,
} from '@repo/salon-core/types'

export type CategoryNode = ServiceCategory & {
  families: Array<ServiceFamily & { services: Service[] }>
  ungroupedServices: Service[]
}

/**
 * Groups a flat catalog (categories, families, services) into a tree keyed by
 * category. Services with a `familyId` land under that family; services with
 * only a `categoryId` fall into the category's `ungroupedServices` bucket.
 */
export function buildCatalog(
  categories: ServiceCategory[],
  families: ServiceFamily[],
  services: Service[],
): CategoryNode[] {
  const familiesByCategory = new Map<
    string,
    Array<ServiceFamily & { services: Service[] }>
  >()
  const servicesByFamily = new Map<string, Service[]>()
  const ungroupedByCategory = new Map<string, Service[]>()

  for (const service of services) {
    if (service.familyId) {
      const list = servicesByFamily.get(service.familyId) ?? []
      list.push(service)
      servicesByFamily.set(service.familyId, list)
    } else if (service.categoryId) {
      const list = ungroupedByCategory.get(service.categoryId) ?? []
      list.push(service)
      ungroupedByCategory.set(service.categoryId, list)
    }
  }

  for (const family of families) {
    const list = familiesByCategory.get(family.categoryId) ?? []
    list.push({ ...family, services: servicesByFamily.get(family.id) ?? [] })
    familiesByCategory.set(family.categoryId, list)
  }

  return categories.map((category) => ({
    ...category,
    families: familiesByCategory.get(category.id) ?? [],
    ungroupedServices: ungroupedByCategory.get(category.id) ?? [],
  }))
}
