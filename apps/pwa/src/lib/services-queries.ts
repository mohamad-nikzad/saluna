import { queryOptions, useMutation } from '@tanstack/react-query'
import type { ApplyCatalogPresetBody } from '@repo/salon-core/forms/catalog-preset'
import type {
  ServiceAddonFormPayload,
  ServiceCategoryCreateInput,
  ServiceFormInput,
  ServiceFormPayload,
  ServicePackageComponentsUpdatePayload,
  ServicePackageCreateInput,
  ServicePackageCreatePayload,
  ServicePackageUpdateInput,
} from '@repo/salon-core/forms/service'
import {
  serviceFormSchema,
  servicePackageComponentsUpdateSchema,
  servicePackageCreateSchema,
  servicePackageUpdateSchema,
} from '@repo/salon-core/forms/service'
import { normalizeCalendarColorId } from '@repo/salon-core/calendar-colors'
import type {
  Service,
  ServiceAddon,
  ServiceCategory,
  ServicePackage,
} from '@repo/salon-core/types'
import {
  getApiV1CatalogPresets,
  getApiV1ServiceAddons,
  getApiV1ServiceCategories,
  getApiV1ServicePackages,
  getApiV1Services,
  getApiV1ServicesByIdAddons,
} from '@repo/api-client/sdk'
import {
  getApiV1CatalogPresetsQueryKey,
  getApiV1ServiceAddonsQueryKey,
  getApiV1ServiceCategoriesQueryKey,
  getApiV1ServicePackagesByIdQueryKey,
  getApiV1ServicePackagesQueryKey,
  getApiV1ServicesQueryKey,
  patchApiV1ServiceAddonsByIdMutation,
  patchApiV1ServiceCategoriesByIdMutation,
  patchApiV1ServicePackagesByIdMutation,
  patchApiV1ServicesByIdMutation,
  postApiV1CatalogPresetsByIdApplyMutation,
  postApiV1ServiceAddonsMutation,
  postApiV1ServiceCategoriesMutation,
  postApiV1ServicePackagesMutation,
  postApiV1ServicesImportStarterTemplatesMutation,
  postApiV1ServicesMutation,
  putApiV1ServicePackagesByIdComponentsMutation,
} from '@repo/api-client/query'
import type {
  CatalogPresetListItem as GeneratedCatalogPresetListItem,
  Service as GeneratedService,
  ServiceAddon as GeneratedServiceAddon,
  ServiceCategory as GeneratedServiceCategory,
  ServicePackage as GeneratedServicePackage,
} from '@repo/api-client/types'

import { HEAVY_QUERY_STALE_TIME_MS } from '#/lib/query-client'

export {
  getApiV1ServicesQueryKey,
  getApiV1ServiceCategoriesQueryKey,
  getApiV1ServiceAddonsQueryKey,
  getApiV1CatalogPresetsQueryKey,
  getApiV1ServicePackagesQueryKey,
}

const includeInactiveQuery = { all: '1' } as const

function mapService(service: GeneratedService): Service {
  return service as unknown as Service
}

function mapServiceCategory(
  category: GeneratedServiceCategory,
): ServiceCategory {
  return category as unknown as ServiceCategory
}

function mapServiceAddon(addon: GeneratedServiceAddon): ServiceAddon {
  return addon as unknown as ServiceAddon
}

function mapServicePackage(pkg: GeneratedServicePackage): ServicePackage {
  return pkg as unknown as ServicePackage
}

function isNormalService(service: Service): boolean {
  return service.kind !== 'combo'
}

export type ManagerServicesList = Service[]

export type ManagerServiceCatalog = {
  categories: ServiceCategory[]
  services: Service[]
}

export type CatalogPresetListItem = GeneratedCatalogPresetListItem

export function servicesListQueryOptions(options?: {
  includeInactive?: boolean
}) {
  const query = options?.includeInactive ? includeInactiveQuery : undefined

  return queryOptions({
    queryKey: getApiV1ServicesQueryKey(query ? { query } : undefined),
    staleTime: HEAVY_QUERY_STALE_TIME_MS,
    queryFn: async ({ signal }): Promise<Service[]> => {
      const { data } = await getApiV1Services({
        query,
        signal,
        throwOnError: true,
      })
      return data.services.map(mapService).filter(isNormalService)
    },
  })
}

export function serviceCatalogQueryOptions() {
  return queryOptions({
    queryKey: [
      'service-catalog',
      getApiV1ServiceCategoriesQueryKey({ query: includeInactiveQuery }),
      getApiV1ServicesQueryKey({ query: includeInactiveQuery }),
    ] as const,
    staleTime: HEAVY_QUERY_STALE_TIME_MS,
    queryFn: async ({ signal }): Promise<ManagerServiceCatalog> => {
      const [categoriesRes, servicesRes] = await Promise.all([
        getApiV1ServiceCategories({
          query: includeInactiveQuery,
          signal,
          throwOnError: true,
        }),
        getApiV1Services({
          query: includeInactiveQuery,
          signal,
          throwOnError: true,
        }),
      ])

      return {
        categories: categoriesRes.data.categories.map(mapServiceCategory),
        services: servicesRes.data.services
          .map(mapService)
          .filter(isNormalService),
      }
    },
  })
}

export function addonsListQueryOptions() {
  return queryOptions({
    queryKey: getApiV1ServiceAddonsQueryKey({ query: includeInactiveQuery }),
    staleTime: HEAVY_QUERY_STALE_TIME_MS,
    queryFn: async ({ signal }): Promise<ServiceAddon[]> => {
      const { data } = await getApiV1ServiceAddons({
        query: includeInactiveQuery,
        signal,
        throwOnError: true,
      })
      return data.addons.map(mapServiceAddon)
    },
  })
}

export function serviceAddonsForServiceQueryOptions(serviceId: string) {
  return queryOptions({
    queryKey: ['services', 'addons', serviceId] as const,
    queryFn: async ({ signal }): Promise<ServiceAddon[]> => {
      const { data } = await getApiV1ServicesByIdAddons({
        path: { id: serviceId },
        signal,
        throwOnError: true,
      })
      return data.addons.map(mapServiceAddon)
    },
  })
}

export function catalogPresetsQueryOptions() {
  return queryOptions({
    queryKey: getApiV1CatalogPresetsQueryKey(),
    staleTime: HEAVY_QUERY_STALE_TIME_MS,
    queryFn: async ({ signal }): Promise<CatalogPresetListItem[]> => {
      const { data } = await getApiV1CatalogPresets({
        signal,
        throwOnError: true,
      })
      return data.presets
    },
  })
}

export function serviceCatalogInvalidationKeys() {
  return [
    serviceCatalogQueryOptions().queryKey,
    getApiV1ServicesQueryKey(),
    getApiV1ServicesQueryKey({ query: includeInactiveQuery }),
    getApiV1ServiceCategoriesQueryKey({ query: includeInactiveQuery }),
    getApiV1ServiceAddonsQueryKey({ query: includeInactiveQuery }),
    getApiV1ServicePackagesQueryKey({ query: includeInactiveQuery }),
  ]
}

function toServiceBody(payload: ServiceFormPayload) {
  return {
    name: payload.name,
    categoryId: payload.categoryId,
    category: payload.category,
    duration: payload.duration,
    price: payload.price,
    color: normalizeCalendarColorId(payload.color),
    active: payload.active,
    description: payload.description,
  }
}

export type SaveServiceInput = {
  values: ServiceFormInput
}

export function useSaveServiceMutation(serviceId?: string) {
  const createMutation = postApiV1ServicesMutation()
  const updateMutation = patchApiV1ServicesByIdMutation()

  return useMutation<string, unknown, SaveServiceInput>({
    mutationFn: async ({ values }, mutationContext) => {
      const payload = serviceFormSchema.parse(values)
      if (!payload.categoryId) {
        throw new Error('بخش خدمات را انتخاب کنید')
      }

      const body = toServiceBody(payload)

      if (serviceId) {
        await updateMutation.mutationFn!(
          {
            path: { id: serviceId },
            body,
          },
          mutationContext,
        )
        return serviceId
      }

      const created = await createMutation.mutationFn!(
        { body },
        mutationContext,
      )

      return created.service.id
    },
    meta: {
      errorMessage: 'ذخیره خدمت انجام نشد',
      invalidatesQuery: serviceCatalogInvalidationKeys(),
    },
  })
}

export function useSaveServiceCategoryMutation(categoryId?: string) {
  const createMutation = postApiV1ServiceCategoriesMutation()
  const updateMutation = patchApiV1ServiceCategoriesByIdMutation()

  return useMutation<void, unknown, ServiceCategoryCreateInput>({
    mutationFn: async (values, mutationContext) => {
      if (categoryId) {
        await updateMutation.mutationFn!(
          {
            path: { id: categoryId },
            body: values,
          },
          mutationContext,
        )
        return
      }
      await createMutation.mutationFn!({ body: values }, mutationContext)
    },
    meta: {
      errorMessage: 'ذخیره بخش انجام نشد',
      invalidatesQuery: serviceCatalogInvalidationKeys(),
    },
  })
}

export function useSaveServiceAddonMutation(addonId?: string) {
  const createMutation = postApiV1ServiceAddonsMutation()
  const updateMutation = patchApiV1ServiceAddonsByIdMutation()

  return useMutation<void, unknown, ServiceAddonFormPayload>({
    mutationFn: async (values, mutationContext) => {
      if (addonId) {
        await updateMutation.mutationFn!(
          {
            path: { id: addonId },
            body: values,
          },
          mutationContext,
        )
        return
      }
      await createMutation.mutationFn!({ body: values }, mutationContext)
    },
    meta: {
      errorMessage: 'ذخیره افزودنی انجام نشد',
      invalidatesQuery: [
        ...serviceCatalogInvalidationKeys(),
        getApiV1ServiceAddonsQueryKey({ query: includeInactiveQuery }),
      ],
    },
  })
}

export function useImportStarterTemplatesMutation() {
  const generated = postApiV1ServicesImportStarterTemplatesMutation()

  return useMutation({
    mutationFn: async (_variables, mutationContext) =>
      generated.mutationFn!({}, mutationContext),
    meta: {
      errorMessage: 'افزودن لیست آماده انجام نشد',
      invalidatesQuery: serviceCatalogInvalidationKeys(),
    },
  })
}

export function useApplyCatalogPresetMutation() {
  const generated = postApiV1CatalogPresetsByIdApplyMutation()

  return useMutation<
    { importedCategoryIds: string[]; importedVariantIds: string[] },
    unknown,
    { presetId: string; selection: ApplyCatalogPresetBody['selection'] }
  >({
    mutationFn: async ({ presetId, selection }, mutationContext) =>
      generated.mutationFn!(
        {
          path: { id: presetId },
          body: { selection },
        },
        mutationContext,
      ),
    meta: {
      skipToast: true,
      errorMessage: 'افزودن قالب انجام نشد',
      invalidatesQuery: serviceCatalogInvalidationKeys(),
    },
  })
}

export function servicePackagesListQueryOptions() {
  return queryOptions({
    queryKey: getApiV1ServicePackagesQueryKey({
      query: includeInactiveQuery,
    }),
    staleTime: HEAVY_QUERY_STALE_TIME_MS,
    queryFn: async ({ signal }): Promise<ServicePackage[]> => {
      const { data } = await getApiV1ServicePackages({
        query: includeInactiveQuery,
        signal,
        throwOnError: true,
      })
      return data.packages.map(mapServicePackage)
    },
  })
}

function servicePackageInvalidationKeys(packageId?: string) {
  return [
    serviceCatalogQueryOptions().queryKey,
    getApiV1ServicePackagesQueryKey({ query: includeInactiveQuery }),
    ...(packageId
      ? [getApiV1ServicePackagesByIdQueryKey({ path: { id: packageId } })]
      : []),
  ]
}

export function useSaveServicePackageMutation(packageId?: string) {
  const createMutation = postApiV1ServicePackagesMutation()
  const updateMutation = patchApiV1ServicePackagesByIdMutation()

  return useMutation<ServicePackage, unknown, ServicePackageCreateInput>({
    mutationFn: async (values, mutationContext) => {
      if (packageId) {
        const body = servicePackageUpdateSchema.parse(
          values,
        ) satisfies ServicePackageUpdateInput
        const response = await updateMutation.mutationFn!(
          {
            path: { id: packageId },
            body,
          },
          mutationContext,
        )
        return mapServicePackage(response.package)
      }

      const body = servicePackageCreateSchema.parse(
        values,
      ) satisfies ServicePackageCreatePayload
      const response = await createMutation.mutationFn!(
        { body },
        mutationContext,
      )
      return mapServicePackage(response.package)
    },
    meta: {
      errorMessage: 'ذخیره پکیج انجام نشد',
      invalidatesQuery: servicePackageInvalidationKeys(packageId),
    },
  })
}

export function useSaveServicePackageComponentsMutation(packageId?: string) {
  const generated = putApiV1ServicePackagesByIdComponentsMutation()

  return useMutation<
    ServicePackage,
    unknown,
    ServicePackageComponentsUpdatePayload & { packageId?: string }
  >({
    mutationFn: async (values, mutationContext) => {
      const targetPackageId = values.packageId ?? packageId
      if (!targetPackageId) throw new Error('پکیج را انتخاب کنید')
      const body = servicePackageComponentsUpdateSchema.parse(values)
      const response = await generated.mutationFn!(
        {
          path: { id: targetPackageId },
          body,
        },
        mutationContext,
      )
      return mapServicePackage(response.package)
    },
    meta: {
      errorMessage: 'ذخیره اجزای پکیج انجام نشد',
      invalidatesQuery: servicePackageInvalidationKeys(packageId),
    },
  })
}
