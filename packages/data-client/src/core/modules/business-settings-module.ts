import type { BusinessHours } from '@repo/salon-core'
import { WORKING_HOURS } from '@repo/salon-core'
import { DEFAULT_WORKING_DAYS } from '@repo/salon-core/working-days'
import { readCacheTimestamp, writeCacheTimestamp } from '../cache-meta'
import type { HttpTransportPort } from '../../ports/http-transport'
import type { LocalDataPort } from '../../ports/local-data-port'
import { createListenerSet } from '../listeners'
import type { MutationQueuePort } from '../mutation-queue'
import { defaultIsOnline, type OnlineStatusReader } from '../online-status'

const COLLECTION = 'business_settings'
const KEY_SETTINGS = 'settings'
/** Single logical row for queue compaction */
export const BUSINESS_SETTINGS_ENTITY_ID = '__business_settings__'

type BusinessResponse = { settings: BusinessHours | null }

export type BusinessSettingsUpdateInput = Partial<
  Pick<BusinessHours, 'workingStart' | 'workingEnd' | 'slotDurationMinutes'>
>

export interface BusinessSettingsModuleDeps {
  mutationQueue?: MutationQueuePort | null
  isOnline?: OnlineStatusReader
}

export interface BusinessSettingsModule {
  get(): Promise<BusinessHours | null>
  refresh(): Promise<BusinessHours | null>
  hydrateFromServer(settings: BusinessHours | null): Promise<void>
  lastSyncedAt(): Promise<string | null>
  subscribe(fn: (settings: BusinessHours | null) => void): () => void
  update(input: BusinessSettingsUpdateInput): Promise<BusinessHours | null>
}

function defaultHours(): BusinessHours {
  return {
    workingStart: WORKING_HOURS.start,
    workingEnd: WORKING_HOURS.end,
    slotDurationMinutes: WORKING_HOURS.slotDuration,
    workingDays: DEFAULT_WORKING_DAYS,
  }
}

export function createBusinessSettingsModule(
  transport: HttpTransportPort,
  storage: LocalDataPort,
  deps: BusinessSettingsModuleDeps = {}
): BusinessSettingsModule {
  const mutationQueue = deps.mutationQueue ?? null
  const isOnline = deps.isOnline ?? defaultIsOnline

  const listeners = createListenerSet<BusinessHours | null>()

  async function persistSettings(settings: BusinessHours | null) {
    await storage.set(COLLECTION, KEY_SETTINGS, settings)
    await writeCacheTimestamp(storage, COLLECTION, KEY_SETTINGS)
    listeners.notify(settings)
  }

  async function applyPendingOverlay(base: BusinessHours | null): Promise<BusinessHours | null> {
    if (!mutationQueue) return base
    const pending = await mutationQueue.listForLocalOverlay()
    const row = pending.find(
      (p) =>
        p.entityType === 'business_settings' &&
        p.entityId === BUSINESS_SETTINGS_ENTITY_ID &&
        p.operation === 'update'
    )
    if (!row) return base
    const patch = (row.payload as { patch?: BusinessSettingsUpdateInput }).patch ?? {}
    const merged = { ...(base ?? defaultHours()), ...patch }
    return merged
  }

  async function resolvedGet(): Promise<BusinessHours | null> {
    const raw = await storage.get<BusinessHours | null>(COLLECTION, KEY_SETTINGS)
    return applyPendingOverlay(raw ?? null)
  }

  async function fetchSettings(): Promise<BusinessHours | null> {
    const data = await transport.json<BusinessResponse>('GET', '/api/settings/business')
    const settings = data.settings ?? null
    await persistSettings(settings)
    return applyPendingOverlay(settings)
  }

  return {
    async get() {
      const merged = await resolvedGet()
      if (merged !== null) return merged
      try {
        return await fetchSettings()
      } catch {
        return applyPendingOverlay(null)
      }
    },

    refresh: fetchSettings,

    hydrateFromServer(settings) {
      return persistSettings(settings)
    },

    lastSyncedAt() {
      return readCacheTimestamp(storage, COLLECTION, KEY_SETTINGS)
    },

    subscribe(fn) {
      return listeners.subscribe(fn)
    },

    async update(input) {
      const patch: BusinessSettingsUpdateInput = {
        ...(input.workingStart !== undefined ? { workingStart: input.workingStart } : {}),
        ...(input.workingEnd !== undefined ? { workingEnd: input.workingEnd } : {}),
        ...(input.slotDurationMinutes !== undefined ? { slotDurationMinutes: input.slotDurationMinutes } : {}),
      }
      if (Object.keys(patch).length === 0) {
        return resolvedGet()
      }

      if (!mutationQueue || isOnline()) {
        const data = await transport.json<BusinessResponse>('PATCH', '/api/settings/business', {
          body: patch,
        })
        const settings = data.settings ?? null
        await persistSettings(settings)
        return settings
      }

      const current = (await storage.get<BusinessHours | null>(COLLECTION, KEY_SETTINGS)) ?? defaultHours()
      const next: BusinessHours = { ...current, ...patch }
      const pend = await mutationQueue.listForLocalOverlay()
      const existing = pend.find(
        (p) =>
          p.entityType === 'business_settings' &&
          p.entityId === BUSINESS_SETTINGS_ENTITY_ID &&
          p.operation === 'update'
      )

      await mutationQueue.runAtomically(async (txQueue, txStorage) => {
        await txStorage.set(COLLECTION, KEY_SETTINGS, next)
        await writeCacheTimestamp(txStorage, COLLECTION, KEY_SETTINGS)
        if (existing) {
          const prev = (existing.payload as { patch?: BusinessSettingsUpdateInput }).patch ?? {}
          await txQueue.save({
            ...existing,
            payload: { patch: { ...prev, ...patch } },
          })
        } else {
          await txQueue.enqueue({
            entityType: 'business_settings',
            entityId: BUSINESS_SETTINGS_ENTITY_ID,
            operation: 'update',
            payload: { patch },
          })
        }
      })

      listeners.notify(next)
      return next
    },
  }
}
