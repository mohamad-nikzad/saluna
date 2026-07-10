// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { brand } from '@repo/brand'

import {
  clearPersistedActiveSalonId,
  getPersistedActiveSalonId,
  setPersistedActiveSalonId,
} from './active-salon'

const store = new Map<string, string>()

describe('active salon persistence', () => {
  beforeEach(() => {
    store.clear()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
      removeItem: (key: string) => {
        store.delete(key)
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    store.clear()
  })

  it('persists and reads the selected salon ID', () => {
    expect(getPersistedActiveSalonId()).toBeNull()
    setPersistedActiveSalonId('salon-b')
    expect(getPersistedActiveSalonId()).toBe('salon-b')
    expect(store.get(brand.storage.activeSalonId)).toBe('salon-b')
  })

  it('clears a stale salon selection so the picker can run again', () => {
    setPersistedActiveSalonId('salon-gone')
    clearPersistedActiveSalonId()
    expect(getPersistedActiveSalonId()).toBeNull()
  })
})
