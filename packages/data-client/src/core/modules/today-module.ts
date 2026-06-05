import type { TodayData } from '@repo/salon-core'
import { readCacheTimestamp, writeCacheTimestamp } from '../cache-meta'
import type { HttpTransportPort } from '../../ports/http-transport'
import { DataClientHttpError } from '../../ports/http-transport'
import type { LocalDataPort } from '../../ports/local-data-port'
import { createListenerSet } from '../listeners'
import { defaultIsOnline, type OnlineStatusReader } from '../online-status'

const COLLECTION = 'today'

function dayKey(date: string) {
  return `day:${date}`
}

export interface TodayModule {
  getForDate(date: string): Promise<TodayData | null>
  refresh(date: string): Promise<TodayData | null>
  hydrateFromServer(date: string, data: TodayData): Promise<void>
  dayLastSyncedAt(date: string): Promise<string | null>
  subscribe(fn: (payload: { date: string; data: TodayData | null }) => void): () => void
}

export function createTodayModule(
  transport: HttpTransportPort,
  storage: LocalDataPort,
  deps: { isOnline?: OnlineStatusReader } = {}
): TodayModule {
  const isOnline = deps.isOnline ?? defaultIsOnline
  const listeners = createListenerSet<{ date: string; data: TodayData | null }>()

  async function persistDay(date: string, data: TodayData) {
    const key = dayKey(date)
    try {
      await storage.transaction(async (tx) => {
        await tx.set(COLLECTION, key, data)
        await writeCacheTimestamp(tx, COLLECTION, key)
        for (const appointment of data.appointments) {
          await tx.set('appointments', `one:${appointment.id}`, appointment)
        }
      })
    } catch {
      /* Cache writes are best-effort for online hydration. */
    }
    listeners.notify({ date, data })
  }

  async function fetchDay(date: string): Promise<TodayData | null> {
    const data = await transport.json<TodayData>('GET', '/api/today', {
      query: { date },
    })
    await persistDay(date, data)
    return data
  }

  return {
    async getForDate(date: string) {
      if (isOnline()) {
        try {
          return await fetchDay(date)
        } catch (error) {
          if (error instanceof DataClientHttpError) return null
          /* fall back to the offline snapshot */
        }
      }
      const key = dayKey(date)
      const hit = await storage.get<TodayData>(COLLECTION, key)
      if (hit !== undefined) return hit
      return null
    },

    refresh: fetchDay,

    hydrateFromServer(date, data) {
      return persistDay(date, data)
    },

    dayLastSyncedAt(date) {
      return readCacheTimestamp(storage, COLLECTION, dayKey(date))
    },

    subscribe(fn) {
      return listeners.subscribe(fn)
    },
  }
}
