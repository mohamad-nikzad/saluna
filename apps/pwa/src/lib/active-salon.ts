import { brand } from '@repo/brand'

const STORAGE_KEY = brand.storage.activeSalonId

/** Read the PWA-persisted active salon ID (staff multi-salon context). */
export function getPersistedActiveSalonId(): string | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(STORAGE_KEY)?.trim()
  return raw || null
}

/** Persist the staff-selected salon ID for tenant API calls. */
export function setPersistedActiveSalonId(salonId: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, salonId)
}

/** Clear a stale or revoked salon selection so the picker can run again. */
export function clearPersistedActiveSalonId(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
}
