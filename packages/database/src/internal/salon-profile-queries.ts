import { eq } from 'drizzle-orm'
import type { PresencePatchPayload } from '@repo/salon-core/forms/presence'

import { getDb } from '../client'
import { salonProfile } from '../schema'

export type SalonPresenceView = {
  address: string | null
  mapGoogle: string | null
  mapNeshan: string | null
  mapBalad: string | null
  socialInstagram: string | null
  socialTelegram: string | null
  socialWhatsapp: string | null
  website: string | null
}

const PRESENCE_FIELDS = [
  'address',
  'mapGoogle',
  'mapNeshan',
  'mapBalad',
  'socialInstagram',
  'socialTelegram',
  'socialWhatsapp',
  'website',
] as const

function toView(row: typeof salonProfile.$inferSelect): SalonPresenceView {
  return {
    address: row.address,
    mapGoogle: row.mapGoogle,
    mapNeshan: row.mapNeshan,
    mapBalad: row.mapBalad,
    socialInstagram: row.socialInstagram,
    socialTelegram: row.socialTelegram,
    socialWhatsapp: row.socialWhatsapp,
    website: row.website,
  }
}

/**
 * Persists salon presence fields onto `salon_profile`. Only keys present in
 * `payload` are written; omitted keys are left unchanged. An explicit `null` or
 * empty value clears the column. The `salon_profile` row always exists (created
 * at signup), so this is an update keyed by `organizationId`.
 */
export async function updateSalonPresence(
  salonId: string,
  payload: PresencePatchPayload
): Promise<SalonPresenceView> {
  const db = getDb()

  const set: Partial<Record<(typeof PRESENCE_FIELDS)[number], string | null>> = {}
  for (const field of PRESENCE_FIELDS) {
    if (field in payload) {
      set[field] = payload[field] ?? null
    }
  }

  if (Object.keys(set).length === 0) {
    return getSalonPresence(salonId)
  }

  const rows = await db
    .update(salonProfile)
    .set(set)
    .where(eq(salonProfile.organizationId, salonId))
    .returning()

  const row = rows[0]
  if (row) return toView(row)

  // Row missing (defensive): create it so presence persists.
  const inserted = await db
    .insert(salonProfile)
    .values({ organizationId: salonId, ...set })
    .returning()
  return toView(inserted[0]!)
}

export async function getSalonPresence(
  salonId: string
): Promise<SalonPresenceView> {
  const db = getDb()
  const rows = await db
    .select()
    .from(salonProfile)
    .where(eq(salonProfile.organizationId, salonId))
    .limit(1)
  const row = rows[0]
  if (!row) {
    return {
      address: null,
      mapGoogle: null,
      mapNeshan: null,
      mapBalad: null,
      socialInstagram: null,
      socialTelegram: null,
      socialWhatsapp: null,
      website: null,
    }
  }
  return toView(row)
}
