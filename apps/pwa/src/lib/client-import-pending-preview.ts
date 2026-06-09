import type { ClientImportPreview } from '@repo/salon-core'

const STORAGE_KEY = 'saluna:client-import-pending-preview'

export function stashClientImportPreview(preview: ClientImportPreview): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(preview))
}

export function takeClientImportPreview(): ClientImportPreview | null {
  const raw = sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  sessionStorage.removeItem(STORAGE_KEY)
  try {
    return JSON.parse(raw) as ClientImportPreview
  } catch {
    return null
  }
}
