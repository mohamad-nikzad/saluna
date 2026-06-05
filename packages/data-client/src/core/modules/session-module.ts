import type { User } from '@repo/salon-core'
import {
  META_COLLECTION,
  cacheTimestampRecordKey,
  readCacheTimestamp,
  writeCacheTimestamp,
} from '../cache-meta'
import { DataClientHttpError, type HttpTransportPort } from '../../ports/http-transport'
import type { LocalDataPort } from '../../ports/local-data-port'
import { createListenerSet } from '../listeners'
import { defaultIsOnline, type OnlineStatusReader } from '../online-status'

const COLLECTION = 'session'
const KEY_USER = 'user'

type MeResponse = { user: User }

export interface SessionModule {
  get(): Promise<User | null>
  refresh(): Promise<User | null>
  hydrateFromServer(user: User | null): Promise<void>
  lastSyncedAt(): Promise<string | null>
  subscribe(fn: (user: User | null) => void): () => void
}

export function createSessionModule(
  transport: HttpTransportPort,
  storage: LocalDataPort,
  deps: { isOnline?: OnlineStatusReader } = {}
): SessionModule {
  const isOnline = deps.isOnline ?? defaultIsOnline
  const listeners = createListenerSet<User | null>()

  async function persistUser(user: User | null) {
    if (user) {
      await storage.set(COLLECTION, KEY_USER, user)
      await writeCacheTimestamp(storage, COLLECTION, KEY_USER)
    } else {
      await storage.delete(COLLECTION, KEY_USER)
      await storage.delete(META_COLLECTION, cacheTimestampRecordKey(COLLECTION, KEY_USER))
    }
    listeners.notify(user)
  }

  async function loadFromNetwork(): Promise<User | null> {
    const data = await transport.json<MeResponse>('GET', '/api/auth/me')
    const user = data.user ?? null
    await persistUser(user)
    return user
  }

  return {
    async get() {
      if (isOnline()) {
        try {
          return await loadFromNetwork()
        } catch (e) {
          if (e instanceof DataClientHttpError && e.status === 401) {
            await persistUser(null)
            return null
          }
          /* fall back to the offline snapshot */
        }
      }
      const cached = await storage.get<User>(COLLECTION, KEY_USER)
      if (cached !== undefined) return cached
      return null
    },

    async refresh() {
      try {
        return await loadFromNetwork()
      } catch (e) {
        if (e instanceof DataClientHttpError && e.status === 401) {
          await persistUser(null)
          return null
        }
        throw e
      }
    },

    hydrateFromServer(user) {
      return persistUser(user)
    },

    lastSyncedAt() {
      return readCacheTimestamp(storage, COLLECTION, KEY_USER)
    },

    subscribe(fn) {
      return listeners.subscribe(fn)
    },
  }
}
