import type { Client, ClientSummary, ClientTag } from '@repo/salon-core'
import { normalizePhone } from '@repo/salon-core'
import { readCacheTimestamp, writeCacheTimestamp } from '../cache-meta'
import type { HttpTransportPort } from '../../ports/http-transport'
import type { LocalDataPort } from '../../ports/local-data-port'
import { DataClientHttpError } from '../../ports/http-transport'
import { createListenerSet } from '../listeners'
import type { MutationQueuePort } from '../mutation-queue'
import { newOfflineEntityId } from '../offline-entity-id'
import { defaultIsOnline, type OnlineStatusReader } from '../online-status'
import { projectListWithPendingEntities } from '../offline-projection'

const COLLECTION = 'clients'
const LIST_KEY = 'list'

type ClientsResponse = { clients: Client[] }
type ClientDetailResponse = { client: Client }
export type ClientCreateInput = {
  name: string
  phone: string
  notes?: string
  tags?: string[]
}
export type ClientUpdateInput = {
  name?: string
  phone?: string
  notes?: string
  tags?: string[]
}

const OFFLINE_TAG_COLORS: Record<string, string> = {
  VIP: 'bg-amber-100 text-amber-800 border-amber-200',
  'حساسیت': 'bg-rose-100 text-rose-800 border-rose-200',
  'رنگ خاص': 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
  'نیاز به پیگیری': 'bg-cyan-100 text-cyan-800 border-cyan-200',
  'بدقول': 'bg-orange-100 text-orange-800 border-orange-200',
}

function tagsFromLabels(clientId: string, salonId: string, labels: string[]): ClientTag[] {
  return labels.map((label) => ({
    id: newOfflineEntityId(),
    salonId,
    clientId,
    label,
    color: OFFLINE_TAG_COLORS[label] ?? 'bg-muted text-foreground border-border',
    createdAt: new Date(),
  }))
}

export type ClientsModuleDeps = {
  mutationQueue?: MutationQueuePort | null
  isOnline?: OnlineStatusReader
  getSalonId?: () => Promise<string | null>
}

export interface ClientsModule {
  list(): Promise<Client[]>
  getById(id: string): Promise<Client | null>
  getSummary(id: string): Promise<ClientSummary | null>
  refresh(): Promise<Client[]>
  hydrateListFromServer(clients: Client[]): Promise<void>
  hydrateSummaryFromServer(id: string, summary: ClientSummary): Promise<void>
  listLastSyncedAt(): Promise<string | null>
  summaryLastSyncedAt(id: string): Promise<string | null>
  create(input: ClientCreateInput): Promise<Client>
  update(id: string, input: ClientUpdateInput): Promise<Client>
  subscribe(fn: (clients: Client[]) => void): () => void
}

export function createClientsModule(
  transport: HttpTransportPort,
  storage: LocalDataPort,
  deps: ClientsModuleDeps = {}
): ClientsModule {
  const mutationQueue = deps.mutationQueue ?? null
  const isOnline = deps.isOnline ?? defaultIsOnline
  const getSalonId = deps.getSalonId ?? (async () => null)

  const listeners = createListenerSet<Client[]>()

  async function persistList(clients: Client[]) {
    await storage.set(COLLECTION, LIST_KEY, clients)
    await writeCacheTimestamp(storage, COLLECTION, LIST_KEY)
    listeners.notify(clients)
  }

  async function fetchList(): Promise<Client[]> {
    const data = await transport.json<ClientsResponse>('GET', '/api/clients')
    const clients = data.clients ?? []
    await persistList(clients)
    return clients
  }

  async function list(): Promise<Client[]> {
    if (isOnline()) {
      try {
        return await fetchList()
      } catch (error) {
        if (error instanceof DataClientHttpError) return []
        /* fall back to the offline snapshot */
      }
    }
    const hit = await storage.get<Client[]>(COLLECTION, LIST_KEY)
    if (hit !== undefined) return hit
    return []
  }

  async function invalidateList() {
    await storage.delete(COLLECTION, LIST_KEY)
  }

  async function mergeHydrateListFromServer(serverClients: Client[]) {
    const projected = await projectListWithPendingEntities({
      storage,
      mutationQueue,
      base: serverClients,
      entityType: 'client',
      entityId: (client) => client.id,
      localKey: (id) => `id:${id}`,
      collection: COLLECTION,
      payloadItem: (payload) => {
        const pay = payload as { client?: Client }
        return pay.client ?? null
      },
    })
    await persistList(projected)
  }

  return {
    list,

    async getById(id: string) {
      const key = `id:${id}`
      if (isOnline()) {
        try {
          const data = await transport.json<ClientDetailResponse>('GET', `/api/clients/${id}`)
          const client = data.client ?? null
          if (client) {
            await storage.set(COLLECTION, key, client)
            await writeCacheTimestamp(storage, COLLECTION, key)
          }
          return client
        } catch (error) {
          if (error instanceof DataClientHttpError) return null
          /* fall back to the offline snapshot */
        }
      }
      const cached = await storage.get<Client>(COLLECTION, key)
      return cached ?? null
    },

    async getSummary(id: string) {
      const key = `summary:${id}`
      if (isOnline()) {
        try {
          const summary = await transport.json<ClientSummary>('GET', `/api/clients/${id}/summary`)
          await storage.set(COLLECTION, key, summary)
          await writeCacheTimestamp(storage, COLLECTION, key)
          return summary
        } catch (error) {
          if (error instanceof DataClientHttpError) return null
          /* fall back to the offline snapshot */
        }
      }
      const cached = await storage.get<ClientSummary>(COLLECTION, key)
      return cached ?? null
    },

    refresh: fetchList,

    hydrateListFromServer(clients) {
      return mergeHydrateListFromServer(clients)
    },

    async hydrateSummaryFromServer(id, summary) {
      const key = `summary:${id}`
      await storage.set(COLLECTION, key, summary)
      await writeCacheTimestamp(storage, COLLECTION, key)
    },

    listLastSyncedAt() {
      return readCacheTimestamp(storage, COLLECTION, LIST_KEY)
    },

    summaryLastSyncedAt(id) {
      return readCacheTimestamp(storage, COLLECTION, `summary:${id}`)
    },

    async create(input) {
      if (!mutationQueue || isOnline()) {
        const data = await transport.json<ClientDetailResponse>('POST', '/api/clients', {
          body: input,
        })
        const client = data.client
        await invalidateList()
        await storage.delete(COLLECTION, `summary:${client.id}`)
        listeners.notify(await list())
        return client
      }

      const id = newOfflineEntityId()
      const salonId = (await getSalonId()) ?? ''
      const normalized = normalizePhone(input.phone)
      const tagLabels = [...new Set((input.tags ?? []).map((t) => String(t).trim()).filter(Boolean))].slice(0, 8)
      const tags = tagsFromLabels(id, salonId || id, tagLabels)
      const client: Client = {
        id,
        name: input.name,
        phone: normalized,
        isPlaceholder: false,
        notes: input.notes,
        createdAt: new Date(),
        tags,
      }

      await mutationQueue.runAtomically(async (txQueue, txStorage) => {
        await txStorage.set(COLLECTION, `id:${id}`, client)
        const current = (await txStorage.get<Client[]>(COLLECTION, LIST_KEY)) ?? []
        await txStorage.set(COLLECTION, LIST_KEY, [client, ...current.filter((c) => c.id !== id)])
        await writeCacheTimestamp(txStorage, COLLECTION, LIST_KEY)
        await txStorage.delete(COLLECTION, `summary:${id}`)
        await txQueue.enqueue({
          entityType: 'client',
          entityId: id,
          operation: 'create',
          payload: {
            id,
            input: { name: input.name, phone: normalized, notes: input.notes, tags: tagLabels },
            client,
          },
        })
      })

      listeners.notify(await list())
      return client
    },

    async update(id, input) {
      if (!mutationQueue || isOnline()) {
        const data = await transport.json<ClientDetailResponse>('PATCH', `/api/clients/${id}`, {
          body: input,
        })
        const client = data.client
        await storage.set(COLLECTION, `id:${id}`, client)
        await invalidateList()
        await storage.delete(COLLECTION, `summary:${id}`)
        listeners.notify(await list())
        return client
      }

      const existing =
        (await storage.get<Client>(COLLECTION, `id:${id}`)) ??
        (await list()).find((c) => c.id === id) ??
        null
      if (!existing) {
        throw new DataClientHttpError('مشتری یافت نشد', 404, null)
      }

      const nextPhone = input.phone !== undefined ? normalizePhone(input.phone) : existing.phone
      const next: Client = {
        ...existing,
        name: input.name ?? existing.name,
        phone: nextPhone,
        notes: input.notes !== undefined ? input.notes : existing.notes,
      }
      if (input.tags !== undefined) {
        const salonId = (await getSalonId()) ?? existing.id
        const tagLabels = [...new Set(input.tags.map((t) => String(t).trim()).filter(Boolean))].slice(0, 8)
        next.tags = tagsFromLabels(id, salonId, tagLabels)
      }

      const pend = await mutationQueue.listForLocalOverlay()
      const createRow = pend.find((p) => p.entityId === id && p.operation === 'create')
      const tagLabelsForSync =
        input.tags !== undefined
          ? [...new Set(input.tags.map((t) => String(t).trim()).filter(Boolean))].slice(0, 8)
          : (next.tags?.map((t) => t.label) ?? [])

      await mutationQueue.runAtomically(async (txQueue, txStorage) => {
        await txStorage.set(COLLECTION, `id:${id}`, next)
        const current = (await txStorage.get<Client[]>(COLLECTION, LIST_KEY)) ?? []
        await txStorage.set(COLLECTION, LIST_KEY, current.map((c) => (c.id === id ? next : c)))
        await writeCacheTimestamp(txStorage, COLLECTION, LIST_KEY)
        await txStorage.delete(COLLECTION, `summary:${id}`)

        if (createRow) {
          await txQueue.save({
            ...createRow,
            payload: {
              id,
              input: {
                name: next.name,
                phone: next.phone,
                notes: next.notes,
                tags: tagLabelsForSync,
              },
              client: next,
            },
          })
        } else {
          await txQueue.enqueue({
            entityType: 'client',
            entityId: id,
            operation: 'update',
            payload: {
              id,
              input: {
                ...input,
                ...(input.tags !== undefined ? { tags: tagLabelsForSync } : {}),
              },
            },
          })
        }
      })

      listeners.notify(await list())
      return next
    },

    subscribe(fn) {
      return listeners.subscribe(fn)
    },
  }
}
