import { and, eq, isNull, or } from 'drizzle-orm'
import type { User } from '@repo/salon-core/types'
import { getDb } from '../client'
import { member, salonMember, staffInvites, staffProfiles, user } from '../schema'
import { rowToUser, staffUserSelect } from './row-mappers'

/**
 * Resolve a user by id into the legacy `User` shape, joining the user's single
 * membership (role + salon) and the optional `salon_member` color sidecar.
 * Inactive members (`salon_member.active = false`) are excluded.
 * Also resolves active unclaimed Staff Profiles (including pending invites).
 */
export async function getUserById(id: string): Promise<User | undefined> {
  const db = getDb()
  const rows = await db
    .select(staffUserSelect)
    .from(user)
    .innerJoin(member, eq(member.userId, user.id))
    .leftJoin(
      salonMember,
      and(eq(salonMember.userId, user.id), eq(salonMember.organizationId, member.organizationId))
    )
    .where(
      and(
        eq(user.id, id),
        or(isNull(salonMember.active), eq(salonMember.active, true))
      )
    )
    .limit(1)
  const row = rows[0]
  if (row) return rowToUser(row)

  const profiles = await db
    .select()
    .from(staffProfiles)
    .where(and(eq(staffProfiles.id, id), eq(staffProfiles.active, true)))
    .limit(1)
  const profile = profiles[0]
  if (!profile || profile.userId !== null) return undefined

  const pending = await db
    .select({ id: staffInvites.id })
    .from(staffInvites)
    .where(
      and(
        eq(staffInvites.staffProfileId, profile.id),
        eq(staffInvites.status, 'pending'),
      ),
    )
    .limit(1)

  return {
    id: profile.id,
    salonId: profile.salonId,
    name: profile.name,
    fullName: profile.name,
    nickname: null,
    phone: profile.phone,
    role: 'staff',
    color: profile.color,
    createdAt: profile.createdAt,
    inviteStatus: pending[0] ? 'pending' : null,
  }
}
