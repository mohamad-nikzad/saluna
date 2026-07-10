/**
 * Staff Profile Access authorization: decide whether a staff identity may enter
 * a salon tenant context, and which Staff Profile that context is linked to.
 */

import { and, eq, isNotNull, isNull, or } from 'drizzle-orm'
import { getDb } from './client'
import {
  member,
  organization,
  salonMember,
  salonProfile,
  staffProfileAccesses,
  staffProfiles,
  user,
} from './schema'

export type StaffTenantAccessRejectionReason =
  | 'no_access'
  | 'wrong_salon'
  | 'inactive_profile'
  | 'salon_required'

export type ActiveStaffProfileAccessSnapshot = {
  salonId: string
  staffProfileId: string
  profileActive: boolean
}

export type StaffTenantAccessDecision =
  | {
      status: 'ok'
      salonId: string
      staffProfileId: string
    }
  | {
      status: 'rejected'
      reason: StaffTenantAccessRejectionReason
    }

export type ResolveStaffTenantContextResult =
  | {
      status: 'ok'
      userId: string
      salonId: string
      staffProfileId: string
      name: string
      phone: string
      salonStatus?: 'setup' | 'active' | 'suspended' | 'archived'
    }
  | {
      status: 'rejected'
      reason: StaffTenantAccessRejectionReason
    }

/**
 * Pure decision for staff tenant authorization via Staff Profile Access.
 * Pending, declined, expired, and revoked invites never appear in
 * `activeAccesses` — only non-revoked access rows with their linked profile.
 */
export function evaluateStaffTenantAccess(input: {
  requestedSalonId: string | null
  activeAccesses: ActiveStaffProfileAccessSnapshot[]
}): StaffTenantAccessDecision {
  const { requestedSalonId, activeAccesses } = input

  if (activeAccesses.length === 0) {
    return { status: 'rejected', reason: 'no_access' }
  }

  if (requestedSalonId == null) {
    if (activeAccesses.length > 1) {
      return { status: 'rejected', reason: 'salon_required' }
    }
    const sole = activeAccesses[0]!
    if (!sole.profileActive) {
      return { status: 'rejected', reason: 'inactive_profile' }
    }
    return {
      status: 'ok',
      salonId: sole.salonId,
      staffProfileId: sole.staffProfileId,
    }
  }

  const match = activeAccesses.find(
    (access) => access.salonId === requestedSalonId,
  )
  if (!match) {
    return { status: 'rejected', reason: 'wrong_salon' }
  }
  if (!match.profileActive) {
    return { status: 'rejected', reason: 'inactive_profile' }
  }
  return {
    status: 'ok',
    salonId: match.salonId,
    staffProfileId: match.staffProfileId,
  }
}

/**
 * Active Staff Profile Access rows for a staff identity, plus claim-path
 * compatibility when a Staff Profile is still linked via `userId` without an
 * access row (one-salon claim before invite-based access).
 */
export async function listActiveStaffProfileAccessesForUser(
  userId: string,
): Promise<ActiveStaffProfileAccessSnapshot[]> {
  const db = getDb()
  const accessRows = await db
    .select({
      salonId: staffProfileAccesses.salonId,
      staffProfileId: staffProfileAccesses.staffProfileId,
      profileActive: staffProfiles.active,
    })
    .from(staffProfileAccesses)
    .innerJoin(
      staffProfiles,
      eq(staffProfiles.id, staffProfileAccesses.staffProfileId),
    )
    .where(
      and(
        eq(staffProfileAccesses.userId, userId),
        isNull(staffProfileAccesses.revokedAt),
      ),
    )

  const claimedProfiles = await db
    .select({
      salonId: staffProfiles.salonId,
      staffProfileId: staffProfiles.id,
      profileActive: staffProfiles.active,
    })
    .from(staffProfiles)
    .where(
      and(
        eq(staffProfiles.userId, userId),
        isNull(staffProfiles.accessDetachedAt),
      ),
    )

  const bySalon = new Map<string, ActiveStaffProfileAccessSnapshot>()
  for (const row of accessRows) {
    bySalon.set(row.salonId, row)
  }
  for (const row of claimedProfiles) {
    if (!bySalon.has(row.salonId)) {
      bySalon.set(row.salonId, row)
    }
  }
  return [...bySalon.values()]
}

/**
 * Resolve staff tenant context from Staff Profile Access for the requested
 * salon (or the sole salon when the header is omitted).
 */
export async function resolveStaffTenantContext(input: {
  userId: string
  requestedSalonId: string | null
}): Promise<ResolveStaffTenantContextResult> {
  const activeAccesses = await listActiveStaffProfileAccessesForUser(
    input.userId,
  )
  const decision = evaluateStaffTenantAccess({
    requestedSalonId: input.requestedSalonId,
    activeAccesses,
  })
  if (decision.status === 'rejected') return decision

  const db = getDb()
  const rows = await db
    .select({
      userId: member.userId,
      organizationId: member.organizationId,
      salonStatus: salonProfile.status,
      name: user.name,
      displayName: salonMember.displayName,
      phoneNumber: user.phoneNumber,
      username: user.username,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .leftJoin(
      salonProfile,
      eq(salonProfile.organizationId, member.organizationId),
    )
    .leftJoin(
      salonMember,
      and(
        eq(salonMember.userId, member.userId),
        eq(salonMember.organizationId, member.organizationId),
      ),
    )
    .where(
      and(
        eq(member.userId, input.userId),
        eq(member.organizationId, decision.salonId),
        eq(member.role, 'member'),
        or(isNull(salonMember.active), eq(salonMember.active, true)),
      ),
    )
    .limit(1)

  const row = rows[0]
  if (!row) {
    return { status: 'rejected', reason: 'no_access' }
  }

  return {
    status: 'ok',
    userId: row.userId,
    salonId: decision.salonId,
    staffProfileId: decision.staffProfileId,
    name: row.displayName?.trim() || row.name,
    phone: row.phoneNumber ?? row.username ?? '',
    salonStatus: row.salonStatus ?? undefined,
  }
}

export type StaffNotificationRecipientCandidate = {
  userId: string
  salonId: string
  staffProfileId: string
  profileActive: boolean
}

/**
 * Pure decision for staff notification recipient resolution.
 * Candidates must already exclude pending/declined/expired invites and
 * revoked Staff Profile Access — only active access (or claim-path) rows.
 */
export function evaluateStaffNotificationRecipient(input: {
  salonId: string
  staffId: string
  candidates: StaffNotificationRecipientCandidate[]
}): { userId: string; staffProfileId: string } | null {
  const match = input.candidates.find(
    (candidate) =>
      candidate.salonId === input.salonId &&
      candidate.profileActive &&
      (candidate.userId === input.staffId ||
        candidate.staffProfileId === input.staffId),
  )
  if (!match) return null
  return { userId: match.userId, staffProfileId: match.staffProfileId }
}

export type StaffNotificationRecipient = {
  userId: string
  staffProfileId: string
  salonId: string
  salonName: string
}

/**
 * Resolve the verified identity that should receive a staff notification for
 * an appointment assigned to `staffId` (user id or Staff Profile id) in a salon.
 * Returns null when there is no active Staff Profile Access (pending, declined,
 * expired, revoked, or unclaimed profile).
 */
export async function resolveStaffNotificationRecipient(input: {
  salonId: string
  staffId: string
}): Promise<StaffNotificationRecipient | null> {
  const db = getDb()

  const accessRows = await db
    .select({
      userId: staffProfileAccesses.userId,
      salonId: staffProfileAccesses.salonId,
      staffProfileId: staffProfileAccesses.staffProfileId,
      profileActive: staffProfiles.active,
      salonName: organization.name,
    })
    .from(staffProfileAccesses)
    .innerJoin(
      staffProfiles,
      eq(staffProfiles.id, staffProfileAccesses.staffProfileId),
    )
    .innerJoin(
      organization,
      eq(organization.id, staffProfileAccesses.salonId),
    )
    .where(
      and(
        eq(staffProfileAccesses.salonId, input.salonId),
        isNull(staffProfileAccesses.revokedAt),
        or(
          eq(staffProfileAccesses.userId, input.staffId),
          eq(staffProfileAccesses.staffProfileId, input.staffId),
        ),
      ),
    )

  const fromAccess = evaluateStaffNotificationRecipient({
    salonId: input.salonId,
    staffId: input.staffId,
    candidates: accessRows,
  })
  if (fromAccess) {
    const row = accessRows.find(
      (candidate) =>
        candidate.userId === fromAccess.userId &&
        candidate.staffProfileId === fromAccess.staffProfileId,
    )
    if (!row) return null
    return {
      userId: fromAccess.userId,
      staffProfileId: fromAccess.staffProfileId,
      salonId: row.salonId,
      salonName: row.salonName,
    }
  }

  // Claim-path compatibility when no Staff Profile Access row exists yet.
  // Do not fall back when a revoked access row exists for this identity+salon.
  const claimedRows = await db
    .select({
      userId: staffProfiles.userId,
      salonId: staffProfiles.salonId,
      staffProfileId: staffProfiles.id,
      profileActive: staffProfiles.active,
      salonName: organization.name,
    })
    .from(staffProfiles)
    .innerJoin(organization, eq(organization.id, staffProfiles.salonId))
    .where(
      and(
        eq(staffProfiles.salonId, input.salonId),
        isNull(staffProfiles.accessDetachedAt),
        isNotNull(staffProfiles.userId),
        or(
          eq(staffProfiles.id, input.staffId),
          eq(staffProfiles.userId, input.staffId),
        ),
      ),
    )
    .limit(1)

  const claimed = claimedRows[0]
  if (!claimed?.userId || !claimed.profileActive) return null

  const revokedRows = await db
    .select({ id: staffProfileAccesses.id })
    .from(staffProfileAccesses)
    .where(
      and(
        eq(staffProfileAccesses.salonId, input.salonId),
        eq(staffProfileAccesses.userId, claimed.userId),
        isNotNull(staffProfileAccesses.revokedAt),
      ),
    )
    .limit(1)
  if (revokedRows[0]) return null

  return {
    userId: claimed.userId,
    staffProfileId: claimed.staffProfileId,
    salonId: claimed.salonId,
    salonName: claimed.salonName,
  }
}
