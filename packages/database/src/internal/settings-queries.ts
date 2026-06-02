import { eq } from 'drizzle-orm'
import type { BusinessHours } from '@repo/salon-core/types'
import { getDb } from '../client'
import { businessSettings } from '../schema'
import { confirmBusinessHours } from './onboarding-queries'

const defaultBusinessHours: BusinessHours = {
  workingStart: '09:00',
  workingEnd: '19:00',
  slotDurationMinutes: 30,
  // Default working days: Saturday–Thursday (Friday off). See ADR-0004.
  workingDays: 126,
}

export async function getBusinessSettings(salonId: string): Promise<BusinessHours> {
  const db = getDb()
  const rows = await db
    .select()
    .from(businessSettings)
    .where(eq(businessSettings.salonId, salonId))
    .limit(1)
  const row = rows[0]
  if (!row) return defaultBusinessHours
  return {
    workingStart: row.workingStart,
    workingEnd: row.workingEnd,
    slotDurationMinutes: row.slotDurationMinutes,
    workingDays: row.workingDays,
  }
}

export async function updateBusinessSettings(
  salonId: string,
  data: Partial<BusinessHours>
): Promise<BusinessHours> {
  const db = getDb()
  const current = await getBusinessSettings(salonId)
  const next = { ...current, ...data }
  await db
    .insert(businessSettings)
    .values({
      salonId,
      workingStart: next.workingStart,
      workingEnd: next.workingEnd,
      slotDurationMinutes: next.slotDurationMinutes,
      workingDays: next.workingDays,
    })
    .onConflictDoUpdate({
      target: businessSettings.salonId,
      set: {
        workingStart: next.workingStart,
        workingEnd: next.workingEnd,
        slotDurationMinutes: next.slotDurationMinutes,
        workingDays: next.workingDays,
      },
    })
  await confirmBusinessHours(salonId)
  return next
}
