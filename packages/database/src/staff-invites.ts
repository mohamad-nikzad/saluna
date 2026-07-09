import { createHash, randomBytes } from 'node:crypto'
import { and, eq, or, isNull } from 'drizzle-orm'
import { STAFF_COLORS } from '@repo/salon-core/types'
import { normalizeCalendarColorId } from '@repo/salon-core/calendar-colors'
import { getDb } from './client'
import {
  member,
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
  accessDetachedAt: Date | null
}

export function evaluateManagerStaffInvite(input: {
  phone: string
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
      phone: input.phone,
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
