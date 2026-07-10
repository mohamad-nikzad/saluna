import { createHash, randomBytes } from 'node:crypto'
import { and, eq, or, isNull } from 'drizzle-orm'
import { STAFF_COLORS } from '@repo/salon-core/types'
import { normalizeCalendarColorId } from '@repo/salon-core/calendar-colors'
import { getDb } from './client'
import {
  member,
  organization,
  salonMember,
  staffInvites,
  staffProfiles,
  user,
} from './schema'

export const STAFF_INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000

export type ManagerStaffInviteRejectionReason =
  | 'inactive_profile'
  | 'duplicate_pending_invite'
  | 'duplicate_active_profile'

export type ManagerStaffInviteDecision =
  | { status: 'create_profile' }
  | { status: 'reuse_profile'; profileId: string }
  | { status: 'rejected'; reason: ManagerStaffInviteRejectionReason }

type ExistingProfile = {
  id: string
  salonId: string
  userId: string | null
  phone: string
  active: boolean
}

export function evaluateManagerStaffInvite(input: {
  existingProfile: ExistingProfile | null
  pendingInvite: { id: string; staffProfileId: string } | null
  legacyMemberWithPhone: boolean
}): ManagerStaffInviteDecision {
  if (input.pendingInvite) {
    return { status: 'rejected', reason: 'duplicate_pending_invite' }
  }
  if (input.legacyMemberWithPhone) {
    return { status: 'rejected', reason: 'duplicate_active_profile' }
  }
  if (!input.existingProfile) {
    return { status: 'create_profile' }
  }
  if (!input.existingProfile.active) {
    return { status: 'rejected', reason: 'inactive_profile' }
  }
  if (input.existingProfile.userId !== null) {
    return { status: 'rejected', reason: 'duplicate_active_profile' }
  }
  return { status: 'reuse_profile', profileId: input.existingProfile.id }
}

function hashInviteToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function newInviteToken() {
  return randomBytes(32).toString('base64url')
}

export type CreateManagerStaffInviteInput = {
  salonId: string
  name: string
  phone: string
  invitedByUserId: string
  now?: Date
}

export type CreateManagerStaffInviteResult =
  | {
      status: 'created'
      profile: typeof staffProfiles.$inferSelect
      invite: typeof staffInvites.$inferSelect
      inviteToken: string
    }
  | {
      status: 'rejected'
      reason: ManagerStaffInviteRejectionReason
    }

export async function createManagerStaffInvite(
  input: CreateManagerStaffInviteInput,
): Promise<CreateManagerStaffInviteResult> {
  const db = getDb()
  const now = input.now ?? new Date()

  return db.transaction(async (tx) => {
    const existingProfiles = await tx
      .select()
      .from(staffProfiles)
      .where(
        and(
          eq(staffProfiles.salonId, input.salonId),
          eq(staffProfiles.phone, input.phone),
        ),
      )
      .limit(1)
      .for('update')
    const existingProfile = existingProfiles[0] ?? null

    const pendingInvites = await tx
      .select({
        id: staffInvites.id,
        staffProfileId: staffInvites.staffProfileId,
      })
      .from(staffInvites)
      .where(
        and(
          eq(staffInvites.salonId, input.salonId),
          eq(staffInvites.phone, input.phone),
          eq(staffInvites.status, 'pending'),
        ),
      )
      .limit(1)
      .for('update')
    const pendingInvite = pendingInvites[0] ?? null

    const legacyActive = await tx
      .select({ userId: user.id, active: salonMember.active })
      .from(user)
      .innerJoin(member, eq(member.userId, user.id))
      .leftJoin(
        salonMember,
        and(
          eq(salonMember.userId, user.id),
          eq(salonMember.organizationId, input.salonId),
        ),
      )
      .where(
        and(
          eq(member.organizationId, input.salonId),
          eq(user.phoneNumber, input.phone),
          eq(member.role, 'member'),
          or(isNull(salonMember.active), eq(salonMember.active, true)),
        ),
      )
      .limit(1)
    const legacyMemberWithPhone = legacyActive[0] != null

    const decision = evaluateManagerStaffInvite({
      existingProfile,
      pendingInvite,
      legacyMemberWithPhone,
    })
    if (decision.status === 'rejected') {
      return { status: 'rejected', reason: decision.reason }
    }

    let profile = existingProfile
    if (decision.status === 'create_profile') {
      const existingCount = (
        await tx
          .select({ id: staffProfiles.id })
          .from(staffProfiles)
          .where(eq(staffProfiles.salonId, input.salonId))
      ).length
      const colorIndex = existingCount % STAFF_COLORS.length
      const [created] = await tx
        .insert(staffProfiles)
        .values({
          salonId: input.salonId,
          name: input.name,
          phone: input.phone,
          color: normalizeCalendarColorId(STAFF_COLORS[colorIndex]),
          active: true,
        })
        .returning()
      if (!created) throw new Error('staff profile creation failed')
      profile = created
    } else if (profile && profile.name !== input.name) {
      const [updated] = await tx
        .update(staffProfiles)
        .set({ name: input.name, updatedAt: now })
        .where(eq(staffProfiles.id, profile.id))
        .returning()
      if (updated) profile = updated
    }

    if (!profile) throw new Error('staff profile missing after invite decision')

    const inviteToken = newInviteToken()
    const [invite] = await tx
      .insert(staffInvites)
      .values({
        salonId: input.salonId,
        staffProfileId: profile.id,
        phone: input.phone,
        status: 'pending',
        tokenHash: hashInviteToken(inviteToken),
        invitedByUserId: input.invitedByUserId,
        expiresAt: new Date(now.getTime() + STAFF_INVITE_TTL_MS),
        // Delivery metadata is recorded without sending SMS (v1 hook).
        lastDeliveredAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
    if (!invite) throw new Error('staff invite creation failed')

    return {
      status: 'created',
      profile,
      invite,
      inviteToken,
    }
  })
}

export type CancelManagerStaffInviteRejectionReason =
  | 'invite_not_found'
  | 'invite_not_pending'

export type CancelManagerStaffInviteResult =
  | {
      status: 'cancelled'
      invite: typeof staffInvites.$inferSelect
      profile: typeof staffProfiles.$inferSelect
    }
  | {
      status: 'rejected'
      reason: CancelManagerStaffInviteRejectionReason
    }

/** Cancel a pending Staff Invite. Keeps the salon-owned Staff Profile. */
export async function cancelManagerStaffInvite(input: {
  salonId: string
  staffProfileId: string
  now?: Date
}): Promise<CancelManagerStaffInviteResult> {
  const db = getDb()
  const now = input.now ?? new Date()

  return db.transaction(async (tx) => {
    const profileRows = await tx
      .select()
      .from(staffProfiles)
      .where(
        and(
          eq(staffProfiles.id, input.staffProfileId),
          eq(staffProfiles.salonId, input.salonId),
        ),
      )
      .limit(1)
      .for('update')
    const profile = profileRows[0]
    if (!profile) {
      return { status: 'rejected', reason: 'invite_not_found' }
    }

    const inviteRows = await tx
      .select()
      .from(staffInvites)
      .where(
        and(
          eq(staffInvites.salonId, input.salonId),
          eq(staffInvites.staffProfileId, input.staffProfileId),
          eq(staffInvites.status, 'pending'),
        ),
      )
      .limit(1)
      .for('update')
    const invite = inviteRows[0]
    if (!invite) {
      return { status: 'rejected', reason: 'invite_not_pending' }
    }

    const [updatedInvite] = await tx
      .update(staffInvites)
      .set({
        status: 'revoked',
        revokedAt: now,
        updatedAt: now,
      })
      .where(
        and(eq(staffInvites.id, invite.id), eq(staffInvites.status, 'pending')),
      )
      .returning()
    if (!updatedInvite) {
      return { status: 'rejected', reason: 'invite_not_pending' }
    }

    return { status: 'cancelled', invite: updatedInvite, profile }
  })
}

export type ResendManagerStaffInviteRejectionReason =
  | 'invite_not_found'
  | 'invite_not_pending'
  | 'inactive_profile'

export type ResendManagerStaffInviteResult =
  | {
      status: 'resent'
      invite: typeof staffInvites.$inferSelect
      profile: typeof staffProfiles.$inferSelect
      inviteToken: string
    }
  | {
      status: 'rejected'
      reason: ResendManagerStaffInviteRejectionReason
    }

/**
 * Resend a pending Staff Invite: new token, refreshed expiry and delivery
 * metadata. Does not create another Staff Profile.
 */
export async function resendManagerStaffInvite(input: {
  salonId: string
  staffProfileId: string
  now?: Date
}): Promise<ResendManagerStaffInviteResult> {
  const db = getDb()
  const now = input.now ?? new Date()

  return db.transaction(async (tx) => {
    const profileRows = await tx
      .select()
      .from(staffProfiles)
      .where(
        and(
          eq(staffProfiles.id, input.staffProfileId),
          eq(staffProfiles.salonId, input.salonId),
        ),
      )
      .limit(1)
      .for('update')
    const profile = profileRows[0]
    if (!profile) {
      return { status: 'rejected', reason: 'invite_not_found' }
    }
    if (!profile.active) {
      return { status: 'rejected', reason: 'inactive_profile' }
    }

    const inviteRows = await tx
      .select()
      .from(staffInvites)
      .where(
        and(
          eq(staffInvites.salonId, input.salonId),
          eq(staffInvites.staffProfileId, input.staffProfileId),
          eq(staffInvites.status, 'pending'),
        ),
      )
      .limit(1)
      .for('update')
    const invite = inviteRows[0]
    if (!invite) {
      return { status: 'rejected', reason: 'invite_not_pending' }
    }

    const inviteToken = newInviteToken()
    const [updatedInvite] = await tx
      .update(staffInvites)
      .set({
        tokenHash: hashInviteToken(inviteToken),
        expiresAt: new Date(now.getTime() + STAFF_INVITE_TTL_MS),
        lastDeliveredAt: now,
        updatedAt: now,
      })
      .where(
        and(eq(staffInvites.id, invite.id), eq(staffInvites.status, 'pending')),
      )
      .returning()
    if (!updatedInvite) {
      return { status: 'rejected', reason: 'invite_not_pending' }
    }

    return {
      status: 'resent',
      invite: updatedInvite,
      profile,
      inviteToken,
    }
  })
}

export type StaffInviteDeliveryChannel = 'link' | 'sms'

export type StaffInviteDeliveryResult =
  | {
      status: 'recorded'
      channel: StaffInviteDeliveryChannel
      deliveredAt: Date
      invite: typeof staffInvites.$inferSelect
    }
  | { status: 'skipped'; reason: 'sms_not_configured' }
  | { status: 'rejected'; reason: 'invite_not_found' | 'invite_not_pending' }

/**
 * Future delivery hook for Staff Invites.
 * v1 records delivery metadata for the link channel and skips real SMS.
 * Callers may pass a plaintext token for a future SMS body; this function
 * never sends messages.
 */
export async function deliverStaffInvite(input: {
  inviteId: string
  channel?: StaffInviteDeliveryChannel
  /** Reserved for a future SMS body; unused in v1. */
  inviteToken?: string
  now?: Date
}): Promise<StaffInviteDeliveryResult> {
  const channel = input.channel ?? 'link'
  const now = input.now ?? new Date()

  if (channel === 'sms') {
    // Real SMS provider integration is out of scope for v1.
    return { status: 'skipped', reason: 'sms_not_configured' }
  }

  const [updated] = await getDb()
    .update(staffInvites)
    .set({ lastDeliveredAt: now, updatedAt: now })
    .where(
      and(
        eq(staffInvites.id, input.inviteId),
        eq(staffInvites.status, 'pending'),
      ),
    )
    .returning()

  if (!updated) {
    return { status: 'rejected', reason: 'invite_not_found' }
  }

  return {
    status: 'recorded',
    channel: 'link',
    deliveredAt: now,
    invite: updated,
  }
}

export type StaffInviteLinkView = {
  inviteId: string
  salonId: string
  salonName: string
  staffProfileId: string
  staffName: string
  phone: string
  expiresAt: Date
  status: 'pending' | 'expired' | 'revoked' | 'accepted' | 'declined'
}

export type ResolveStaffInviteByTokenResult =
  | { status: 'ok'; invite: StaffInviteLinkView }
  | { status: 'not_found' }

/**
 * Resolve an invite link token. Never grants access — only returns routing
 * metadata. Marks past-due pending invites as expired for support visibility.
 * Returns the raw invite phone for server-side matching; callers must mask
 * before exposing it to clients.
 */
export async function resolveStaffInviteByToken(input: {
  token: string
  now?: Date
}): Promise<ResolveStaffInviteByTokenResult> {
  const now = input.now ?? new Date()
  const db = getDb()
  const tokenHash = hashInviteToken(input.token)

  const rows = await db
    .select({
      id: staffInvites.id,
      salonId: staffInvites.salonId,
      salonName: organization.name,
      staffProfileId: staffInvites.staffProfileId,
      staffName: staffProfiles.name,
      phone: staffInvites.phone,
      expiresAt: staffInvites.expiresAt,
      status: staffInvites.status,
    })
    .from(staffInvites)
    .innerJoin(organization, eq(organization.id, staffInvites.salonId))
    .innerJoin(
      staffProfiles,
      eq(staffProfiles.id, staffInvites.staffProfileId),
    )
    .where(eq(staffInvites.tokenHash, tokenHash))
    .limit(1)

  const row = rows[0]
  if (!row) return { status: 'not_found' }

  let status = row.status
  let expiresAt = row.expiresAt
  if (status === 'pending' && expiresAt.getTime() <= now.getTime()) {
    const [expired] = await db
      .update(staffInvites)
      .set({
        status: 'expired',
        expiredAt: now,
        updatedAt: now,
      })
      .where(
        and(eq(staffInvites.id, row.id), eq(staffInvites.status, 'pending')),
      )
      .returning({
        status: staffInvites.status,
        expiresAt: staffInvites.expiresAt,
      })
    if (expired) {
      status = expired.status
      expiresAt = expired.expiresAt
    } else {
      status = 'expired'
    }
  }

  return {
    status: 'ok',
    invite: {
      inviteId: row.id,
      salonId: row.salonId,
      salonName: row.salonName,
      staffProfileId: row.staffProfileId,
      staffName: row.staffName,
      phone: row.phone,
      expiresAt,
      status: status as StaffInviteLinkView['status'],
    },
  }
}

export function maskStaffInvitePhone(phone: string) {
  if (phone.length < 8) return phone
  return `${phone.slice(0, 4)}•••${phone.slice(-4)}`
}

/**
 * Pure routing decision for an invite link given session + phone registration.
 * Invite links never grant access by themselves.
 */
export function evaluateStaffInviteLinkRouting(input: {
  inviteStatus: StaffInviteLinkView['status']
  /** Whether a logged-in session exists. */
  sessionPresent: boolean
  /**
   * Whether the session identity's verified phone matches the invite phone.
   * Null when there is no session.
   */
  phonesMatch: boolean | null
  phoneRegistered: boolean
}):
  | { action: 'login' }
  | { action: 'register' }
  | { action: 'switch_account' }
  | { action: 'continue' }
  | { action: 'unavailable'; reason: 'expired' | 'not_pending' } {
  if (input.inviteStatus === 'expired') {
    return { action: 'unavailable', reason: 'expired' }
  }
  if (input.inviteStatus !== 'pending') {
    return { action: 'unavailable', reason: 'not_pending' }
  }
  if (!input.sessionPresent) {
    return input.phoneRegistered
      ? { action: 'login' }
      : { action: 'register' }
  }
  if (input.phonesMatch === false) {
    return { action: 'switch_account' }
  }
  return { action: 'continue' }
}

export async function getPendingStaffInviteForProfile(input: {
  salonId: string
  staffProfileId: string
}) {
  const rows = await getDb()
    .select()
    .from(staffInvites)
    .where(
      and(
        eq(staffInvites.salonId, input.salonId),
        eq(staffInvites.staffProfileId, input.staffProfileId),
        eq(staffInvites.status, 'pending'),
      ),
    )
    .limit(1)
  return rows[0] ?? null
}

export async function listPendingStaffInvitesForSalon(salonId: string) {
  return getDb()
    .select()
    .from(staffInvites)
    .where(
      and(eq(staffInvites.salonId, salonId), eq(staffInvites.status, 'pending')),
    )
}
