/**
 * Staff Access Revocation: manager revoke, staff self-leave, and deactivate
 * that removes Staff Profile Access only — the Staff Profile and operational
 * data remain salon-owned.
 */

import { and, eq, isNull } from 'drizzle-orm'
import { getDb } from './client'
import {
  appointmentRequests,
  appointments,
  member,
  salonMember,
  staffProfileAccesses,
  staffProfiles,
  staffSchedules,
  staffServices,
} from './schema'

export type StaffAccessRevocationRejectionReason =
  | 'access_not_found'
  | 'already_revoked'
  | 'profile_not_found'
  | 'wrong_salon'

export type StaffAccessRevocationMode = 'revoke_only' | 'deactivate'

type AccessSnapshot = {
  id: string
  salonId: string
  staffProfileId: string
  userId: string
  revokedAt: Date | null
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

/**
 * Pure decision for whether Staff Profile Access may be revoked.
 * Deactivate without an access row is still allowed when a profile exists.
 */
export function evaluateStaffAccessRevocation(input: {
  mode: StaffAccessRevocationMode
  salonId: string
  profile: ProfileSnapshot | null
  access: AccessSnapshot | null
}):
  | { status: 'ok'; profile: ProfileSnapshot; access: AccessSnapshot | null }
  | { status: 'rejected'; reason: StaffAccessRevocationRejectionReason } {
  const { mode, salonId, profile, access } = input

  if (!profile) {
    return { status: 'rejected', reason: 'profile_not_found' }
  }
  if (profile.salonId !== salonId) {
    return { status: 'rejected', reason: 'wrong_salon' }
  }

  if (access) {
    if (access.salonId !== salonId || access.staffProfileId !== profile.id) {
      return { status: 'rejected', reason: 'wrong_salon' }
    }
    if (access.revokedAt != null) {
      if (mode === 'deactivate') {
        return { status: 'ok', profile, access }
      }
      return { status: 'rejected', reason: 'already_revoked' }
    }
    return { status: 'ok', profile, access }
  }

  // Claim-path: profile linked by userId without an access row.
  if (profile.userId != null) {
    return { status: 'ok', profile, access: null }
  }

  if (mode === 'deactivate') {
    return { status: 'ok', profile, access: null }
  }

  return { status: 'rejected', reason: 'access_not_found' }
}

export type RevokeStaffProfileAccessResult =
  | {
      status: 'revoked'
      access: typeof staffProfileAccesses.$inferSelect | null
      profile: typeof staffProfiles.$inferSelect
      profileDeactivated: boolean
    }
  | {
      status: 'rejected'
      reason: StaffAccessRevocationRejectionReason
    }

async function loadProfileAndAccess(
  tx: DbTx,
  input: {
    salonId: string
    staffProfileId?: string
    userId?: string
  },
): Promise<{
  profile: typeof staffProfiles.$inferSelect | null
  access: typeof staffProfileAccesses.$inferSelect | null
}> {
  let access: typeof staffProfileAccesses.$inferSelect | null = null
  let profile: typeof staffProfiles.$inferSelect | null = null

  if (input.userId) {
    const accessRows = await tx
      .select()
      .from(staffProfileAccesses)
      .where(
        and(
          eq(staffProfileAccesses.salonId, input.salonId),
          eq(staffProfileAccesses.userId, input.userId),
          isNull(staffProfileAccesses.revokedAt),
        ),
      )
      .limit(1)
      .for('update')
    access = accessRows[0] ?? null

    if (access) {
      const profileRows = await tx
        .select()
        .from(staffProfiles)
        .where(eq(staffProfiles.id, access.staffProfileId))
        .limit(1)
        .for('update')
      profile = profileRows[0] ?? null
    } else {
      const profileRows = await tx
        .select()
        .from(staffProfiles)
        .where(
          and(
            eq(staffProfiles.salonId, input.salonId),
            eq(staffProfiles.userId, input.userId),
          ),
        )
        .limit(1)
        .for('update')
      profile = profileRows[0] ?? null
    }
  } else if (input.staffProfileId) {
    const profileRows = await tx
      .select()
      .from(staffProfiles)
      .where(eq(staffProfiles.id, input.staffProfileId))
      .limit(1)
      .for('update')
    profile = profileRows[0] ?? null

    if (profile) {
      const accessRows = await tx
        .select()
        .from(staffProfileAccesses)
        .where(
          and(
            eq(staffProfileAccesses.staffProfileId, profile.id),
            isNull(staffProfileAccesses.revokedAt),
          ),
        )
        .limit(1)
        .for('update')
      access = accessRows[0] ?? null
    }
  }

  return { profile, access }
}

/**
 * Detach login access from a Staff Profile and move operational refs back onto
 * the profile id. Does not delete schedule, capabilities, or appointments.
 */
async function detachAccessFromProfile(
  tx: DbTx,
  input: {
    profile: typeof staffProfiles.$inferSelect
    access: typeof staffProfileAccesses.$inferSelect | null
    linkedUserId: string | null
    now: Date
    deactivate: boolean
  },
): Promise<{
  access: typeof staffProfileAccesses.$inferSelect | null
  profile: typeof staffProfiles.$inferSelect
}> {
  const { profile, access, linkedUserId, now, deactivate } = input

  let updatedAccess: typeof staffProfileAccesses.$inferSelect | null = access
  if (access && access.revokedAt == null) {
    const [row] = await tx
      .update(staffProfileAccesses)
      .set({
        revokedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(staffProfileAccesses.id, access.id),
          isNull(staffProfileAccesses.revokedAt),
        ),
      )
      .returning()
    updatedAccess = row ?? access
  }

  const [updatedProfile] = await tx
    .update(staffProfiles)
    .set({
      userId: null,
      accessDetachedAt: now,
      ...(deactivate ? { active: false } : {}),
      updatedAt: now,
    })
    .where(eq(staffProfiles.id, profile.id))
    .returning()
  if (!updatedProfile) throw new Error('staff profile detach failed')

  if (linkedUserId) {
    await Promise.all([
      tx
        .update(staffSchedules)
        .set({ staffId: profile.id, updatedAt: now })
        .where(
          and(
            eq(staffSchedules.salonId, profile.salonId),
            eq(staffSchedules.staffId, linkedUserId),
          ),
        ),
      tx
        .update(staffServices)
        .set({ staffUserId: profile.id })
        .where(
          and(
            eq(staffServices.salonId, profile.salonId),
            eq(staffServices.staffUserId, linkedUserId),
          ),
        ),
      tx
        .update(appointments)
        .set({ staffId: profile.id, updatedAt: now })
        .where(
          and(
            eq(appointments.salonId, profile.salonId),
            eq(appointments.staffId, linkedUserId),
          ),
        ),
      tx
        .update(appointmentRequests)
        .set({ staffId: profile.id, updatedAt: now })
        .where(
          and(
            eq(appointmentRequests.salonId, profile.salonId),
            eq(appointmentRequests.staffId, linkedUserId),
          ),
        ),
    ])

    await tx
      .delete(salonMember)
      .where(
        and(
          eq(salonMember.organizationId, profile.salonId),
          eq(salonMember.userId, linkedUserId),
        ),
      )
    await tx
      .delete(member)
      .where(
        and(
          eq(member.organizationId, profile.salonId),
          eq(member.userId, linkedUserId),
          eq(member.role, 'member'),
        ),
      )
  } else if (deactivate && profile.active) {
    // Pending / unclaimed profile: deactivate without access detach side effects.
  }

  return { access: updatedAccess, profile: updatedProfile }
}

async function runRevocation(input: {
  salonId: string
  staffProfileId?: string
  userId?: string
  mode: StaffAccessRevocationMode
  now?: Date
}): Promise<RevokeStaffProfileAccessResult> {
  const db = getDb()
  const now = input.now ?? new Date()

  return db.transaction(async (tx) => {
    const { profile, access } = await loadProfileAndAccess(tx, {
      salonId: input.salonId,
      staffProfileId: input.staffProfileId,
      userId: input.userId,
    })

    const decision = evaluateStaffAccessRevocation({
      mode: input.mode,
      salonId: input.salonId,
      profile: profile
        ? {
            id: profile.id,
            salonId: profile.salonId,
            userId: profile.userId,
            active: profile.active,
          }
        : null,
      access: access
        ? {
            id: access.id,
            salonId: access.salonId,
            staffProfileId: access.staffProfileId,
            userId: access.userId,
            revokedAt: access.revokedAt,
          }
        : null,
    })
    if (decision.status === 'rejected') return decision
    if (!profile) {
      return { status: 'rejected', reason: 'profile_not_found' }
    }

    const linkedUserId =
      access?.userId ?? profile.userId ?? input.userId ?? null

    // Deactivate-only with no linked identity and no access: just flip active.
    if (
      input.mode === 'deactivate' &&
      !access &&
      profile.userId == null &&
      !linkedUserId
    ) {
      if (!profile.active) {
        return {
          status: 'revoked',
          access: null,
          profile,
          profileDeactivated: true,
        }
      }
      const [updatedProfile] = await tx
        .update(staffProfiles)
        .set({ active: false, updatedAt: now })
        .where(eq(staffProfiles.id, profile.id))
        .returning()
      if (!updatedProfile) throw new Error('staff profile deactivate failed')
      return {
        status: 'revoked',
        access: null,
        profile: updatedProfile,
        profileDeactivated: true,
      }
    }

    const result = await detachAccessFromProfile(tx, {
      profile,
      access,
      linkedUserId,
      now,
      deactivate: input.mode === 'deactivate',
    })

    return {
      status: 'revoked',
      access: result.access,
      profile: result.profile,
      profileDeactivated: input.mode === 'deactivate',
    }
  })
}

/** Manager (or system) revokes Staff Profile Access without deactivating the profile. */
export async function revokeStaffProfileAccess(input: {
  salonId: string
  /** Target staff user id (accepted access) or Staff Profile id. */
  targetId: string
  now?: Date
}): Promise<RevokeStaffProfileAccessResult> {
  // Prefer user-id resolution; fall back to profile id when no user match.
  const byUser = await runRevocation({
    salonId: input.salonId,
    userId: input.targetId,
    mode: 'revoke_only',
    now: input.now,
  })
  if (byUser.status === 'revoked') return byUser
  if (
    byUser.reason !== 'profile_not_found' &&
    byUser.reason !== 'access_not_found'
  ) {
    return byUser
  }
  return runRevocation({
    salonId: input.salonId,
    staffProfileId: input.targetId,
    mode: 'revoke_only',
    now: input.now,
  })
}

/** Staff leaves a salon: revokes only their own Staff Profile Access. */
export async function leaveStaffProfileAccess(input: {
  userId: string
  salonId: string
  now?: Date
}): Promise<RevokeStaffProfileAccessResult> {
  return runRevocation({
    salonId: input.salonId,
    userId: input.userId,
    mode: 'revoke_only',
    now: input.now,
  })
}

/**
 * Deactivate a Staff Profile and revoke any active Staff Profile Access.
 * Schedule, capabilities, appointments, and history are preserved.
 */
export async function deactivateStaffProfileWithAccessRevocation(input: {
  salonId: string
  targetId: string
  now?: Date
}): Promise<RevokeStaffProfileAccessResult> {
  const byUser = await runRevocation({
    salonId: input.salonId,
    userId: input.targetId,
    mode: 'deactivate',
    now: input.now,
  })
  if (byUser.status === 'revoked') return byUser
  if (
    byUser.reason !== 'profile_not_found' &&
    byUser.reason !== 'access_not_found'
  ) {
    return byUser
  }
  return runRevocation({
    salonId: input.salonId,
    staffProfileId: input.targetId,
    mode: 'deactivate',
    now: input.now,
  })
}

export type ReactivateStaffProfileResult =
  | {
      status: 'reactivated'
      profile: typeof staffProfiles.$inferSelect
    }
  | {
      status: 'rejected'
      reason: 'profile_not_found' | 'wrong_salon' | 'already_active'
    }

/**
 * Reactivate a Staff Profile without restoring revoked Staff Profile Access.
 * A fresh Staff Invite is required for login access again.
 */
export async function reactivateStaffProfile(input: {
  salonId: string
  staffProfileId: string
  now?: Date
}): Promise<ReactivateStaffProfileResult> {
  const db = getDb()
  const now = input.now ?? new Date()

  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(staffProfiles)
      .where(eq(staffProfiles.id, input.staffProfileId))
      .limit(1)
      .for('update')
    const profile = rows[0]
    if (!profile) {
      return { status: 'rejected', reason: 'profile_not_found' }
    }
    if (profile.salonId !== input.salonId) {
      return { status: 'rejected', reason: 'wrong_salon' }
    }
    if (profile.active) {
      return { status: 'rejected', reason: 'already_active' }
    }

    const [updated] = await tx
      .update(staffProfiles)
      .set({ active: true, updatedAt: now })
      .where(eq(staffProfiles.id, profile.id))
      .returning()
    if (!updated) throw new Error('staff profile reactivate failed')

    // Intentionally do not clear staff_profile_accesses.revokedAt or restore
    // membership — reactivation must not restore old access.
    return { status: 'reactivated', profile: updated }
  })
}
