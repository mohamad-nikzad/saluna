export type { DeviceContactPickerRow } from '@repo/salon-core/device-contacts'

import type { DeviceContactPickerRow } from '@repo/salon-core/device-contacts'

export function isDeviceContactPickerSupported(): boolean {
  return (
    'contacts' in navigator && typeof navigator.contacts?.select === 'function'
  )
}

function mapPickerRows(
  rows: Array<{ name?: string[]; tel?: string[] }>,
): DeviceContactPickerRow[] {
  return rows.map((row) => ({
    name: row.name ?? [],
    tel: row.tel ?? [],
  }))
}

export async function pickDeviceContacts(options: {
  multiple: boolean
}): Promise<DeviceContactPickerRow[] | null> {
  if (!isDeviceContactPickerSupported()) return null

  const contacts = navigator.contacts
  if (!contacts) return null

  try {
    const rows = await contacts.select(['name', 'tel'], {
      multiple: options.multiple,
    })
    if (!rows || rows.length === 0) return null
    return mapPickerRows(rows)
  } catch {
    return null
  }
}
