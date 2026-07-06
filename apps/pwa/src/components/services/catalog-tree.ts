import type { Service, ServiceCategory } from '@repo/salon-core/types'

export type CategoryNode = ServiceCategory & {
  services: Service[]
}

export function buildCatalog(
  categories: ServiceCategory[],
  services: Service[],
): CategoryNode[] {
  const servicesByCategory = new Map<string, Service[]>()

  for (const service of services) {
    if (service.categoryId) {
      const list = servicesByCategory.get(service.categoryId) ?? []
      list.push(service)
      servicesByCategory.set(service.categoryId, list)
    }
  }

  return categories.map((category) => ({
    ...category,
    services: servicesByCategory.get(category.id) ?? [],
  }))
}
