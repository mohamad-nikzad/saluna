import { and, eq, inArray, isNull, or } from 'drizzle-orm'
import { getDb } from '../client'
import { member, salonMember, salonProfile, user } from '../schema'

export type MemberContext = {
  userId: string
  organizationId: string
  role: string
  salonStatus?: 'setup' | 'active' | 'suspended' | 'archived'
  name: string
  username: string
}

/**
 * The single membership for a user, joined with the user's profile fields the
 * tenant middleware needs. The one-salon-per-user model means a user has at most
 * one `member` row, so we return the first match. Reading name/username from the
 * DB keeps the tenant context authoritative and independent of session inference.
 */
export async function getMemberForUser(
  userId: string,
): Promise<MemberContext | undefined> {
  const db = getDb()
  const rows = await db
    .select({
      userId: member.userId,
      organizationId: member.organizationId,
      role: member.role,
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
        eq(member.userId, userId),
        or(isNull(salonMember.active), eq(salonMember.active, true)),
      ),
    )
    .limit(1)
  const row = rows[0]
  if (!row) return undefined
  return {
    ...row,
    name: row.displayName?.trim() || row.name,
    salonStatus: row.salonStatus ?? undefined,
    username: row.phoneNumber ?? row.username ?? '',
  }
}

/**
 * Manager/owner membership for tenant auth. Staff must use Staff Profile Access
 * instead; this keeps manager/owner single-salon resolution unchanged.
 */
export async function getManagerMemberForUser(
  userId: string,
): Promise<MemberContext | undefined> {
  const db = getDb()
  const rows = await db
    .select({
      userId: member.userId,
      organizationId: member.organizationId,
      role: member.role,
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
        eq(member.userId, userId),
        inArray(member.role, MANAGER_ROLES),
        or(isNull(salonMember.active), eq(salonMember.active, true)),
      ),
    )
    .limit(1)
  const row = rows[0]
  if (!row) return undefined
  return {
    ...row,
    name: row.displayName?.trim() || row.name,
    salonStatus: row.salonStatus ?? undefined,
    username: row.phoneNumber ?? row.username ?? '',
  }
}

const MANAGER_ROLES = ['owner', 'admin']

/**
 * User IDs of members with manager-level roles (`owner` or `admin`) in the
 * salon. Used to fan-out manager notifications (e.g. new appointment requests).
 */
export async function listManagerUserIdsForSalon(
  salonId: string,
): Promise<string[]> {
  const db = getDb()
  const rows = await db
    .select({ userId: member.userId })
    .from(member)
    .where(
      and(
        eq(member.organizationId, salonId),
        inArray(member.role, MANAGER_ROLES),
      ),
    )
  return rows.map((r) => r.userId)
}
