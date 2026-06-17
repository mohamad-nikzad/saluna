import { and, count, eq } from 'drizzle-orm'
import { getDb } from './client'
import {
  adminAuditEvents,
  adminInternalNotes,
  platformAdmins,
  user,
} from './schema'

export type PlatformRole =
  | 'platform_owner'
  | 'platform_admin'
  | 'platform_support'
  | 'platform_viewer'

export type PlatformAdminContext = {
  id: string
  userId: string
  role: PlatformRole
  active: boolean
}

export type CreateAdminAuditEventInput = {
  actorUserId: string
  actorPlatformRole: PlatformRole
  action: string
  targetType: string
  targetId: string
  reason: string
  salonId?: string | null
  metadata?: Record<string, unknown>
  requestId?: string | null
  ip?: string | null
  userAgent?: string | null
}

export type CreateAdminInternalNoteInput = {
  subjectType: 'salon' | 'user'
  subjectId: string
  body: string
  authorUserId: string
}

export async function getPlatformAdminForUser(
  userId: string,
): Promise<PlatformAdminContext | undefined> {
  const db = getDb()
  const rows = await db
    .select({
      id: platformAdmins.id,
      userId: platformAdmins.userId,
      role: platformAdmins.role,
      active: platformAdmins.active,
    })
    .from(platformAdmins)
    .where(
      and(eq(platformAdmins.userId, userId), eq(platformAdmins.active, true)),
    )
    .limit(1)

  return rows[0]
}

export async function countActivePlatformOwners(): Promise<number> {
  const db = getDb()
  const rows = await db
    .select({ value: count() })
    .from(platformAdmins)
    .where(
      and(
        eq(platformAdmins.active, true),
        eq(platformAdmins.role, 'platform_owner'),
      ),
    )
  return rows[0]?.value ?? 0
}

export async function bootstrapPlatformOwnerIfNeeded(input: {
  userId: string
  phone: string
  allowedPhones: readonly string[]
}): Promise<PlatformAdminContext | undefined> {
  if (input.allowedPhones.length === 0) return undefined
  if (!input.allowedPhones.includes(input.phone)) return undefined

  const db = getDb()
  return db.transaction(async (tx) => {
    const ownerRows = await tx
      .select({ value: count() })
      .from(platformAdmins)
      .where(
        and(
          eq(platformAdmins.active, true),
          eq(platformAdmins.role, 'platform_owner'),
        ),
      )

    if ((ownerRows[0]?.value ?? 0) > 0) return undefined

    const existingRows = await tx
      .select({
        id: platformAdmins.id,
        userId: platformAdmins.userId,
        role: platformAdmins.role,
        active: platformAdmins.active,
      })
      .from(platformAdmins)
      .where(eq(platformAdmins.userId, input.userId))
      .limit(1)

    const existing = existingRows[0]
    if (existing) {
      const [updated] = await tx
        .update(platformAdmins)
        .set({
          role: 'platform_owner',
          active: true,
          revokedAt: null,
          revokedByUserId: null,
          updatedAt: new Date(),
        })
        .where(eq(platformAdmins.id, existing.id))
        .returning({
          id: platformAdmins.id,
          userId: platformAdmins.userId,
          role: platformAdmins.role,
          active: platformAdmins.active,
        })
      return updated
    }

    const [created] = await tx
      .insert(platformAdmins)
      .values({
        userId: input.userId,
        role: 'platform_owner',
        active: true,
        createdByUserId: input.userId,
      })
      .returning({
        id: platformAdmins.id,
        userId: platformAdmins.userId,
        role: platformAdmins.role,
        active: platformAdmins.active,
      })

    return created
  })
}

export async function createAdminAuditEvent(input: CreateAdminAuditEventInput) {
  const db = getDb()
  const [created] = await db
    .insert(adminAuditEvents)
    .values({
      actorUserId: input.actorUserId,
      actorPlatformRole: input.actorPlatformRole,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      salonId: input.salonId ?? null,
      metadata: input.metadata ?? {},
      requestId: input.requestId ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    })
    .returning()
  return created
}

export async function createAdminInternalNote(
  input: CreateAdminInternalNoteInput,
) {
  const db = getDb()
  const [created] = await db
    .insert(adminInternalNotes)
    .values(input)
    .returning()
  return created
}

export async function getUserPhoneForPlatformBootstrap(
  userId: string,
): Promise<string | undefined> {
  const db = getDb()
  const rows = await db
    .select({
      phoneNumber: user.phoneNumber,
      username: user.username,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  const row = rows[0]
  return row?.phoneNumber ?? row?.username ?? undefined
}
