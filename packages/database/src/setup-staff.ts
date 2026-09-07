import { and, asc, eq, isNotNull, isNull, ne } from 'drizzle-orm'
import { getDb } from './client'
import {
  member,
  appointmentRequests,
  salonMember,
  staffProfiles,
  staffSchedules,
  staffServices,
  user,
  organization,
  salonProfile,
} from './schema'
import { remapAppointmentAssignmentStaff } from './internal/appointment-roster-queries'

export type SetupStaffScheduleInput = {
  dayOfWeek: number
  active: boolean
  workingStart: string
  workingEnd: string
}

export type CreateSetupStaffProfileInput = {
  salonId: string
  name: string
  phone: string
  color: string
  active: boolean
  schedule: SetupStaffScheduleInput[]
  serviceIds: string[] | null
}

export async function listSetupStaffProfiles(salonId: string) {
  const db = getDb()
  const profiles = await db
    .select()
    .from(staffProfiles)
    .where(eq(staffProfiles.salonId, salonId))
    .orderBy(asc(staffProfiles.name))

  if (profiles.length === 0) return []
  const [schedules, capabilities] = await Promise.all([
    db
      .select()
      .from(staffSchedules)
      .where(eq(staffSchedules.salonId, salonId))
      .orderBy(asc(staffSchedules.dayOfWeek)),
    db
      .select({
        staffId: staffServices.staffUserId,
        serviceId: staffServices.serviceId,
      })
      .from(staffServices)
      .where(eq(staffServices.salonId, salonId)),
  ])

  return profiles.map((profile) => ({
    ...profile,
    claimed: profile.userId !== null,
    schedule: schedules.filter((row) => row.staffId === profile.id),
    serviceIds: capabilities
      .filter((row) => row.staffId === profile.id)
      .map((row) => row.serviceId),
  }))
}

export async function createSetupStaffProfile(
  input: CreateSetupStaffProfileInput,
) {
  const db = getDb()
  return db.transaction(async (tx) => {
    const [profile] = await tx
      .insert(staffProfiles)
      .values({
        salonId: input.salonId,
        name: input.name,
        phone: input.phone,
        color: input.color,
        active: input.active,
      })
      .returning()
    if (!profile) throw new Error('staff profile creation failed')

    if (input.schedule.length > 0) {
      await tx.insert(staffSchedules).values(
        input.schedule.map((row) => ({
          salonId: input.salonId,
          staffId: profile.id,
          ...row,
        })),
      )
    }
    if (input.serviceIds && input.serviceIds.length > 0) {
      await tx.insert(staffServices).values(
        input.serviceIds.map((serviceId) => ({
          salonId: input.salonId,
          staffUserId: profile.id,
          serviceId,
        })),
      )
    }

    return profile
  })
}

export type StaffProfileClaimResult =
  | { status: 'none' }
  | {
      status: 'claimed'
      profileId: string
      salonId: string
      transferred: boolean
    }
  | {
      status: 'rejected'
      reason: 'ambiguous' | 'already_claimed' | 'ineligible' | 'phone_mismatch'
    }

type ClaimCandidate = typeof staffProfiles.$inferSelect & {
  salonStatus?: 'setup' | 'active' | 'suspended' | 'archived'
}

export function evaluateStaffProfileClaim(input: {
  identity:
    | { phoneNumber: string | null; username: string | null; verified: boolean }
    | undefined
  phone: string
  userId: string
  matches: ClaimCandidate[]
  membershipSalonIds: string[]
}):
  | {
      status: 'candidate'
      profile: ClaimCandidate
      sourceProfile?: ClaimCandidate
    }
  | Exclude<StaffProfileClaimResult, { status: 'claimed' }> {
  if (
    !input.identity?.verified ||
    (input.identity.phoneNumber !== input.phone &&
      input.identity.username !== input.phone)
  ) {
    return { status: 'rejected', reason: 'phone_mismatch' }
  }
  const currentProfiles = input.matches.filter(
    (profile) => profile.userId === input.userId,
  )
  if (currentProfiles.length > 1) {
    return { status: 'rejected', reason: 'ambiguous' }
  }
  const currentProfile = currentProfiles[0]
  const targets = input.matches.filter(
    (profile) =>
      profile.userId === null &&
      profile.active &&
      profile.accessDetachedAt === null &&
      (profile.salonStatus === undefined || profile.salonStatus === 'setup'),
  )
  if (targets.length > 1) {
    return { status: 'rejected', reason: 'ambiguous' }
  }
  const target = targets[0]
  if (
    input.matches.some(
      (profile) => profile.userId && profile.userId !== input.userId,
    )
  ) {
    return { status: 'rejected', reason: 'already_claimed' }
  }
  if (currentProfile && !target) {
    return { status: 'candidate', profile: currentProfile }
  }
  if (currentProfile && target) {
    if (
      input.membershipSalonIds.some(
        (salonId) =>
          salonId !== currentProfile.salonId && salonId !== target.salonId,
      )
    ) {
      return { status: 'rejected', reason: 'ineligible' }
    }
    return {
      status: 'candidate',
      profile: target,
      sourceProfile: currentProfile,
    }
  }
  if (!target) return { status: 'none' }
  if (input.membershipSalonIds.some((salonId) => salonId !== target.salonId)) {
    return { status: 'rejected', reason: 'ineligible' }
  }
  return { status: 'candidate', profile: target }
}

export async function getClaimedStaffAccessForPhone(input: {
  phone: string
  excludingSalonId: string
}) {
  const rows = await getDb()
    .select({
      salonId: staffProfiles.salonId,
      salonName: organization.name,
      salonStatus: salonProfile.status,
    })
    .from(staffProfiles)
    .innerJoin(organization, eq(organization.id, staffProfiles.salonId))
    .innerJoin(
      salonProfile,
      eq(salonProfile.organizationId, staffProfiles.salonId),
    )
    .where(
      and(
        eq(staffProfiles.phone, input.phone),
        isNotNull(staffProfiles.userId),
        isNull(staffProfiles.accessDetachedAt),
        ne(staffProfiles.salonId, input.excludingSalonId),
      ),
    )
    .limit(1)

  return rows[0] ?? null
}

export async function claimStaffProfile(input: {
  userId: string
  phone: string
}): Promise<StaffProfileClaimResult> {
  const db = getDb()
  return db.transaction(async (tx) => {
    const identityRows = await tx
      .select({
        phoneNumber: user.phoneNumber,
        username: user.username,
        verified: user.phoneNumberVerified,
      })
      .from(user)
      .where(eq(user.id, input.userId))
      .limit(1)
      .for('update')
    const identity = identityRows[0]
    const matches = await tx
      .select({
        id: staffProfiles.id,
        salonId: staffProfiles.salonId,
        userId: staffProfiles.userId,
        name: staffProfiles.name,
        phone: staffProfiles.phone,
        color: staffProfiles.color,
        active: staffProfiles.active,
        claimedAt: staffProfiles.claimedAt,
        accessDetachedAt: staffProfiles.accessDetachedAt,
        createdAt: staffProfiles.createdAt,
        updatedAt: staffProfiles.updatedAt,
        salonStatus: salonProfile.status,
      })
      .from(staffProfiles)
      .innerJoin(
        salonProfile,
        eq(salonProfile.organizationId, staffProfiles.salonId),
      )
      .where(eq(staffProfiles.phone, input.phone))
      .for('update')
    const memberships = await tx
      .select({ salonId: member.organizationId })
      .from(member)
      .where(eq(member.userId, input.userId))
    const decision = evaluateStaffProfileClaim({
      identity,
      phone: input.phone,
      userId: input.userId,
      matches,
      membershipSalonIds: memberships.map((row) => row.salonId),
    })
    if (decision.status !== 'candidate') return decision
    const { profile, sourceProfile } = decision

    if (sourceProfile) {
      await tx
        .update(staffSchedules)
        .set({ staffId: sourceProfile.id, updatedAt: new Date() })
        .where(
          and(
            eq(staffSchedules.salonId, sourceProfile.salonId),
            eq(staffSchedules.staffId, input.userId),
          ),
        )
      await tx
        .update(staffServices)
        .set({ staffUserId: sourceProfile.id })
        .where(
          and(
            eq(staffServices.salonId, sourceProfile.salonId),
            eq(staffServices.staffUserId, input.userId),
          ),
        )
      await remapAppointmentAssignmentStaff(tx, {
        salonId: sourceProfile.salonId,
        fromStaffId: input.userId,
        toStaffId: sourceProfile.id,
      })
      await tx
        .update(appointmentRequests)
        .set({ staffId: sourceProfile.id, updatedAt: new Date() })
        .where(
          and(
            eq(appointmentRequests.salonId, sourceProfile.salonId),
            eq(appointmentRequests.staffId, input.userId),
          ),
        )
      await tx
        .delete(salonMember)
        .where(
          and(
            eq(salonMember.organizationId, sourceProfile.salonId),
            eq(salonMember.userId, input.userId),
          ),
        )
      await tx
        .delete(member)
        .where(
          and(
            eq(member.organizationId, sourceProfile.salonId),
            eq(member.userId, input.userId),
          ),
        )
      await tx
        .update(staffProfiles)
        .set({
          userId: null,
          accessDetachedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(staffProfiles.id, sourceProfile.id),
            eq(staffProfiles.userId, input.userId),
          ),
        )
    }

    if (!profile.userId) {
      const [claimed] = await tx
        .update(staffProfiles)
        .set({
          userId: input.userId,
          claimedAt: new Date(),
          accessDetachedAt: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(staffProfiles.id, profile.id),
            eq(staffProfiles.phone, input.phone),
            isNull(staffProfiles.userId),
          ),
        )
        .returning({ id: staffProfiles.id })
      if (!claimed) return { status: 'rejected', reason: 'already_claimed' }
    }

    if (!memberships.some((row) => row.salonId === profile.salonId)) {
      await tx.insert(member).values({
        organizationId: profile.salonId,
        userId: input.userId,
        role: 'member',
      })
    }
    await tx
      .insert(salonMember)
      .values({
        organizationId: profile.salonId,
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

    // Preserve compatibility with existing manager-created staff by switching
    // operational references to the verified identity in the same transaction.
    await Promise.all([
      tx
        .update(staffSchedules)
        .set({ staffId: input.userId, updatedAt: new Date() })
        .where(eq(staffSchedules.staffId, profile.id)),
      tx
        .update(staffServices)
        .set({ staffUserId: input.userId })
        .where(eq(staffServices.staffUserId, profile.id)),
      remapAppointmentAssignmentStaff(tx, {
        salonId: profile.salonId,
        fromStaffId: profile.id,
        toStaffId: input.userId,
      }),
      tx
        .update(appointmentRequests)
        .set({ staffId: input.userId, updatedAt: new Date() })
        .where(eq(appointmentRequests.staffId, profile.id)),
    ])

    return {
      status: 'claimed',
      profileId: profile.id,
      salonId: profile.salonId,
      transferred: Boolean(sourceProfile),
    }
  })
}

export async function getStaffProfileForUser(userId: string) {
  const rows = await getDb()
    .select()
    .from(staffProfiles)
    .where(eq(staffProfiles.userId, userId))
    .limit(1)
  return rows[0]
}
