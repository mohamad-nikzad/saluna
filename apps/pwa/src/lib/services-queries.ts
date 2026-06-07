import { queryOptions, useMutation } from '@tanstack/react-query'
import type { ApplyCatalogPresetBody } from '@repo/salon-core/forms/catalog-preset'
import type {
  ServiceAddonFormPayload,
  ServiceCategoryCreateInput,
  ServiceFamilyCreateInput,
  ServiceFormInput,
  ServiceFormPayload,
} from '@repo/salon-core/forms/service'
import { serviceFormSchema } from '@repo/salon-core/forms/service'
import { normalizeCalendarColorId } from '@repo/salon-core/calendar-colors'
import type {
  ComboComponentsSummary,
  Service,
  ServiceAddon,
  ServiceCategory,
  ServiceFamily,
} from '@repo/salon-core/types'
import {
  getApiV1CatalogPresets,
  getApiV1ServiceAddons,
  getApiV1ServiceCategories,
  getApiV1ServiceFamilies,
  getApiV1Services,
  getApiV1ServicesByIdAddons,
  getApiV1ServicesByIdComboComponents,
} from '@repo/api-client/sdk'
import {
  getApiV1CatalogPresetsQueryKey,
  getApiV1ServiceAddonsQueryKey,
  getApiV1ServiceCategoriesQueryKey,
  getApiV1ServiceFamiliesQueryKey,
  getApiV1ServicesByIdComboComponentsQueryKey,
  getApiV1ServicesQueryKey,
  patchApiV1ServiceAddonsByIdMutation,
  patchApiV1ServiceCategoriesByIdMutation,
  patchApiV1ServiceFamiliesByIdMutation,
  patchApiV1ServicesByIdMutation,
  postApiV1CatalogPresetsByIdApplyMutation,
  postApiV1ServiceAddonsMutation,
  postApiV1ServiceCategoriesMutation,
  postApiV1ServiceFamiliesMutation,
  postApiV1ServicesImportStarterTemplatesMutation,
  postApiV1ServicesMutation,
  putApiV1ServicesByIdComboComponentsMutation,
} from '@repo/api-client/query'
import type {
  CatalogPresetListItem as GeneratedCatalogPresetListItem,
  ComboComponentsSummary as GeneratedComboComponentsSummary,
  Service as GeneratedService,
  ServiceAddon as GeneratedServiceAddon,
  ServiceCategory as GeneratedServiceCategory,
  ServiceFamily as GeneratedServiceFamily,
} from '@repo/api-client/types'

import { HEAVY_QUERY_STALE_TIME_MS } from '#/lib/query-client'

export {
  getApiV1ServicesQueryKey,
  getApiV1ServiceCategoriesQueryKey,
  getApiV1ServiceFamiliesQueryKey,
  getApiV1ServiceAddonsQueryKey,
  getApiV1CatalogPresetsQueryKey,
  getApiV1ServicesByIdComboComponentsQueryKey,
}

const includeInactiveQuery = { all: '1' } as const

function mapService(service: GeneratedService): Service {
  return service as unknown as Service
}

function mapServiceCategory(category: GeneratedServiceCategory): ServiceCategory {
  return category as unknown as ServiceCategory
}

function mapServiceFamily(family: GeneratedServiceFamily): ServiceFamily {
  return family as unknown as ServiceFamily
}

function mapServiceAddon(addon: GeneratedServiceAddon): ServiceAddon {
  return addon as unknown as ServiceAddon
}

function mapComboComponents(
  combo: GeneratedComboComponentsSummary,
): ComboComponentsSummary {
  return combo as unknown as ComboComponentsSummary
}

export type ManagerServicesList = Service[]

export type ManagerServiceCatalog = {
  categories: ServiceCategory[]
  families: ServiceFamily[]
  services: Service[]
}

export type CatalogPresetListItem = GeneratedCatalogPresetListItem

export function servicesListQueryOptions(options?: { includeInactive?: boolean }) {
  const query = options?.includeInactive ? includeInactiveQuery : undefined

  return queryOptions({
    queryKey: getApiV1ServicesQueryKey(
      query ? { query } : undefined,
    ),
    staleTime: HEAVY_QUERY_STALE_TIME_MS,
    queryFn: async ({ signal }): Promise<Service[]> => {
      const { data } = await getApiV1Services({
        query,
        signal,
        throwOnError: true,
      })
      return data.services.map(mapService)
    },
  })
}

export function serviceCatalogQueryOptions() {
  return queryOptions({
    queryKey: [
      'service-catalog',
      getApiV1ServiceCategoriesQueryKey({ query: includeInactiveQuery }),
      getApiV1ServiceFamiliesQueryKey({ query: includeInactiveQuery }),
      getApiV1ServicesQueryKey({ query: includeInactiveQuery }),
    ] as const,
    staleTime: HEAVY_QUERY_STALE_TIME_MS,
    queryFn: async ({ signal }): Promise<ManagerServiceCatalog> => {
      const [categoriesRes, familiesRes, servicesRes] = await Promise.all([
        getApiV1ServiceCategories({
          query: includeInactiveQuery,
          signal,
          throwOnError: true,
        }),
        getApiV1ServiceFamilies({
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
        families: familiesRes.data.families.map(mapServiceFamily),
        services: servicesRes.data.services.map(mapService),
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

export function comboComponentsQueryOptions(serviceId: string) {
  return queryOptions({
    queryKey: getApiV1ServicesByIdComboComponentsQueryKey({
      path: { id: serviceId },
    }),
    queryFn: async ({ signal }): Promise<ComboComponentsSummary> => {
      const { data } = await getApiV1ServicesByIdComboComponents({
        path: { id: serviceId },
        signal,
        throwOnError: true,
      })
      return mapComboComponents(data.combo)
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
    getApiV1ServiceFamiliesQueryKey({ query: includeInactiveQuery }),
    getApiV1ServiceAddonsQueryKey({ query: includeInactiveQuery }),
  ]
}

function toServiceBody(payload: ServiceFormPayload) {
  return {
    name: payload.name,
    categoryId: payload.categoryId,
    familyId: payload.familyId ?? null,
    category: payload.category,
    duration: payload.duration,
    price: payload.price,
    color: normalizeCalendarColorId(payload.color),
    active: payload.active,
    description: payload.description,
    kind: payload.kind,
  }
}

export type SaveServiceInput = {
  values: ServiceFormInput
  componentIds: string[]
}

export function useSaveServiceMutation(serviceId?: string) {
  const createMutation = postApiV1ServicesMutation()
  const updateMutation = patchApiV1ServicesByIdMutation()
  const comboMutation = putApiV1ServicesByIdComboComponentsMutation()

  return useMutation<string, unknown, SaveServiceInput>({
    mutationFn: async ({ values, componentIds }, mutationContext) => {
      const payload = serviceFormSchema.parse(values)
      if (!payload.categoryId) {
        throw new Error('بخش خدمات را انتخاب کنید')
      }

      const body = toServiceBody(payload)
      const shouldStageComboActivation =
        payload.kind === 'combo' && payload.active && componentIds.length > 0

      if (serviceId) {
        await updateMutation.mutationFn!(
          {
            path: { id: serviceId },
            body: {
              ...body,
              active: shouldStageComboActivation ? false : body.active,
            },
          },
          mutationContext,
        )

        if (payload.kind === 'combo') {
          await comboMutation.mutationFn!(
            {
              path: { id: serviceId },
              body: { componentServiceIds: componentIds },
            },
            mutationContext,
          )
          if (shouldStageComboActivation) {
            await updateMutation.mutationFn!(
              {
                path: { id: serviceId },
                body: { active: true },
              },
              mutationContext,
            )
          }
        }
        return serviceId
      }

      const created = await createMutation.mutationFn!(
        {
          body: {
            ...body,
            active: shouldStageComboActivation ? false : body.active,
          },
        },
        mutationContext,
      )

      const createdId = created.service.id

      if (payload.kind === 'combo') {
        await comboMutation.mutationFn!(
          {
            path: { id: createdId },
            body: { componentServiceIds: componentIds },
          },
          mutationContext,
        )
        if (shouldStageComboActivation) {
          await updateMutation.mutationFn!(
            {
              path: { id: createdId },
              body: { active: true },
            },
            mutationContext,
          )
        }
      }

      return createdId
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

export function useSaveServiceFamilyMutation(familyId?: string) {
  const createMutation = postApiV1ServiceFamiliesMutation()
  const updateMutation = patchApiV1ServiceFamiliesByIdMutation()

  return useMutation<void, unknown, ServiceFamilyCreateInput>({
    mutationFn: async (values, mutationContext) => {
      if (familyId) {
        await updateMutation.mutationFn!(
          {
            path: { id: familyId },
            body: values,
          },
          mutationContext,
        )
        return
      }
      await createMutation.mutationFn!({ body: values }, mutationContext)
    },
    meta: {
      errorMessage: 'ذخیره گروه خدمات انجام نشد',
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
