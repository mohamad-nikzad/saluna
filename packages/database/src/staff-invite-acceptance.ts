/**
 * Pure decision helpers for Staff Invite Acceptance and Decline, plus the
 * transactional list/accept/decline operations that create Staff Profile Access.
 */

import { and, eq, gt, isNull } from 'drizzle-orm'
import { getDb } from './client'
import {
  member,
  organization,
  salonMember,
  staffInvites,
  staffProfileAccesses,
  staffProfiles,
  user,
} from './schema'

export type StaffInviteAcceptanceRejectionReason =
  | 'phone_mismatch'
  | 'phone_unverified'
  | 'invite_not_pending'
  | 'invite_expired'
  | 'inactive_profile'
  | 'duplicate_salon_access'
  | 'profile_already_accepted'
  | 'invite_not_found'

export type StaffInviteDeclineRejectionReason =
  | 'phone_mismatch'
  | 'phone_unverified'
  | 'invite_not_pending'
  | 'invite_not_found'

type InviteSnapshot = {
  id: string
  salonId: string
  staffProfileId: string
  phone: string
  status: string
  expiresAt: Date
}

type IdentitySnapshot = {
  userId: string
  phoneNumber: string | null
  username: string | null
  verified: boolean
}

type ProfileSnapshot = {
  id: string
  salonId: string
  userId: string | null
  active: boolean
}

function phoneMatchesInvite(
  identity: IdentitySnapshot,
  invitePhone: string,
): boolean {
  return (
    identity.phoneNumber === invitePhone || identity.username === invitePhone
  )
}

export function evaluateStaffInviteAcceptance(input: {
  identity: IdentitySnapshot
  invite: InviteSnapshot | null
  profile: ProfileSnapshot | null
  existingAccessForUserSalon: { id: string; staffProfileId: string } | null
  existingAccessForProfile: { id: string; userId: string } | null
  now: Date
}):
  | { status: 'accept' }
  | { status: 'rejected'; reason: StaffInviteAcceptanceRejectionReason } {
  if (!input.invite) {
    return { status: 'rejected', reason: 'invite_not_found' }
  }
  if (!input.identity.verified) {
    return { status: 'rejected', reason: 'phone_unverified' }
  }
  if (!phoneMatchesInvite(input.identity, input.invite.phone)) {
    return { status: 'rejected', reason: 'phone_mismatch' }
  }
  if (input.invite.status !== 'pending') {
    return { status: 'rejected', reason: 'invite_not_pending' }
  }
  if (input.invite.expiresAt.getTime() <= input.now.getTime()) {
    return { status: 'rejected', reason: 'invite_expired' }
  }
  if (!input.profile || input.profile.id !== input.invite.staffProfileId) {
    return { status: 'rejected', reason: 'invite_not_found' }
  }
  if (!input.profile.active) {
    return { status: 'rejected', reason: 'inactive_profile' }
  }
  if (input.existingAccessForUserSalon) {
    return { status: 'rejected', reason: 'duplicate_salon_access' }
  }
  if (
    input.existingAccessForProfile ||
    (input.profile.userId !== null &&
      input.profile.userId !== input.identity.userId)
  ) {
    return { status: 'rejected', reason: 'profile_already_accepted' }
  }
  return { status: 'accept' }
}

export function evaluateStaffInviteDecline(input: {
  identity: IdentitySnapshot
  invite: InviteSnapshot | null
  now: Date
}):
  | { status: 'decline' }
  | { status: 'rejected'; reason: StaffInviteDeclineRejectionReason } {
  if (!input.invite) {
    return { status: 'rejected', reason: 'invite_not_found' }
  }
  if (!input.identity.verified) {
    return { status: 'rejected', reason: 'phone_unverified' }
  }
  if (!phoneMatchesInvite(input.identity, input.invite.phone)) {
    return { status: 'rejected', reason: 'phone_mismatch' }
  }
  if (input.invite.status !== 'pending') {
    return { status: 'rejected', reason: 'invite_not_pending' }
  }
  return { status: 'decline' }
}

export type PendingStaffInviteView = {
  id: string
  salonId: string
  salonName: string
  staffProfileId: string
  staffName: string
  phone: string
  expiresAt: Date
  createdAt: Date
}

async function loadVerifiedIdentity(userId: string) {
  const rows = await getDb()
    .select({
      userId: user.id,
      phoneNumber: user.phoneNumber,
      username: user.username,
      verified: user.phoneNumberVerified,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  const row = rows[0]
  if (!row) return null
  return {
    userId: row.userId,
    phoneNumber: row.phoneNumber,
    username: row.username,
    verified: row.verified,
  }
}

/**
 * Pending Staff Invites for the session identity's verified phone only.
 * Wrong-phone invites are never returned.
 */
export async function listPendingStaffInvitesForUser(
  userId: string,
  now: Date = new Date(),
): Promise<PendingStaffInviteView[]> {
  const identity = await loadVerifiedIdentity(userId)
  if (!identity?.verified) return []
  const phone = identity.phoneNumber ?? identity.username
  if (!phone) return []

  const rows = await getDb()
    .select({
      id: staffInvites.id,
      salonId: staffInvites.salonId,
      salonName: organization.name,
      staffProfileId: staffInvites.staffProfileId,
      staffName: staffProfiles.name,
      phone: staffInvites.phone,
      expiresAt: staffInvites.expiresAt,
      createdAt: staffInvites.createdAt,
    })
    .from(staffInvites)
    .innerJoin(organization, eq(organization.id, staffInvites.salonId))
    .innerJoin(
      staffProfiles,
      eq(staffProfiles.id, staffInvites.staffProfileId),
    )
    .where(
      and(
        eq(staffInvites.phone, phone),
        eq(staffInvites.status, 'pending'),
        gt(staffInvites.expiresAt, now),
      ),
    )

  return rows
}

export type AcceptStaffInviteResult =
  | {
      status: 'accepted'
      access: typeof staffProfileAccesses.$inferSelect
      invite: typeof staffInvites.$inferSelect
      preservedAccessSalonIds: string[]
    }
  | {
      status: 'rejected'
      reason: StaffInviteAcceptanceRejectionReason
    }

export async function acceptStaffInvite(input: {
  userId: string
  inviteId: string
  now?: Date
}): Promise<AcceptStaffInviteResult> {
  const db = getDb()
  const now = input.now ?? new Date()

  return db.transaction(async (tx) => {
    const identityRows = await tx
      .select({
        userId: user.id,
        phoneNumber: user.phoneNumber,
        username: user.username,
        verified: user.phoneNumberVerified,
      })
      .from(user)
      .where(eq(user.id, input.userId))
      .limit(1)
      .for('update')
    const identityRow = identityRows[0]
    if (!identityRow) {
      return { status: 'rejected', reason: 'invite_not_found' }
    }
    const identity: IdentitySnapshot = {
      userId: identityRow.userId,
      phoneNumber: identityRow.phoneNumber,
      username: identityRow.username,
      verified: identityRow.verified,
    }

    const inviteRows = await tx
      .select()
      .from(staffInvites)
      .where(eq(staffInvites.id, input.inviteId))
      .limit(1)
      .for('update')
    const invite = inviteRows[0] ?? null

    const profileRows = invite
      ? await tx
          .select()
          .from(staffProfiles)
          .where(eq(staffProfiles.id, invite.staffProfileId))
          .limit(1)
          .for('update')
      : []
    const profile = profileRows[0] ?? null

    const existingAccessForUserSalon = invite
      ? (
          await tx
            .select({
              id: staffProfileAccesses.id,
              staffProfileId: staffProfileAccesses.staffProfileId,
            })
            .from(staffProfileAccesses)
            .where(
              and(
                eq(staffProfileAccesses.userId, input.userId),
                eq(staffProfileAccesses.salonId, invite.salonId),
                isNull(staffProfileAccesses.revokedAt),
              ),
            )
            .limit(1)
            .for('update')
        )[0] ?? null
      : null

    const existingAccessForProfile = invite
      ? (
          await tx
            .select({
              id: staffProfileAccesses.id,
              userId: staffProfileAccesses.userId,
            })
            .from(staffProfileAccesses)
            .where(
              and(
                eq(staffProfileAccesses.staffProfileId, invite.staffProfileId),
                isNull(staffProfileAccesses.revokedAt),
              ),
            )
            .limit(1)
            .for('update')
        )[0] ?? null
      : null

    const decision = evaluateStaffInviteAcceptance({
      identity,
      invite,
      profile,
      existingAccessForUserSalon,
      existingAccessForProfile,
      now,
    })
    if (decision.status === 'rejected') {
      return decision
    }
    if (!invite || !profile) {
      return { status: 'rejected', reason: 'invite_not_found' }
    }

    const preservedAccess = await tx
      .select({ salonId: staffProfileAccesses.salonId })
      .from(staffProfileAccesses)
      .where(
        and(
          eq(staffProfileAccesses.userId, input.userId),
          isNull(staffProfileAccesses.revokedAt),
        ),
      )
    const preservedMemberships = await tx
      .select({ salonId: member.organizationId })
      .from(member)
      .where(eq(member.userId, input.userId))
    const preservedAccessSalonIds = [
      ...new Set([
        ...preservedAccess.map((row) => row.salonId),
        ...preservedMemberships.map((row) => row.salonId),
      ]),
    ].filter((salonId) => salonId !== invite.salonId)

    const [updatedInvite] = await tx
      .update(staffInvites)
      .set({
        status: 'accepted',
        acceptedAt: now,
        updatedAt: now,
      })
      .where(
        and(eq(staffInvites.id, invite.id), eq(staffInvites.status, 'pending')),
      )
      .returning()
    if (!updatedInvite) {
      return { status: 'rejected', reason: 'invite_not_pending' }
    }

    if (profile.userId !== input.userId) {
      await tx
        .update(staffProfiles)
        .set({
          userId: input.userId,
          claimedAt: profile.claimedAt ?? now,
          accessDetachedAt: null,
          updatedAt: now,
        })
        .where(eq(staffProfiles.id, profile.id))
    }

    const [access] = await tx
      .insert(staffProfileAccesses)
      .values({
        salonId: invite.salonId,
        staffProfileId: invite.staffProfileId,
        userId: input.userId,
        staffInviteId: invite.id,
        acceptedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
    if (!access) throw new Error('staff profile access creation failed')

    const hasMembership = preservedMemberships.some(
      (row) => row.salonId === invite.salonId,
    )
    if (!hasMembership) {
      await tx.insert(member).values({
        organizationId: invite.salonId,
        userId: input.userId,
        role: 'member',
      })
    }
    await tx
      .insert(salonMember)
      .values({
        organizationId: invite.salonId,
        userId: input.userId,
        displayName: profile.name,
        color: profile.color,
        active: profile.active,
      })
      .onConflictDoUpdate({
        target: [salonMember.userId, salonMember.organizationId],
        set: {
          displayName: profile.name,
          color: profile.color,
          active: profile.active,
        },
      })

    return {
      status: 'accepted',
      access,
      invite: updatedInvite,
      preservedAccessSalonIds,
    }
  })
}

export type DeclineStaffInviteResult =
  | {
      status: 'declined'
      invite: typeof staffInvites.$inferSelect
    }
  | {
      status: 'rejected'
      reason: StaffInviteDeclineRejectionReason
    }

export async function declineStaffInvite(input: {
  userId: string
  inviteId: string
  now?: Date
}): Promise<DeclineStaffInviteResult> {
  const db = getDb()
  const now = input.now ?? new Date()

  return db.transaction(async (tx) => {
    const identityRows = await tx
      .select({
        userId: user.id,
        phoneNumber: user.phoneNumber,
        username: user.username,
        verified: user.phoneNumberVerified,
      })
      .from(user)
      .where(eq(user.id, input.userId))
      .limit(1)
      .for('update')
    const identityRow = identityRows[0]
    if (!identityRow) {
      return { status: 'rejected', reason: 'invite_not_found' }
    }
    const identity: IdentitySnapshot = {
      userId: identityRow.userId,
      phoneNumber: identityRow.phoneNumber,
      username: identityRow.username,
      verified: identityRow.verified,
    }

    const inviteRows = await tx
      .select()
      .from(staffInvites)
      .where(eq(staffInvites.id, input.inviteId))
      .limit(1)
      .for('update')
    const invite = inviteRows[0] ?? null

    const decision = evaluateStaffInviteDecline({ identity, invite, now })
    if (decision.status === 'rejected') return decision
    if (!invite) return { status: 'rejected', reason: 'invite_not_found' }

    const [updatedInvite] = await tx
      .update(staffInvites)
      .set({
        status: 'declined',
        declinedAt: now,
        updatedAt: now,
      })
      .where(
        and(eq(staffInvites.id, invite.id), eq(staffInvites.status, 'pending')),
      )
      .returning()
    if (!updatedInvite) {
      return { status: 'rejected', reason: 'invite_not_pending' }
    }

    return { status: 'declined', invite: updatedInvite }
  })
}

export async function getStaffInviteById(inviteId: string) {
  const rows = await getDb()
    .select()
    .from(staffInvites)
    .where(eq(staffInvites.id, inviteId))
    .limit(1)
  return rows[0] ?? null
}

export async function listActiveStaffProfileAccessesForUser(userId: string) {
  return getDb()
    .select()
    .from(staffProfileAccesses)
    .where(
      and(
        eq(staffProfileAccesses.userId, userId),
        isNull(staffProfileAccesses.revokedAt),
      ),
    )
}
