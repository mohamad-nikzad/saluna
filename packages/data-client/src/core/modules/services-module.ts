import type { Service, ServiceCategory, ServiceFamily } from '@repo/salon-core'
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
type ImportStarterServiceTemplatesResponse = {
  categories: ServiceCategory[]
  families: ServiceFamily[]
  services: Service[]
}

export type ServiceCreateInput = {
  name: string
  familyId?: string
  category?: Service['category']
  categoryId?: string | null
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

export type ServiceCategoryUpdateInput = Partial<Pick<ServiceCategory, 'name' | 'active'>>

export type ServiceFamilyCreateInput = {
  categoryId: string
  name: string
  active?: boolean
}

export type ServiceFamilyUpdateInput = Partial<
  Pick<ServiceFamily, 'categoryId' | 'name' | 'active'>
>

export interface ServicesModuleDeps {
  mutationQueue?: MutationQueuePort | null
  isOnline?: OnlineStatusReader
}

export interface ServicesModule {
  list(options?: { includeInactive?: boolean }): Promise<Service[]>
  getById(id: string, options?: { includeInactive?: boolean }): Promise<Service | null>
  refresh(options?: { includeInactive?: boolean }): Promise<Service[]>
  hydrateFromServer(services: Service[], options?: { includeInactive?: boolean }): Promise<void>
  listLastSyncedAt(options?: { includeInactive?: boolean }): Promise<string | null>
  subscribe(fn: (services: Service[]) => void): () => void
  create(input: ServiceCreateInput): Promise<Service>
  update(id: string, input: ServiceUpdateInput): Promise<Service>
  categories: {
    list(options?: { includeInactive?: boolean }): Promise<ServiceCategory[]>
    create(input: ServiceCategoryCreateInput): Promise<ServiceCategory>
    update(id: string, input: ServiceCategoryUpdateInput): Promise<ServiceCategory>
  }
  families: {
    list(options?: { includeInactive?: boolean }): Promise<ServiceFamily[]>
    create(input: ServiceFamilyCreateInput): Promise<ServiceFamily>
    update(id: string, input: ServiceFamilyUpdateInput): Promise<ServiceFamily>
  }
  importStarterTemplates(): Promise<ImportStarterServiceTemplatesResponse>
}

export function createServicesModule(
  transport: HttpTransportPort,
  storage: LocalDataPort,
  deps: ServicesModuleDeps = {}
): ServicesModule {
  const mutationQueue = deps.mutationQueue ?? null
  const isOnline = deps.isOnline ?? defaultIsOnline

  const listeners = createListenerSet<Service[]>()

  async function emitSubscribers() {
    listeners.notify((await storage.get<Service[]>(COLLECTION, listKey(true))) ?? [])
  }

  async function persistList(includeInactive: boolean, services: Service[], silent?: boolean) {
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
  }

  async function fetchList(includeInactive: boolean): Promise<Service[]> {
    const data = await transport.json<ServicesResponse>('GET', '/api/services', {
      query: includeInactive ? { all: '1' } : undefined,
    })
    const services = data.services ?? []
    await persistList(includeInactive, services)
    return services
  }

  async function mergeHydrateListFromServer(serverServices: Service[], includeInactive: boolean) {
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
    const key = listKey(includeInactive)
    const hit = await storage.get<Service[]>(COLLECTION, key)
    if (hit !== undefined) return hit
    try {
      return await fetchList(includeInactive)
    } catch {
      return []
    }
  }

  return {
    list: (_opts?: { includeInactive?: boolean }) => list(Boolean(_opts?.includeInactive)),

    async getById(id: string, opts?: { includeInactive?: boolean }) {
      const key = `id:${id}`
      const cached = await storage.get<Service>(COLLECTION, key)
      if (cached !== undefined) return cached

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

      const rows = await list(Boolean(opts?.includeInactive))
      const fromList = rows.find((s) => s.id === id) ?? null
      if (fromList) {
        await storage.set(COLLECTION, key, fromList)
        return fromList
      }

      try {
        const data = await transport.json<ServiceOneResponse>('GET', `/api/services/${id}`)
        const svc = data.service ?? null
        if (svc) {
          await storage.set(COLLECTION, key, svc)
          await writeCacheTimestamp(storage, COLLECTION, key)
        }
        return svc
      } catch {
        return null
      }
    },

    refresh: (_opts?: { includeInactive?: boolean }) =>
      fetchList(Boolean(_opts?.includeInactive)),

    hydrateFromServer(services, opts) {
      return mergeHydrateListFromServer(services, Boolean(opts?.includeInactive))
    },

    listLastSyncedAt(opts) {
      return readCacheTimestamp(storage, COLLECTION, listKey(Boolean(opts?.includeInactive)))
    },

    subscribe(fn) {
      return listeners.subscribe(fn)
    },

    async create(input) {
      if (!mutationQueue || isOnline()) {
        const data = await transport.json<ServiceOneResponse>('POST', '/api/services', {
          body: {
            name: input.name,
            familyId: input.familyId,
            duration: input.duration,
            price: input.price,
            color: input.color,
            active: input.active !== false,
            description: input.description,
            kind: input.kind ?? 'standard',
          },
        })
        const service = data.service
        await invalidateLists()
        await storage.delete(COLLECTION, `id:${service.id}`)
        void emitSubscribers()
        return service
      }

      const id = newOfflineEntityId()
      if (!input.familyId) {
        throw new DataClientHttpError('خانواده خدمت را انتخاب کنید', 400, null)
      }
      const service: Service = {
        id,
        name: input.name,
        category: input.category ?? 'hair',
        familyId: input.familyId,
        familyName: input.familyName ?? null,
        categoryId: input.categoryId ?? null,
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
        const curAll = (await txStorage.get<Service[]>(COLLECTION, allKey)) ?? []
        const curAct = (await txStorage.get<Service[]>(COLLECTION, actKey)) ?? []
        await txStorage.set(COLLECTION, allKey, [service, ...curAll.filter((s) => s.id !== id)])
        await writeCacheTimestamp(txStorage, COLLECTION, allKey)
        await txStorage.set(
          COLLECTION,
          actKey,
          service.active ? [service, ...curAct.filter((s) => s.id !== id)] : curAct.filter((s) => s.id !== id)
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
              familyId: input.familyId,
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
        const data = await transport.json<ServiceOneResponse>('PATCH', `/api/services/${id}`, {
          body: input,
        })
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
        ...(input.familyName !== undefined ? { familyName: input.familyName } : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.categoryName !== undefined ? { categoryName: input.categoryName } : {}),
        ...(input.duration !== undefined ? { duration: input.duration } : {}),
        ...(input.price !== undefined ? { price: input.price } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.kind !== undefined ? { kind: input.kind } : {}),
      }

      const pend = await mutationQueue.listForLocalOverlay()
      const createRow = pend.find((p) => p.entityId === id && p.operation === 'create')

      await mutationQueue.runAtomically(async (txQueue, txStorage) => {
        await txStorage.set(COLLECTION, `id:${id}`, next)
        const curAll = (await txStorage.get<Service[]>(COLLECTION, listKey(true))) ?? []
        const curAct = (await txStorage.get<Service[]>(COLLECTION, listKey(false))) ?? []
        await txStorage.set(COLLECTION, listKey(true), curAll.map((s) => (s.id === id ? next : s)))
        await writeCacheTimestamp(txStorage, COLLECTION, listKey(true))
        await txStorage.set(
          COLLECTION,
          listKey(false),
          next.active ? [next, ...curAct.filter((s) => s.id !== id)] : curAct.filter((s) => s.id !== id)
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

    categories: {
      async list(options) {
        const includeInactive = Boolean(options?.includeInactive)
        const key = includeInactive ? 'categories:list:all' : 'categories:list'
        const hit = await storage.get<ServiceCategory[]>(COLLECTION, key)
        if (hit !== undefined) return hit
        try {
          const data = await transport.json<ServiceCategoriesResponse>('GET', '/api/service-categories', {
            query: includeInactive ? { all: '1' } : undefined,
          })
          const categories = data.categories ?? []
          await storage.set(COLLECTION, key, categories)
          await writeCacheTimestamp(storage, COLLECTION, key)
          return categories
        } catch {
          return []
        }
      },

      async create(input) {
        const data = await transport.json<ServiceCategoryOneResponse>('POST', '/api/service-categories', {
          body: { name: input.name, active: input.active !== false },
        })
        await invalidateCatalogLists()
        void emitSubscribers()
        return data.category
      },

      async update(id, input) {
        const data = await transport.json<ServiceCategoryOneResponse>('PATCH', `/api/service-categories/${id}`, {
          body: input,
        })
        await invalidateCatalogLists()
        void emitSubscribers()
        return data.category
      },
    },

    families: {
      async list(options) {
        const includeInactive = Boolean(options?.includeInactive)
        const key = includeInactive ? 'families:list:all' : 'families:list'
        const hit = await storage.get<ServiceFamily[]>(COLLECTION, key)
        if (hit !== undefined) return hit
        try {
          const data = await transport.json<ServiceFamiliesResponse>('GET', '/api/service-families', {
            query: includeInactive ? { all: '1' } : undefined,
          })
          const families = data.families ?? []
          await storage.set(COLLECTION, key, families)
          await writeCacheTimestamp(storage, COLLECTION, key)
          return families
        } catch {
          return []
        }
      },

      async create(input) {
        const data = await transport.json<ServiceFamilyOneResponse>('POST', '/api/service-families', {
          body: {
            categoryId: input.categoryId,
            name: input.name,
            active: input.active !== false,
          },
        })
        await invalidateCatalogLists()
        void emitSubscribers()
        return data.family
      },

      async update(id, input) {
        const data = await transport.json<ServiceFamilyOneResponse>('PATCH', `/api/service-families/${id}`, {
          body: input,
        })
        await invalidateCatalogLists()
        void emitSubscribers()
        return data.family
      },
    },

    async importStarterTemplates() {
      const data = await transport.json<ImportStarterServiceTemplatesResponse>(
        'POST',
        '/api/services/import-starter-templates'
      )
      await invalidateCatalogLists()
      void emitSubscribers()
      return data
    },
  }
}
