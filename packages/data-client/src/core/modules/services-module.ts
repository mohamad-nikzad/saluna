import type {
  ComboComponentsSummary,
  Service,
  ServiceAddon,
  ServiceCategory,
  ServiceFamily,
} from '@repo/salon-core'
import type { CatalogPresetTree } from '@repo/salon-core/forms/catalog-preset'
import { readCacheTimestamp, writeCacheTimestamp } from '../cache-meta'
import type { HttpTransportPort } from '../../ports/http-transport'
import type { LocalDataPort } from '../../ports/local-data-port'
import { DataClientHttpError } from '../../ports/http-transport'
import { createListenerSet } from '../listeners'
import type { MutationQueuePort } from '../mutation-queue'
import { newOfflineEntityId } from '../offline-entity-id'
import { defaultIsOnline, type OnlineStatusReader } from '../online-status'
import { projectListWithPendingEntities } from '../offline-projection'

const COLLECTION = 'services'

function listKey(includeInactive: boolean) {
  return includeInactive ? 'list:all' : 'list'
}

type ServicesResponse = { services: Service[] }
type ServiceOneResponse = { service: Service }
type ServiceCategoriesResponse = { categories: ServiceCategory[] }
type ServiceCategoryOneResponse = { category: ServiceCategory }
type ServiceFamiliesResponse = { families: ServiceFamily[] }
type ServiceFamilyOneResponse = { family: ServiceFamily }
type ComboComponentsResponse = { combo: ComboComponentsSummary }
type ServiceAddonsResponse = { addons: ServiceAddon[] }
type ServiceAddonOneResponse = { addon: ServiceAddon }
type ImportStarterServiceTemplatesResponse = {
  categories: ServiceCategory[]
  families: ServiceFamily[]
  services: Service[]
}

export type ApplyCatalogPresetSelection = Array<{
  categoryIndex: number
  families: Array<{ familyIndex: number; variantIndices: number[] }>
}>

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

type CatalogPresetsResponse = { presets: CatalogPresetListItem[] }

type ApplyCatalogPresetResponse = {
  importedCategoryIds: string[]
  importedVariantIds: string[]
}

export type ServiceCreateInput = {
  name: string
  categoryId: string
  familyId?: string | null
  category?: Service['category']
  categoryName?: string | null
  familyName?: string | null
  duration: number
  price: number
  color: string
  active?: boolean
  description?: string | null
  kind?: Service['kind']
}

export type ServiceUpdateInput = Partial<
  Pick<
    Service,
    | 'name'
    | 'familyId'
    | 'categoryId'
    | 'categoryName'
    | 'familyName'
    | 'duration'
    | 'price'
    | 'color'
    | 'active'
    | 'description'
    | 'kind'
  >
>

export type ServiceCategoryCreateInput = {
  name: string
  active?: boolean
}

export type ServiceCategoryUpdateInput = Partial<
  Pick<ServiceCategory, 'name' | 'active'>
>

export type ServiceFamilyCreateInput = {
  categoryId: string
  name: string
  active?: boolean
}

export type ServiceFamilyUpdateInput = Partial<
  Pick<ServiceFamily, 'categoryId' | 'name' | 'active'>
>

export type ServiceAddonScopeInput =
  | { type: 'category'; categoryId: string }
  | { type: 'family'; familyId: string }
  | { type: 'service'; serviceId: string }

export type ServiceAddonCreateInput = {
  name: string
  priceDelta: number
  durationDelta: number
  active?: boolean
  sortOrder?: number
  description?: string | null
  color?: string | null
  scopes?: ServiceAddonScopeInput[]
}

export type ServiceAddonUpdateInput = Partial<ServiceAddonCreateInput>

export interface ServicesModuleDeps {
  mutationQueue?: MutationQueuePort | null
  isOnline?: OnlineStatusReader
}

export interface ServicesModule {
  list(options?: { includeInactive?: boolean }): Promise<Service[]>
  getById(
    id: string,
    options?: { includeInactive?: boolean },
  ): Promise<Service | null>
  refresh(options?: { includeInactive?: boolean }): Promise<Service[]>
  hydrateFromServer(
    services: Service[],
    options?: { includeInactive?: boolean },
  ): Promise<void>
  listLastSyncedAt(options?: {
    includeInactive?: boolean
  }): Promise<string | null>
  subscribe(fn: (services: Service[]) => void): () => void
  create(input: ServiceCreateInput): Promise<Service>
  update(id: string, input: ServiceUpdateInput): Promise<Service>
  comboComponents: {
    get(id: string): Promise<ComboComponentsSummary | null>
    update(id: string, input: { componentServiceIds: string[] }): Promise<ComboComponentsSummary>
  }
  addons: {
    list(options?: { includeInactive?: boolean }): Promise<ServiceAddon[]>
    forService(serviceId: string): Promise<ServiceAddon[]>
    create(input: ServiceAddonCreateInput): Promise<ServiceAddon>
    update(id: string, input: ServiceAddonUpdateInput): Promise<ServiceAddon>
  }
  categories: {
    list(options?: { includeInactive?: boolean }): Promise<ServiceCategory[]>
    create(input: ServiceCategoryCreateInput): Promise<ServiceCategory>
    update(
      id: string,
      input: ServiceCategoryUpdateInput,
    ): Promise<ServiceCategory>
  }
  families: {
    list(options?: { includeInactive?: boolean }): Promise<ServiceFamily[]>
    create(input: ServiceFamilyCreateInput): Promise<ServiceFamily>
    update(id: string, input: ServiceFamilyUpdateInput): Promise<ServiceFamily>
  }
  importStarterTemplates(): Promise<ImportStarterServiceTemplatesResponse>
  listCatalogPresets(): Promise<CatalogPresetListItem[]>
  applyCatalogPreset(
    presetId: string,
    selection: ApplyCatalogPresetSelection,
  ): Promise<ApplyCatalogPresetResponse>
}

export function createServicesModule(
  transport: HttpTransportPort,
  storage: LocalDataPort,
  deps: ServicesModuleDeps = {},
): ServicesModule {
  const mutationQueue = deps.mutationQueue ?? null
  const isOnline = deps.isOnline ?? defaultIsOnline

  const listeners = createListenerSet<Service[]>()

  async function emitSubscribers() {
    listeners.notify(
      (await storage.get<Service[]>(COLLECTION, listKey(true))) ?? [],
    )
  }

  async function persistList(
    includeInactive: boolean,
    services: Service[],
    silent?: boolean,
  ) {
    const key = listKey(includeInactive)
    await storage.set(COLLECTION, key, services)
    await writeCacheTimestamp(storage, COLLECTION, key)
    if (!silent) void emitSubscribers()
  }

  async function invalidateLists() {
    await storage.delete(COLLECTION, 'list')
    await storage.delete(COLLECTION, 'list:all')
  }

  async function invalidateCatalogLists() {
    await invalidateLists()
    await storage.delete(COLLECTION, 'categories:list')
    await storage.delete(COLLECTION, 'categories:list:all')
    await storage.delete(COLLECTION, 'families:list')
    await storage.delete(COLLECTION, 'families:list:all')
    await storage.delete(COLLECTION, 'addons:list')
    await storage.delete(COLLECTION, 'addons:list:all')
  }

  function addonListKey(includeInactive: boolean) {
    return includeInactive ? 'addons:list:all' : 'addons:list'
  }

  async function persistAddonList(
    includeInactive: boolean,
    addons: ServiceAddon[],
  ) {
    const key = addonListKey(includeInactive)
    await storage.set(COLLECTION, key, addons)
    await writeCacheTimestamp(storage, COLLECTION, key)
  }

  async function mergeHydrateAddonListFromServer(
    serverAddons: ServiceAddon[],
    includeInactive: boolean,
  ) {
    const projected = await projectListWithPendingEntities({
      storage,
      mutationQueue,
      base: serverAddons,
      entityType: 'service_addon',
      entityId: (addon) => addon.id,
      localKey: (id) => `addon:${id}`,
      collection: COLLECTION,
      payloadItem: (payload) => {
        const pay = payload as { addon?: ServiceAddon }
        return pay.addon ?? null
      },
    })
    await persistAddonList(includeInactive, projected)
  }

  async function fetchAddonList(includeInactive: boolean): Promise<ServiceAddon[]> {
    const data = await transport.json<ServiceAddonsResponse>(
      'GET',
      '/api/service-addons',
      {
        query: includeInactive ? { all: '1' } : undefined,
      },
    )
    const addons = data.addons ?? []
    await mergeHydrateAddonListFromServer(addons, includeInactive)
    return addons
  }

  async function listAddons(includeInactive = false): Promise<ServiceAddon[]> {
    if (isOnline()) {
      try {
        return await fetchAddonList(includeInactive)
      } catch (error) {
        if (error instanceof DataClientHttpError) return []
        /* fall back to the offline snapshot */
      }
    }
    const key = addonListKey(includeInactive)
    const hit = await storage.get<ServiceAddon[]>(COLLECTION, key)
    if (hit !== undefined) return hit
    return []
  }

  function offlineAddonScopes(input: ServiceAddonScopeInput[] = []): ServiceAddon['scopes'] {
    return input.map((scope) => {
      if (scope.type === 'category') {
        return {
          type: 'category',
          categoryId: scope.categoryId,
          categoryName: '',
          active: true,
        }
      }
      if (scope.type === 'family') {
        return {
          type: 'family',
          familyId: scope.familyId,
          familyName: '',
          categoryId: '',
          active: true,
        }
      }
      return {
        type: 'service',
        serviceId: scope.serviceId,
        serviceName: '',
        familyId: '',
        active: true,
      }
    })
  }

  async function fetchList(includeInactive: boolean): Promise<Service[]> {
    const data = await transport.json<ServicesResponse>(
      'GET',
      '/api/services',
      {
        query: includeInactive ? { all: '1' } : undefined,
      },
    )
    const services = data.services ?? []
    await persistList(includeInactive, services)
    return services
  }

  async function mergeHydrateListFromServer(
    serverServices: Service[],
    includeInactive: boolean,
  ) {
    const projected = await projectListWithPendingEntities({
      storage,
      mutationQueue,
      base: serverServices,
      entityType: 'service',
      entityId: (service) => service.id,
      localKey: (id) => `id:${id}`,
      collection: COLLECTION,
      payloadItem: (payload) => {
        const pay = payload as { service?: Service }
        return pay.service ?? null
      },
    })
    await persistList(includeInactive, projected)
  }

  async function list(includeInactive = false): Promise<Service[]> {
    if (isOnline()) {
      try {
        return await fetchList(includeInactive)
      } catch (error) {
        if (error instanceof DataClientHttpError) return []
        /* fall back to the offline snapshot */
      }
    }
    const key = listKey(includeInactive)
    const hit = await storage.get<Service[]>(COLLECTION, key)
    if (hit !== undefined) return hit
    return []
  }

  return {
    list: (_opts?: { includeInactive?: boolean }) =>
      list(Boolean(_opts?.includeInactive)),

    async getById(id: string, opts?: { includeInactive?: boolean }) {
      const key = `id:${id}`
      if (mutationQueue) {
        const pending = await mutationQueue.listForLocalOverlay()
        for (const m of pending) {
          if (m.entityType !== 'service' || m.entityId !== id) continue
          if (m.operation === 'create' || m.operation === 'update') {
            const pay = m.payload as { service?: Service }
            if (pay.service) return pay.service
          }
        }
      }

      if (isOnline()) {
        try {
          const data = await transport.json<ServiceOneResponse>(
            'GET',
            `/api/services/${id}`,
          )
          const svc = data.service ?? null
          if (svc) {
            await storage.set(COLLECTION, key, svc)
            await writeCacheTimestamp(storage, COLLECTION, key)
          }
          return svc
        } catch (error) {
          if (error instanceof DataClientHttpError) return null
          /* fall back to the offline snapshot */
        }
      }

      const cached = await storage.get<Service>(COLLECTION, key)
      if (cached !== undefined) return cached

      const rows = await list(Boolean(opts?.includeInactive))
      const fromList = rows.find((s) => s.id === id) ?? null
      if (fromList) await storage.set(COLLECTION, key, fromList)
      return fromList
    },

    refresh: (_opts?: { includeInactive?: boolean }) =>
      fetchList(Boolean(_opts?.includeInactive)),

    hydrateFromServer(services, opts) {
      return mergeHydrateListFromServer(
        services,
        Boolean(opts?.includeInactive),
      )
    },

    listLastSyncedAt(opts) {
      return readCacheTimestamp(
        storage,
        COLLECTION,
        listKey(Boolean(opts?.includeInactive)),
      )
    },

    subscribe(fn) {
      return listeners.subscribe(fn)
    },

    async create(input) {
      if (!mutationQueue || isOnline()) {
        const data = await transport.json<ServiceOneResponse>(
          'POST',
          '/api/services',
          {
            body: {
              name: input.name,
              categoryId: input.categoryId,
              familyId: input.familyId ?? null,
              duration: input.duration,
              price: input.price,
              color: input.color,
              active: input.active !== false,
              description: input.description,
              kind: input.kind ?? 'standard',
            },
          },
        )
        const service = data.service
        await invalidateLists()
        await storage.delete(COLLECTION, `id:${service.id}`)
        void emitSubscribers()
        return service
      }

      const id = newOfflineEntityId()
      if (!input.categoryId) {
        throw new DataClientHttpError('بخش خدمات را انتخاب کنید', 400, null)
      }
      const service: Service = {
        id,
        name: input.name,
        category: input.category ?? 'hair',
        familyId: input.familyId ?? null,
        familyName: input.familyName ?? null,
        categoryId: input.categoryId,
        categoryName: input.categoryName ?? null,
        duration: input.duration,
        price: input.price,
        color: input.color,
        active: input.active !== false,
        description: input.description ?? null,
        kind: input.kind ?? 'standard',
      }

      await mutationQueue.runAtomically(async (txQueue, txStorage) => {
        await txStorage.set(COLLECTION, `id:${id}`, service)
        const allKey = listKey(true)
        const actKey = listKey(false)
        const curAll =
          (await txStorage.get<Service[]>(COLLECTION, allKey)) ?? []
        const curAct =
          (await txStorage.get<Service[]>(COLLECTION, actKey)) ?? []
        await txStorage.set(COLLECTION, allKey, [
          service,
          ...curAll.filter((s) => s.id !== id),
        ])
        await writeCacheTimestamp(txStorage, COLLECTION, allKey)
        await txStorage.set(
          COLLECTION,
          actKey,
          service.active
            ? [service, ...curAct.filter((s) => s.id !== id)]
            : curAct.filter((s) => s.id !== id),
        )
        await writeCacheTimestamp(txStorage, COLLECTION, actKey)
        await txQueue.enqueue({
          entityType: 'service',
          entityId: id,
          operation: 'create',
          payload: {
            id,
            body: {
              name: input.name,
              categoryId: input.categoryId,
              familyId: input.familyId ?? null,
              duration: input.duration,
              price: input.price,
              color: input.color,
              active: input.active !== false,
              description: input.description,
              kind: input.kind ?? 'standard',
            },
            service,
          },
        })
      })

      void emitSubscribers()
      return service
    },

    async update(id, input) {
      if (!mutationQueue || isOnline()) {
        const data = await transport.json<ServiceOneResponse>(
          'PATCH',
          `/api/services/${id}`,
          {
            body: input,
          },
        )
        const service = data.service
        await storage.set(COLLECTION, `id:${id}`, service)
        await invalidateLists()
        void emitSubscribers()
        return service
      }

      const existing =
        (await storage.get<Service>(COLLECTION, `id:${id}`)) ??
        (await list(true)).find((s) => s.id === id) ??
        null
      if (!existing) {
        throw new DataClientHttpError('خدمت یافت نشد', 404, null)
      }

      const next: Service = {
        ...existing,
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.familyId !== undefined ? { familyId: input.familyId } : {}),
        ...(input.familyName !== undefined
          ? { familyName: input.familyName }
          : {}),
        ...(input.categoryId !== undefined
          ? { categoryId: input.categoryId }
          : {}),
        ...(input.categoryName !== undefined
          ? { categoryName: input.categoryName }
          : {}),
        ...(input.duration !== undefined ? { duration: input.duration } : {}),
        ...(input.price !== undefined ? { price: input.price } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.kind !== undefined ? { kind: input.kind } : {}),
      }

      const pend = await mutationQueue.listForLocalOverlay()
      const createRow = pend.find(
        (p) => p.entityId === id && p.operation === 'create',
      )

      await mutationQueue.runAtomically(async (txQueue, txStorage) => {
        await txStorage.set(COLLECTION, `id:${id}`, next)
        const curAll =
          (await txStorage.get<Service[]>(COLLECTION, listKey(true))) ?? []
        const curAct =
          (await txStorage.get<Service[]>(COLLECTION, listKey(false))) ?? []
        await txStorage.set(
          COLLECTION,
          listKey(true),
          curAll.map((s) => (s.id === id ? next : s)),
        )
        await writeCacheTimestamp(txStorage, COLLECTION, listKey(true))
        await txStorage.set(
          COLLECTION,
          listKey(false),
          next.active
            ? [next, ...curAct.filter((s) => s.id !== id)]
            : curAct.filter((s) => s.id !== id),
        )
        await writeCacheTimestamp(txStorage, COLLECTION, listKey(false))

        if (createRow) {
          await txQueue.save({
            ...createRow,
            payload: {
              id,
              body: {
                name: next.name,
                familyId: next.familyId,
                duration: next.duration,
                price: next.price,
                color: next.color,
                active: next.active,
                description: next.description,
                kind: next.kind,
              },
              service: next,
            },
          })
        } else {
          await txQueue.enqueue({
            entityType: 'service',
            entityId: id,
            operation: 'update',
            payload: { id, patch: input, service: next },
          })
        }
      })

      void emitSubscribers()
      return next
    },

    comboComponents: {
      async get(id) {
        const key = `combo:${id}:components`
        if (isOnline()) {
          try {
            const data = await transport.json<ComboComponentsResponse>(
              'GET',
              `/api/services/${id}/combo-components`
            )
            const combo = data.combo ?? null
            if (combo) {
              await storage.set(COLLECTION, key, combo)
              await writeCacheTimestamp(storage, COLLECTION, key)
            }
            return combo
          } catch (error) {
            if (error instanceof DataClientHttpError) return null
            /* fall back to the offline snapshot */
          }
        }
        const cached = await storage.get<ComboComponentsSummary>(COLLECTION, key)
        if (cached !== undefined) return cached
        return null
      },

      async update(id, input) {
        const data = await transport.json<ComboComponentsResponse>(
          'PUT',
          `/api/services/${id}/combo-components`,
          {
            body: { componentServiceIds: input.componentServiceIds },
          }
        )
        await storage.set(COLLECTION, `combo:${id}:components`, data.combo)
        await writeCacheTimestamp(storage, COLLECTION, `combo:${id}:components`)
        await invalidateLists()
        void emitSubscribers()
        return data.combo
      },
    },

    addons: {
      list: (_opts?: { includeInactive?: boolean }) =>
        listAddons(Boolean(_opts?.includeInactive)),

      async forService(serviceId) {
        const key = `service:${serviceId}:addons`
        if (isOnline()) {
          try {
            const data = await transport.json<ServiceAddonsResponse>(
              'GET',
              `/api/services/${serviceId}/addons`,
            )
            const addons = data.addons ?? []
            await storage.set(COLLECTION, key, addons)
            await writeCacheTimestamp(storage, COLLECTION, key)
            return addons
          } catch (error) {
            if (error instanceof DataClientHttpError) return []
            /* fall back to the offline snapshot */
          }
        }
        const cached = await storage.get<ServiceAddon[]>(COLLECTION, key)
        if (cached !== undefined) return cached
        return []
      },

      async create(input) {
        const body = {
          name: input.name,
          priceDelta: input.priceDelta,
          durationDelta: input.durationDelta,
          active: input.active !== false,
          sortOrder: input.sortOrder ?? 0,
          description: input.description,
          color: input.color,
          scopes: input.scopes ?? [],
        }
        if (!mutationQueue || isOnline()) {
          const data = await transport.json<ServiceAddonOneResponse>(
            'POST',
            '/api/service-addons',
            { body },
          )
          await invalidateCatalogLists()
          void emitSubscribers()
          return data.addon
        }

        const id = newOfflineEntityId()
        const addon: ServiceAddon = {
          id,
          salonId: '',
          name: input.name,
          priceDelta: input.priceDelta,
          durationDelta: input.durationDelta,
          active: input.active !== false,
          sortOrder: input.sortOrder ?? 0,
          description: input.description ?? null,
          color: input.color ?? null,
          scopes: offlineAddonScopes(input.scopes),
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        await mutationQueue.runAtomically(async (txQueue, txStorage) => {
          await txStorage.set(COLLECTION, `addon:${id}`, addon)
          const allKey = addonListKey(true)
          const actKey = addonListKey(false)
          const curAll =
            (await txStorage.get<ServiceAddon[]>(COLLECTION, allKey)) ?? []
          const curAct =
            (await txStorage.get<ServiceAddon[]>(COLLECTION, actKey)) ?? []
          await txStorage.set(COLLECTION, allKey, [
            addon,
            ...curAll.filter((item) => item.id !== id),
          ])
          await writeCacheTimestamp(txStorage, COLLECTION, allKey)
          await txStorage.set(
            COLLECTION,
            actKey,
            addon.active
              ? [addon, ...curAct.filter((item) => item.id !== id)]
              : curAct.filter((item) => item.id !== id),
          )
          await writeCacheTimestamp(txStorage, COLLECTION, actKey)
          await txQueue.enqueue({
            entityType: 'service_addon',
            entityId: id,
            operation: 'create',
            payload: { id, body, addon },
          })
        })
        void emitSubscribers()
        return addon
      },

      async update(id, input) {
        if (!mutationQueue || isOnline()) {
          const data = await transport.json<ServiceAddonOneResponse>(
            'PATCH',
            `/api/service-addons/${id}`,
            { body: input },
          )
          await storage.set(COLLECTION, `addon:${id}`, data.addon)
          await invalidateCatalogLists()
          void emitSubscribers()
          return data.addon
        }

        const existing =
          (await storage.get<ServiceAddon>(COLLECTION, `addon:${id}`)) ??
          (await listAddons(true)).find((addon) => addon.id === id) ??
          null
        if (!existing) {
          throw new DataClientHttpError('افزودنی یافت نشد', 404, null)
        }
        const next: ServiceAddon = {
          ...existing,
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.priceDelta !== undefined ? { priceDelta: input.priceDelta } : {}),
          ...(input.durationDelta !== undefined ? { durationDelta: input.durationDelta } : {}),
          ...(input.active !== undefined ? { active: input.active } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.color !== undefined ? { color: input.color } : {}),
          ...(input.scopes !== undefined ? { scopes: offlineAddonScopes(input.scopes) } : {}),
          updatedAt: new Date(),
        }
        await mutationQueue.runAtomically(async (txQueue, txStorage) => {
          await txStorage.set(COLLECTION, `addon:${id}`, next)
          const curAll =
            (await txStorage.get<ServiceAddon[]>(COLLECTION, addonListKey(true))) ?? []
          const curAct =
            (await txStorage.get<ServiceAddon[]>(COLLECTION, addonListKey(false))) ?? []
          await txStorage.set(
            COLLECTION,
            addonListKey(true),
            curAll.map((addon) => (addon.id === id ? next : addon)),
          )
          await writeCacheTimestamp(txStorage, COLLECTION, addonListKey(true))
          await txStorage.set(
            COLLECTION,
            addonListKey(false),
            next.active
              ? [next, ...curAct.filter((addon) => addon.id !== id)]
              : curAct.filter((addon) => addon.id !== id),
          )
          await writeCacheTimestamp(txStorage, COLLECTION, addonListKey(false))
          await txQueue.enqueue({
            entityType: 'service_addon',
            entityId: id,
            operation: 'update',
            payload: { id, patch: input, addon: next },
          })
        })
        void emitSubscribers()
        return next
      },
    },

    categories: {
      async list(options) {
        const includeInactive = Boolean(options?.includeInactive)
        const key = includeInactive ? 'categories:list:all' : 'categories:list'
        if (isOnline()) {
          try {
            const data = await transport.json<ServiceCategoriesResponse>(
              'GET',
              '/api/service-categories',
              {
                query: includeInactive ? { all: '1' } : undefined,
              },
            )
            const categories = data.categories ?? []
            await storage.set(COLLECTION, key, categories)
            await writeCacheTimestamp(storage, COLLECTION, key)
            return categories
          } catch (error) {
            if (error instanceof DataClientHttpError) return []
            /* fall back to the offline snapshot */
          }
        }
        const hit = await storage.get<ServiceCategory[]>(COLLECTION, key)
        if (hit !== undefined) return hit
        return []
      },

      async create(input) {
        const data = await transport.json<ServiceCategoryOneResponse>(
          'POST',
          '/api/service-categories',
          {
            body: { name: input.name, active: input.active !== false },
          },
        )
        await invalidateCatalogLists()
        void emitSubscribers()
        return data.category
      },

      async update(id, input) {
        const data = await transport.json<ServiceCategoryOneResponse>(
          'PATCH',
          `/api/service-categories/${id}`,
          {
            body: input,
          },
        )
        await invalidateCatalogLists()
        void emitSubscribers()
        return data.category
      },
    },

    families: {
      async list(options) {
        const includeInactive = Boolean(options?.includeInactive)
        const key = includeInactive ? 'families:list:all' : 'families:list'
        if (isOnline()) {
          try {
            const data = await transport.json<ServiceFamiliesResponse>(
              'GET',
              '/api/service-families',
              {
                query: includeInactive ? { all: '1' } : undefined,
              },
            )
            const families = data.families ?? []
            await storage.set(COLLECTION, key, families)
            await writeCacheTimestamp(storage, COLLECTION, key)
            return families
          } catch (error) {
            if (error instanceof DataClientHttpError) return []
            /* fall back to the offline snapshot */
          }
        }
        const hit = await storage.get<ServiceFamily[]>(COLLECTION, key)
        if (hit !== undefined) return hit
        return []
      },

      async create(input) {
        const data = await transport.json<ServiceFamilyOneResponse>(
          'POST',
          '/api/service-families',
          {
            body: {
              categoryId: input.categoryId,
              name: input.name,
              active: input.active !== false,
            },
          },
        )
        await invalidateCatalogLists()
        void emitSubscribers()
        return data.family
      },

      async update(id, input) {
        const data = await transport.json<ServiceFamilyOneResponse>(
          'PATCH',
          `/api/service-families/${id}`,
          {
            body: input,
          },
        )
        await invalidateCatalogLists()
        void emitSubscribers()
        return data.family
      },
    },

    async importStarterTemplates() {
      const data = await transport.json<ImportStarterServiceTemplatesResponse>(
        'POST',
        '/api/services/import-starter-templates',
      )
      await invalidateCatalogLists()
      void emitSubscribers()
      return data
    },

    async listCatalogPresets() {
      const data = await transport.json<CatalogPresetsResponse>(
        'GET',
        '/api/catalog-presets',
      )
      return data.presets ?? []
    },

    async applyCatalogPreset(presetId, selection) {
      const data = await transport.json<ApplyCatalogPresetResponse>(
        'POST',
        `/api/catalog-presets/${presetId}/apply`,
        { body: { selection } },
      )
      await invalidateCatalogLists()
      void emitSubscribers()
      return data
    },
  }
}
