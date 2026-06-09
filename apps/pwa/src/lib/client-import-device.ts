import {
  buildClientImportPreview,
  mapDeviceContactsToDrafts,
  type ClientImportPreview,
} from '@repo/salon-core'

import { pickDeviceContacts } from '#/lib/device-contacts'

export async function pickDeviceContactsForImport(
  existingPhones: ReadonlySet<string>,
): Promise<ClientImportPreview | null> {
  const rows = await pickDeviceContacts({ multiple: true })
  if (!rows || rows.length === 0) return null

  const drafts = mapDeviceContactsToDrafts(rows)
  if (drafts.length === 0) return null

  return buildClientImportPreview(drafts, existingPhones)
}
