import { and, count, eq, inArray, isNotNull, or } from 'drizzle-orm'
import { getDb } from '../client'
import {
  member,
  organization,
  salonOnboarding,
  salonProfile,
  salonPublicSettings,
  services,
  userMessagingAccounts,
} from '../schema'

export type OnboardingStatus = {
  salon: {
    id: string
    name: string
    slug: string
    phone: string | null
    address: string | null
  } | null
  steps: {
    businessHoursSet: boolean
    servicesAdded: boolean
    staffAdded: boolean
    presenceSet: boolean
    publicPageConfigured: boolean
    notificationsConfigured: boolean
  }
  completedAt: Date | null
  skippedAt: Date | null
}

export type OnboardingAction =
  | 'complete'
  | 'skip'
  | 'reopen'
  | 'set-manager-staff'
  | 'confirm-business-hours'

// Better Auth members with manager-level access; staff use `'member'`.
const MANAGER_ROLES = ['owner', 'admin']

export async function getOnboardingStatus(salonId: string): Promise<OnboardingStatus> {
  const db = getDb()

  const [
    salonRows,
    onboardingRows,
    serviceCount,
    staffCount,
    presenceRows,
    publicSettingsRows,
    notificationsRows,
  ] = await Promise.all([
    db
      .select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        phone: salonProfile.phone,
        address: salonProfile.address,
      })
      .from(organization)
      .leftJoin(salonProfile, eq(salonProfile.organizationId, organization.id))
      .where(eq(organization.id, salonId))
      .limit(1),

    db
      .select()
      .from(salonOnboarding)
      .where(eq(salonOnboarding.salonId, salonId))
      .limit(1),

    db
      .select({ value: count() })
      .from(services)
      .where(and(eq(services.salonId, salonId), eq(services.active, true))),

    db
      .select({ value: count() })
      .from(member)
      .where(and(eq(member.organizationId, salonId), eq(member.role, 'member'))),

    db
      .select({ id: salonProfile.organizationId })
      .from(salonProfile)
      .where(
        and(
          eq(salonProfile.organizationId, salonId),
          or(
            isNotNull(salonProfile.address),
            isNotNull(salonProfile.mapGoogle),
            isNotNull(salonProfile.mapNeshan),
            isNotNull(salonProfile.mapBalad),
            isNotNull(salonProfile.socialInstagram),
            isNotNull(salonProfile.socialTelegram),
            isNotNull(salonProfile.socialWhatsapp),
            isNotNull(salonProfile.website),
          )
        )
      )
      .limit(1),

    db
      .select({ enabled: salonPublicSettings.enabled })
      .from(salonPublicSettings)
      .where(eq(salonPublicSettings.salonId, salonId))
      .limit(1),

    db
      .select({ id: userMessagingAccounts.id })
      .from(userMessagingAccounts)
      .innerJoin(member, eq(member.userId, userMessagingAccounts.userId))
      .where(
        and(
          eq(member.organizationId, salonId),
          inArray(member.role, MANAGER_ROLES),
          eq(userMessagingAccounts.provider, 'telegram'),
          eq(userMessagingAccounts.enabled, true)
        )
      )
      .limit(1),
  ])

  const onboarding = onboardingRows[0]

  return {
    salon: salonRows[0] ?? null,
    steps: {
      businessHoursSet: onboarding?.businessHoursConfirmedAt != null,
      servicesAdded: (serviceCount[0]?.value ?? 0) > 0,
      staffAdded: (staffCount[0]?.value ?? 0) > 0 || onboarding?.managerIsStaff === true,
      presenceSet: presenceRows.length > 0,
      publicPageConfigured: publicSettingsRows[0]?.enabled === true,
      notificationsConfigured: notificationsRows.length > 0,
    },
    completedAt: onboarding?.completedAt ?? null,
    skippedAt: onboarding?.skippedAt ?? null,
  }
}

export async function confirmBusinessHours(salonId: string): Promise<void> {
  const db = getDb()
  const now = new Date()
  await db
    .insert(salonOnboarding)
    .values({
      salonId,
      businessHoursConfirmedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: salonOnboarding.salonId,
      set: {
        businessHoursConfirmedAt: now,
        updatedAt: now,
      },
    })
}

export async function updateOnboardingState(
  salonId: string,
  action: OnboardingAction
): Promise<OnboardingStatus> {
  const db = getDb()
  const now = new Date()

  if (action === 'confirm-business-hours') {
    await confirmBusinessHours(salonId)
    return getOnboardingStatus(salonId)
  }

  if (action === 'set-manager-staff') {
    await db
      .insert(salonOnboarding)
      .values({
        salonId,
        managerIsStaff: true,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: salonOnboarding.salonId,
        set: {
          managerIsStaff: true,
          updatedAt: now,
        },
      })
    return getOnboardingStatus(salonId)
  }

  if (action === 'reopen') {
    await db
      .insert(salonOnboarding)
      .values({
        salonId,
        completedAt: null,
        skippedAt: null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: salonOnboarding.salonId,
        set: {
          completedAt: null,
          skippedAt: null,
          updatedAt: now,
        },
      })
    return getOnboardingStatus(salonId)
  }

  await db
    .insert(salonOnboarding)
    .values({
      salonId,
      completedAt: action === 'complete' ? now : null,
      skippedAt: action === 'skip' ? now : null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: salonOnboarding.salonId,
      set: {
        ...(action === 'complete' ? { completedAt: now, skippedAt: null } : {}),
        ...(action === 'skip' ? { skippedAt: now, completedAt: null } : {}),
        updatedAt: now,
      },
    })

  return getOnboardingStatus(salonId)
}
