/**
 * Staff Invite Acceptance and Decline: pure decision helpers plus transactional
 * list/accept/decline that create Staff Profile Access.
 */

import { and, eq, gt, isNull } from 'drizzle-orm'
import { getDb } from './client'
import {
  appointmentRequests,
  appointments,
  member,
  organization,
  salonMember,
  staffInvites,
  staffProfileAccesses,
  staffProfiles,
  staffSchedules,
  staffServices,
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

type DbTx = Parameters<
  Parameters<ReturnType<typeof getDb>['transaction']>[0]
>[0]

function phoneMatchesInvite(
  identity: IdentitySnapshot,
  invitePhone: string,
): boolean {
  return (
    identity.phoneNumber === invitePhone || identity.username === invitePhone
  )
}

/** Shared phone/pending gate for accept and decline. */
function evaluateInvitePhoneGate(
  identity: IdentitySnapshot,
  invite: InviteSnapshot | null,
):
  | { status: 'ok'; invite: InviteSnapshot }
  | {
      status: 'rejected'
      reason: StaffInviteDeclineRejectionReason
    } {
  if (!invite) {
    return { status: 'rejected', reason: 'invite_not_found' }
  }
  if (!identity.verified) {
    return { status: 'rejected', reason: 'phone_unverified' }
  }
  if (!phoneMatchesInvite(identity, invite.phone)) {
    return { status: 'rejected', reason: 'phone_mismatch' }
  }
  if (invite.status !== 'pending') {
    return { status: 'rejected', reason: 'invite_not_pending' }
  }
  return { status: 'ok', invite }
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
  const gate = evaluateInvitePhoneGate(input.identity, input.invite)
  if (gate.status === 'rejected') return gate

  const { invite } = gate
  if (invite.expiresAt.getTime() <= input.now.getTime()) {
    return { status: 'rejected', reason: 'invite_expired' }
  }
  if (!input.profile || input.profile.id !== invite.staffProfileId) {
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
}):
  | { status: 'decline' }
  | { status: 'rejected'; reason: StaffInviteDeclineRejectionReason } {
  const gate = evaluateInvitePhoneGate(input.identity, input.invite)
  if (gate.status === 'rejected') return gate
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

/** Pending Staff Invites for the session identity's verified phone only. */
export async function listPendingStaffInvitesForUser(
  userId: string,
  now: Date = new Date(),
): Promise<PendingStaffInviteView[]> {
  const identity = await loadVerifiedIdentity(userId)
  if (!identity?.verified) return []
  const phone = identity.phoneNumber ?? identity.username
  if (!phone) return []

  return getDb()
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

async function lockIdentityAndInvite(
  tx: DbTx,
  userId: string,
  inviteId: string,
): Promise<{
  identity: IdentitySnapshot | null
  invite: typeof staffInvites.$inferSelect | null
}> {
  const identityRows = await tx
    .select({
      userId: user.id,
      phoneNumber: user.phoneNumber,
      username: user.username,
      verified: user.phoneNumberVerified,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
    .for('update')
  const identityRow = identityRows[0]
  const identity: IdentitySnapshot | null = identityRow
    ? {
        userId: identityRow.userId,
        phoneNumber: identityRow.phoneNumber,
        username: identityRow.username,
        verified: identityRow.verified,
      }
    : null

  const inviteRows = await tx
    .select()
    .from(staffInvites)
    .where(eq(staffInvites.id, inviteId))
    .limit(1)
    .for('update')

  return { identity, invite: inviteRows[0] ?? null }
}

export async function acceptStaffInvite(input: {
  userId: string
  inviteId: string
  now?: Date
}): Promise<AcceptStaffInviteResult> {
  const db = getDb()
  const now = input.now ?? new Date()

  return db.transaction(async (tx) => {
    const { identity, invite } = await lockIdentityAndInvite(
      tx,
      input.userId,
      input.inviteId,
    )
    if (!identity) {
      return { status: 'rejected', reason: 'invite_not_found' }
    }

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
      if (
        decision.reason === 'invite_expired' &&
        invite &&
        invite.status === 'pending'
      ) {
        await tx
          .update(staffInvites)
          .set({
            status: 'expired',
            expiredAt: now,
            updatedAt: now,
          })
          .where(
            and(
              eq(staffInvites.id, invite.id),
              eq(staffInvites.status, 'pending'),
            ),
          )
      }
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

    // Keep staff_profiles.userId linked for claim-path compatibility and
    // migrate operational refs onto the verified identity (same as claim).
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

    await Promise.all([
      tx
        .update(staffSchedules)
        .set({ staffId: input.userId, updatedAt: now })
        .where(
          and(
            eq(staffSchedules.salonId, invite.salonId),
            eq(staffSchedules.staffId, profile.id),
          ),
        ),
      tx
        .update(staffServices)
        .set({ staffUserId: input.userId })
        .where(
          and(
            eq(staffServices.salonId, invite.salonId),
            eq(staffServices.staffUserId, profile.id),
          ),
        ),
      tx
        .update(appointments)
        .set({ staffId: input.userId, updatedAt: now })
        .where(
          and(
            eq(appointments.salonId, invite.salonId),
            eq(appointments.staffId, profile.id),
          ),
        ),
      tx
        .update(appointmentRequests)
        .set({ staffId: input.userId, updatedAt: now })
        .where(
          and(
            eq(appointmentRequests.salonId, invite.salonId),
            eq(appointmentRequests.staffId, profile.id),
          ),
        ),
    ])

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
    const { identity, invite } = await lockIdentityAndInvite(
      tx,
      input.userId,
      input.inviteId,
    )
    if (!identity) {
      return { status: 'rejected', reason: 'invite_not_found' }
    }

    const decision = evaluateStaffInviteDecline({ identity, invite })
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
