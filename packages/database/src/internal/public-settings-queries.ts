import { and, eq, inArray } from 'drizzle-orm'
import type { PublicSettingsPayload } from '@repo/salon-core/forms/public'
import type { Service } from '@repo/salon-core/types'

import { getDb } from '../client'
import { salonPublicSettings, salons, servicePublicVisibility } from '../schema'
import { getAllServices } from './service-queries'

export type ManagerPublicSettingsView = {
  enabled: boolean
  logoUrl: string | null
  bannerUrl: string | null
  bioText: string | null
  accentColor: string | null
  appointmentRequestsEnabled: boolean
}

export type ManagerServiceVisibilityView = {
  service: Service
  visible: boolean
  sortOrder: number
}

export type ManagerPublicSettingsResult = {
  slug: string
  settings: ManagerPublicSettingsView
  services: ManagerServiceVisibilityView[]
}

const DEFAULTS: ManagerPublicSettingsView = {
  enabled: false,
  logoUrl: null,
  bannerUrl: null,
  bioText: null,
  accentColor: null,
  appointmentRequestsEnabled: true,
}

export async function getManagerPublicSettings(
  salonId: string
): Promise<ManagerPublicSettingsResult> {
  const db = getDb()
  const salonRows = await db
    .select({ slug: salons.slug })
    .from(salons)
    .where(eq(salons.id, salonId))
    .limit(1)
  const slug = salonRows[0]?.slug ?? ''
  const settingsRows = await db
    .select()
    .from(salonPublicSettings)
    .where(eq(salonPublicSettings.salonId, salonId))
    .limit(1)
  const row = settingsRows[0]
  const settings: ManagerPublicSettingsView = row
    ? {
        enabled: row.enabled,
        logoUrl: row.logoUrl,
        bannerUrl: row.bannerUrl,
        bioText: row.bioText,
        accentColor: row.accentColor,
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
      sortOrder: vis ? vis.sortOrder : Number.MAX_SAFE_INTEGER,
    }
  })

  items.sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
    return a.service.name.localeCompare(b.service.name, 'fa')
  })

  return { slug, settings, services: items }
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
      logoUrl: payload.logoUrl ?? base?.logoUrl ?? null,
      bannerUrl: payload.bannerUrl ?? base?.bannerUrl ?? null,
      bioText: payload.bioText ?? base?.bioText ?? null,
      accentColor: payload.accentColor ?? base?.accentColor ?? null,
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
          sortOrder: s.sortOrder,
          updatedAt: new Date(),
        }))
      )
    }
  })

  return getManagerPublicSettings(salonId)
}
