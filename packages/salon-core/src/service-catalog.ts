import { SERVICE_CATEGORIES, type Service } from "./types";

export type ServiceFamilyGroup = {
  familyId: string;
  familyName: string;
  services: Service[];
};

export type ServiceCategoryGroup = {
  categoryId: string;
  categoryName: string;
  families: ServiceFamilyGroup[];
};

export function serviceCategoryName(service: Service): string {
  return (
    service.categoryName ||
    SERVICE_CATEGORIES[service.category]?.label ||
    service.category
  );
}

export function serviceFamilyName(service: Service): string {
  return service.familyName || serviceCategoryName(service);
}

export function formatCompactServiceLabel(
  service: Service | null | undefined,
): string {
  if (!service) return "";
  return `${serviceCategoryName(service)} / ${service.name}`;
}

export function groupServicesByCatalog(
  services: Service[],
): ServiceCategoryGroup[] {
  const categoryMap = new Map<string, ServiceCategoryGroup>();

  for (const service of services) {
    const categoryId = service.categoryId || service.category;
    const categoryName = serviceCategoryName(service);
    const familyId =
      service.familyId || `${categoryId}:${serviceFamilyName(service)}`;
    const familyName = serviceFamilyName(service);

    let categoryGroup = categoryMap.get(categoryId);
    if (!categoryGroup) {
      categoryGroup = {
        categoryId,
        categoryName,
        families: [],
      };
      categoryMap.set(categoryId, categoryGroup);
    }

    let familyGroup = categoryGroup.families.find(
      (family) => family.familyId === familyId,
    );
    if (!familyGroup) {
      familyGroup = {
        familyId,
        familyName,
        services: [],
      };
      categoryGroup.families.push(familyGroup);
    }

    familyGroup.services.push(service);
  }

  return [...categoryMap.values()]
    .sort((a, b) => a.categoryName.localeCompare(b.categoryName, "fa"))
    .map((category) => ({
      ...category,
      families: category.families
        .sort((a, b) => a.familyName.localeCompare(b.familyName, "fa"))
        .map((family) => ({
          ...family,
          services: family.services.sort((a, b) =>
            a.name.localeCompare(b.name, "fa"),
          ),
        })),
    }));
}
