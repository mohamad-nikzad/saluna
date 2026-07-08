import { SERVICE_CATEGORIES, type Service } from './types'

export function serviceCategoryName(service: Service): string {
  return (
    service.categoryName ||
    SERVICE_CATEGORIES[service.category]?.label ||
    service.category
  )
}

export function formatCompactServiceLabel(
  service: Service | null | undefined,
): string {
  if (!service) return ''
  return `${serviceCategoryName(service)} / ${service.name}`
}
