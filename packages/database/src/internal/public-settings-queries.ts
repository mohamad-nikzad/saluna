import { and, eq, inArray, ne } from 'drizzle-orm'
import type { PublicSettingsPayload } from '@repo/salon-core/forms/public'
import { DEFAULT_PUBLIC_THEME_ID } from '@repo/salon-core/public-themes'
import { DEFAULT_PUBLIC_LAYOUT_ID } from '@repo/salon-core/public-layouts'
import type { Service } from '@repo/salon-core/types'

import { getDb } from '../client'
import type { MessagingProviderId } from '../messaging-provider-id'
import { organization, salonPublicSettings, servicePublicVisibility } from '../schema'
import { getAllServices } from './service-queries'

export type ManagerPublicSettingsView = {
  enabled: boolean
  bioText: string | null
  themeId: string
  layoutId: string
  appointmentRequestsEnabled: boolean
}

export type ManagerServiceVisibilityView = {
  service: Service
  visible: boolean
}

export type ManagerPublicSettingsResult = {
  slug: string
  salonName: string
  settings: ManagerPublicSettingsView
  services: ManagerServiceVisibilityView[]
}

const DEFAULTS: ManagerPublicSettingsView = {
  enabled: false,
  bioText: null,
  themeId: DEFAULT_PUBLIC_THEME_ID,
  layoutId: DEFAULT_PUBLIC_LAYOUT_ID,
  appointmentRequestsEnabled: true,
}

type SalonPublicSettingsRow = typeof salonPublicSettings.$inferSelect

/** Builds the salon_public_settings row for manager upserts (unit-tested). */
export function buildManagerPublicSettingsUpsertFields(
  salonId: string,
  payload: PublicSettingsPayload,
  base?: SalonPublicSettingsRow
) {
  return {
    salonId,
    enabled: payload.enabled ?? base?.enabled ?? false,
    bioText: payload.bioText ?? base?.bioText ?? null,
    themeId: payload.themeId ?? base?.themeId ?? DEFAULT_PUBLIC_THEME_ID,
    layoutId: payload.layoutId ?? base?.layoutId ?? DEFAULT_PUBLIC_LAYOUT_ID,
    appointmentRequestsEnabled:
      payload.appointmentRequestsEnabled ?? base?.appointmentRequestsEnabled ?? true,
    enabledMessagingProviders: base?.enabledMessagingProviders ?? [],
    updatedAt: new Date(),
  }
}

export async function getManagerPublicSettings(
  salonId: string
): Promise<ManagerPublicSettingsResult> {
  const db = getDb()
  const salonRows = await db
    .select({ slug: organization.slug, name: organization.name })
    .from(organization)
    .where(eq(organization.id, salonId))
    .limit(1)
  const slug = salonRows[0]?.slug ?? ''
  const salonName = salonRows[0]?.name ?? ''
  const settingsRows = await db
    .select()
    .from(salonPublicSettings)
    .where(eq(salonPublicSettings.salonId, salonId))
    .limit(1)
  const row = settingsRows[0]
  const settings: ManagerPublicSettingsView = row
    ? {
        enabled: row.enabled,
        bioText: row.bioText,
        themeId: row.themeId,
        layoutId: row.layoutId,
        appointmentRequestsEnabled: row.appointmentRequestsEnabled,
      }
    : { ...DEFAULTS }

  const services = await getAllServices(salonId, false)
  const visibilityRows = await db
    .select()
    .from(servicePublicVisibility)
    .where(eq(servicePublicVisibility.salonId, salonId))
  const byServiceId = new Map(visibilityRows.map((r) => [r.serviceId, r]))

  const items: ManagerServiceVisibilityView[] = services.map((service) => {
    const vis = byServiceId.get(service.id)
    return {
      service,
      visible: vis ? vis.visible : true,
    }
  })

  items.sort((a, b) => a.service.name.localeCompare(b.service.name, 'fa'))

  return { slug, salonName, settings, services: items }
}

/**
 * Returns the set of messaging providers a salon has enabled. Used by the
 * notifications dispatcher to skip providers a salon has disabled at the
 * tenant level.
 */
export async function getEnabledMessagingProvidersForSalon(
  salonId: string
): Promise<MessagingProviderId[]> {
  const db = getDb()
  const [row] = await db
    .select({ providers: salonPublicSettings.enabledMessagingProviders })
    .from(salonPublicSettings)
    .where(eq(salonPublicSettings.salonId, salonId))
    .limit(1)
  return row?.providers ?? []
}

export async function enableMessagingProviderForSalon(
  salonId: string,
  provider: MessagingProviderId
): Promise<void> {
  const db = getDb()
  const current = await getEnabledMessagingProvidersForSalon(salonId)
  if (current.includes(provider)) return

  const next = [...current, provider]
  const [existing] = await db
    .select({ salonId: salonPublicSettings.salonId })
    .from(salonPublicSettings)
    .where(eq(salonPublicSettings.salonId, salonId))
    .limit(1)

  if (existing) {
    await db
      .update(salonPublicSettings)
      .set({ enabledMessagingProviders: next, updatedAt: new Date() })
      .where(eq(salonPublicSettings.salonId, salonId))
    return
  }

  await db.insert(salonPublicSettings).values({
    salonId,
    enabled: false,
    themeId: DEFAULT_PUBLIC_THEME_ID,
    layoutId: DEFAULT_PUBLIC_LAYOUT_ID,
    appointmentRequestsEnabled: true,
    enabledMessagingProviders: next,
  })
}

export async function updateManagerPublicSettings(
  salonId: string,
  payload: PublicSettingsPayload
): Promise<ManagerPublicSettingsResult> {
  const db = getDb()

  await db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(salonPublicSettings)
      .where(eq(salonPublicSettings.salonId, salonId))
      .limit(1)

    const base = existing[0]
    const next = buildManagerPublicSettingsUpsertFields(salonId, payload, base)

    if (base) {
      await tx
        .update(salonPublicSettings)
        .set(next)
        .where(eq(salonPublicSettings.salonId, salonId))
    } else {
      await tx.insert(salonPublicSettings).values(next)
    }

    if (payload.services && payload.services.length > 0) {
      const serviceIds = payload.services.map((s) => s.serviceId)
      await tx
        .delete(servicePublicVisibility)
        .where(
          and(
            eq(servicePublicVisibility.salonId, salonId),
            inArray(servicePublicVisibility.serviceId, serviceIds)
          )
        )
      await tx.insert(servicePublicVisibility).values(
        payload.services.map((s) => ({
          salonId,
          serviceId: s.serviceId,
          visible: s.visible,
          updatedAt: new Date(),
        }))
      )
    }
  })

  return getManagerPublicSettings(salonId)
}

function isSlugConflict(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : ''
  return (
    msg.includes('already') ||
    msg.includes('exists') ||
    msg.includes('duplicate') ||
    msg.includes('unique') ||
    msg.includes('23505')
  )
}

export type UpdateSalonSlugResult =
  | { ok: true; result: ManagerPublicSettingsResult }
  | { ok: false; reason: 'conflict' }

export async function updateSalonSlug(
  salonId: string,
  slug: string,
): Promise<UpdateSalonSlugResult> {
  const db = getDb()

  const taken = await db
    .select({ id: organization.id })
    .from(organization)
    .where(and(eq(organization.slug, slug), ne(organization.id, salonId)))
    .limit(1)
  if (taken[0]) {
    return { ok: false, reason: 'conflict' }
  }

  try {
    await db
      .update(organization)
      .set({ slug })
      .where(eq(organization.id, salonId))
  } catch (err) {
    if (isSlugConflict(err)) {
      return { ok: false, reason: 'conflict' }
    }
    throw err
  }

  return { ok: true, result: await getManagerPublicSettings(salonId) }
}
