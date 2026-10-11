import { createHash, randomBytes } from 'node:crypto'
import { and, eq, gt, isNotNull, isNull, ne, or } from 'drizzle-orm'

import { getDb } from './client'
import {
  account,
  member,
  organization,
  salonHandoff,
  salonMember,
  salonOnboarding,
  salonProfile,
  salonPublicSettings,
  user,
} from './schema'

const HANDOFF_TTL_MS = 24 * 60 * 60 * 1000

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function updateSetupSalonOwnerPhone(input: {
  salonId: string
  intendedOwnerPhone: string
}) {
  return getDb().transaction(async (tx) => {
    const [updated] = await tx
      .update(salonProfile)
      .set({ intendedOwnerPhone: input.intendedOwnerPhone })
      .where(
        and(
          eq(salonProfile.organizationId, input.salonId),
          eq(salonProfile.status, 'setup'),
        ),
      )
      .returning({
        salonId: salonProfile.organizationId,
        intendedOwnerPhone: salonProfile.intendedOwnerPhone,
      })
    if (updated) {
      await tx
        .update(salonHandoff)
        .set({ consumedAt: new Date() })
        .where(
          and(
            eq(salonHandoff.salonId, input.salonId),
            isNull(salonHandoff.consumedAt),
          ),
        )
    }
    return updated
  })
}

export async function createSalonHandoff(input: {
  salonId: string
  createdByUserId: string
  enablePublicPage: boolean
}) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + HANDOFF_TTL_MS)
  const db = getDb()

  await db.transaction(async (tx) => {
    await tx
      .update(salonHandoff)
      .set({ consumedAt: new Date() })
      .where(
        and(
          eq(salonHandoff.salonId, input.salonId),
          isNull(salonHandoff.consumedAt),
        ),
      )
    await tx.insert(salonHandoff).values({
      salonId: input.salonId,
      tokenHash: hashToken(token),
      expiresAt,
      createdByUserId: input.createdByUserId,
      enablePublicPage: input.enablePublicPage,
    })
  })

  return { token, expiresAt }
}

export async function getActiveSalonHandoff(token: string) {
  const rows = await getDb()
    .select({
      handoffId: salonHandoff.id,
      salonId: salonHandoff.salonId,
      expiresAt: salonHandoff.expiresAt,
      intendedOwnerPhone: salonProfile.intendedOwnerPhone,
      credentialPassword: account.password,
    })
    .from(salonHandoff)
    .innerJoin(
      salonProfile,
      eq(salonProfile.organizationId, salonHandoff.salonId),
    )
    .leftJoin(
      user,
      or(
        eq(user.phoneNumber, salonProfile.intendedOwnerPhone),
        eq(user.username, salonProfile.intendedOwnerPhone),
      ),
    )
    .leftJoin(
      account,
      and(eq(account.userId, user.id), eq(account.providerId, 'credential')),
    )
    .where(
      and(
        eq(salonHandoff.tokenHash, hashToken(token)),
        isNull(salonHandoff.consumedAt),
        gt(salonHandoff.expiresAt, new Date()),
        eq(salonProfile.status, 'setup'),
      ),
    )
    .limit(1)
  return rows[0]
}

export type SalonIdentityConflict = {
  salonId: string
  salonName: string
  salonStatus: 'setup' | 'active' | 'suspended' | 'archived'
}

export async function getSalonIdentityConflictForPhone(input: {
  phone: string
  excludingSalonId?: string
}): Promise<SalonIdentityConflict | undefined> {
  const conditions = [
    or(eq(user.phoneNumber, input.phone), eq(user.username, input.phone)),
  ]
  if (input.excludingSalonId) {
    conditions.push(ne(member.organizationId, input.excludingSalonId))
  }
  const rows = await getDb()
    .select({
      salonId: organization.id,
      salonName: organization.name,
      salonStatus: salonProfile.status,
    })
    .from(user)
    .innerJoin(member, eq(member.userId, user.id))
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .innerJoin(salonProfile, eq(salonProfile.organizationId, organization.id))
    .where(and(...conditions))
    .limit(1)
  return rows[0]
}

export async function hasCredentialPassword(userId: string) {
  const rows = await getDb()
    .select({ id: account.id })
    .from(account)
    .where(
      and(
        eq(account.userId, userId),
        eq(account.providerId, 'credential'),
        isNotNull(account.password),
      ),
    )
    .limit(1)
  return Boolean(rows[0])
}

export type CompleteSalonHandoffResult =
  | { status: 'completed'; salonId: string; publicEnabled: boolean }
  | { status: 'invalid' }
  | { status: 'phone_mismatch' }
  | { status: 'identity_conflict'; conflict: SalonIdentityConflict }

export async function completeSalonHandoff(input: {
  token: string
  userId: string
  displayName: string
}): Promise<CompleteSalonHandoffResult> {
  const db = getDb()
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({
        handoffId: salonHandoff.id,
        salonId: salonHandoff.salonId,
        intendedOwnerPhone: salonProfile.intendedOwnerPhone,
        salonStatus: salonProfile.status,
        consumedAt: salonHandoff.consumedAt,
        expiresAt: salonHandoff.expiresAt,
        enablePublicPage: salonHandoff.enablePublicPage,
        userPhone: user.phoneNumber,
        username: user.username,
      })
      .from(salonHandoff)
      .innerJoin(
        salonProfile,
        eq(salonProfile.organizationId, salonHandoff.salonId),
      )
      .innerJoin(user, eq(user.id, input.userId))
      .where(eq(salonHandoff.tokenHash, hashToken(input.token)))
      .limit(1)
      .for('update')
    const claim = rows[0]
    if (!claim?.intendedOwnerPhone) return { status: 'invalid' as const }
    if (
      claim.userPhone !== claim.intendedOwnerPhone &&
      claim.username !== claim.intendedOwnerPhone
    ) {
      return { status: 'phone_mismatch' as const }
    }

    if (claim.consumedAt || claim.salonStatus !== 'setup') {
      const existingOwner = await tx
        .select({ id: member.id })
        .from(member)
        .where(
          and(
            eq(member.organizationId, claim.salonId),
            eq(member.userId, input.userId),
            eq(member.role, 'owner'),
          ),
        )
        .limit(1)
      if (!existingOwner[0]) return { status: 'invalid' as const }
      const publication = await tx
        .select({ enabled: salonPublicSettings.enabled })
        .from(salonPublicSettings)
        .where(eq(salonPublicSettings.salonId, claim.salonId))
        .limit(1)
      return {
        status: 'completed' as const,
        salonId: claim.salonId,
        publicEnabled: publication[0]?.enabled ?? false,
      }
    }
    if (claim.expiresAt <= new Date()) return { status: 'invalid' as const }

    const conflicts = await tx
      .select({
        salonId: organization.id,
        salonName: organization.name,
        salonStatus: salonProfile.status,
      })
      .from(member)
      .innerJoin(organization, eq(organization.id, member.organizationId))
      .innerJoin(salonProfile, eq(salonProfile.organizationId, organization.id))
      .where(
        and(
          eq(member.userId, input.userId),
          ne(member.organizationId, claim.salonId),
        ),
      )
      .limit(1)
    if (conflicts[0]) {
      return { status: 'identity_conflict' as const, conflict: conflicts[0] }
    }

    await tx.insert(member).values({
      organizationId: claim.salonId,
      userId: input.userId,
      role: 'owner',
    })
    await tx.insert(salonMember).values({
      organizationId: claim.salonId,
      userId: input.userId,
      displayName: input.displayName,
      active: true,
    })
    const now = new Date()
    await tx
      .update(user)
      .set({ name: input.displayName, updatedAt: now })
      .where(eq(user.id, input.userId))
    await tx
      .update(salonProfile)
      .set({ status: 'active' })
      .where(eq(salonProfile.organizationId, claim.salonId))
    await tx
      .update(salonPublicSettings)
      .set({ enabled: claim.enablePublicPage })
      .where(eq(salonPublicSettings.salonId, claim.salonId))
    await tx
      .update(salonOnboarding)
      .set({ completedAt: now, skippedAt: null, updatedAt: now })
      .where(eq(salonOnboarding.salonId, claim.salonId))
    await tx
      .update(salonHandoff)
      .set({ consumedAt: now })
      .where(eq(salonHandoff.id, claim.handoffId))

    return {
      status: 'completed' as const,
      salonId: claim.salonId,
      publicEnabled: claim.enablePublicPage,
    }
  })
}
