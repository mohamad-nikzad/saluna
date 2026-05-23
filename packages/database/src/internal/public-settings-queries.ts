import { and, eq, inArray } from 'drizzle-orm'
import type { PublicSettingsPayload } from '@repo/salon-core/forms/public'
import { DEFAULT_PUBLIC_THEME_ID } from '@repo/salon-core/public-themes'
import { DEFAULT_PUBLIC_LAYOUT_ID } from '@repo/salon-core/public-layouts'
import type { Service } from '@repo/salon-core/types'

import { getDb } from '../client'
import { salonPublicSettings, salons, servicePublicVisibility } from '../schema'
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

export async function getManagerPublicSettings(
  salonId: string
): Promise<ManagerPublicSettingsResult> {
  const db = getDb()
  const salonRows = await db
    .select({ slug: salons.slug, name: salons.name })
    .from(salons)
    .where(eq(salons.id, salonId))
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
    const next = {
      salonId,
      enabled: payload.enabled ?? base?.enabled ?? false,
      bioText: payload.bioText ?? base?.bioText ?? null,
      themeId: payload.themeId ?? base?.themeId ?? DEFAULT_PUBLIC_THEME_ID,
      layoutId: payload.layoutId ?? base?.layoutId ?? DEFAULT_PUBLIC_LAYOUT_ID,
      appointmentRequestsEnabled:
        payload.appointmentRequestsEnabled ??
        base?.appointmentRequestsEnabled ??
        true,
      updatedAt: new Date(),
    }

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
