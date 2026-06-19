import {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  ilike,
  or,
  sql,
} from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import type { CatalogPresetTree } from '@repo/salon-core/forms/catalog-preset'
import { getDb } from './client'
import {
  adminAuditEvents,
  adminInternalNotes,
  appointmentRequests,
  appointments,
  catalogPresets,
  clientFollowUpMessageDeliveries,
  clients,
  member,
  notificationDeliveries,
  notifications,
  organization,
  platformAdmins,
  salonMember,
  salonProfile,
  salonPublicSettings,
  serviceCategories,
  serviceFamilies,
  services,
  user,
  userMessagingAccounts,
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

export type ListInput = {
  page?: number
  pageSize?: number
  search?: string
}

export type ListResult<T> = {
  items: T[]
  pagination: {
    page: number
    pageSize: number
    total: number
  }
}

const DEFAULT_PAGE_SIZE = 25
const MAX_PAGE_SIZE = 100

function normalizeList(input: ListInput = {}) {
  const page = Math.max(1, input.page ?? 1)
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, input.pageSize ?? DEFAULT_PAGE_SIZE),
  )
  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
    search: input.search?.trim() || undefined,
  }
}

async function withPagination<T>(
  rows: Promise<T[]>,
  totalRows: Promise<Array<{ value: number }>>,
  page: number,
  pageSize: number,
): Promise<ListResult<T>> {
  const [items, totals] = await Promise.all([rows, totalRows])
  return {
    items,
    pagination: {
      page,
      pageSize,
      total: totals[0]?.value ?? 0,
    },
  }
}

function searchLike(value: string) {
  return `%${value.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`
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

export async function getPlatformAdminMe(userId: string) {
  const db = getDb()
  const rows = await db
    .select({
      userId: user.id,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      username: user.username,
      role: platformAdmins.role,
      active: platformAdmins.active,
    })
    .from(platformAdmins)
    .innerJoin(user, eq(user.id, platformAdmins.userId))
    .where(
      and(eq(platformAdmins.userId, userId), eq(platformAdmins.active, true)),
    )
    .limit(1)

  return rows[0]
}

export async function getAdminOverview() {
  const db = getDb()
  const [salonStatusRows, failedDeliveryRows, messagingRows, auditRows] =
    await Promise.all([
      db
        .select({ status: salonProfile.status, value: count() })
        .from(salonProfile)
        .groupBy(salonProfile.status),
      db
        .select({ value: count() })
        .from(notificationDeliveries)
        .where(eq(notificationDeliveries.status, 'failed')),
      db
        .select({
          provider: userMessagingAccounts.provider,
          enabled: userMessagingAccounts.enabled,
          value: count(),
        })
        .from(userMessagingAccounts)
        .groupBy(userMessagingAccounts.provider, userMessagingAccounts.enabled),
      db
        .select({
          id: adminAuditEvents.id,
          actorUserId: adminAuditEvents.actorUserId,
          actorPlatformRole: adminAuditEvents.actorPlatformRole,
          action: adminAuditEvents.action,
          targetType: adminAuditEvents.targetType,
          targetId: adminAuditEvents.targetId,
          salonId: adminAuditEvents.salonId,
          reason: adminAuditEvents.reason,
          createdAt: adminAuditEvents.createdAt,
        })
        .from(adminAuditEvents)
        .orderBy(desc(adminAuditEvents.createdAt))
        .limit(10),
    ])

  const salonsByStatus = {
    active: 0,
    suspended: 0,
    archived: 0,
  }
  for (const row of salonStatusRows) salonsByStatus[row.status] = row.value

  return {
    salonsByStatus,
    failedDeliveries: failedDeliveryRows[0]?.value ?? 0,
    messagingAccounts: messagingRows,
    recentAuditEvents: auditRows,
  }
}

export async function listAdminSalons(input: ListInput = {}) {
  const { page, pageSize, offset, search } = normalizeList(input)
  const where = search
    ? or(
        ilike(organization.name, searchLike(search)),
        ilike(organization.slug, searchLike(search)),
        ilike(salonProfile.phone, searchLike(search)),
      )
    : undefined

  const db = getDb()
  const rows = db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      logo: organization.logo,
      createdAt: organization.createdAt,
      status: salonProfile.status,
      phone: salonProfile.phone,
      publicEnabled: salonPublicSettings.enabled,
      memberCount: countDistinct(salonMember.id),
    })
    .from(organization)
    .innerJoin(salonProfile, eq(salonProfile.organizationId, organization.id))
    .leftJoin(
      salonPublicSettings,
      eq(salonPublicSettings.salonId, organization.id),
    )
    .leftJoin(salonMember, eq(salonMember.organizationId, organization.id))
    .where(where)
    .groupBy(
      organization.id,
      organization.name,
      organization.slug,
      organization.logo,
      organization.createdAt,
      salonProfile.status,
      salonProfile.phone,
      salonPublicSettings.enabled,
    )
    .orderBy(desc(organization.createdAt))
    .limit(pageSize)
    .offset(offset)

  const totalRows = db
    .select({ value: count() })
    .from(organization)
    .innerJoin(salonProfile, eq(salonProfile.organizationId, organization.id))
    .where(where)

  return withPagination(rows, totalRows, page, pageSize)
}

export async function getAdminSalon(id: string) {
  const db = getDb()
  const rows = await db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      logo: organization.logo,
      createdAt: organization.createdAt,
      metadata: organization.metadata,
      status: salonProfile.status,
      timezone: salonProfile.timezone,
      locale: salonProfile.locale,
      phone: salonProfile.phone,
      address: salonProfile.address,
      publicEnabled: salonPublicSettings.enabled,
      appointmentRequestsEnabled:
        salonPublicSettings.appointmentRequestsEnabled,
      themeId: salonPublicSettings.themeId,
      layoutId: salonPublicSettings.layoutId,
    })
    .from(organization)
    .innerJoin(salonProfile, eq(salonProfile.organizationId, organization.id))
    .leftJoin(
      salonPublicSettings,
      eq(salonPublicSettings.salonId, organization.id),
    )
    .where(eq(organization.id, id))
    .limit(1)

  const salon = rows[0]
  if (!salon) return undefined

  const [members, serviceRows, appointmentRows, requestRows] =
    await Promise.all([
      db
        .select({
          userId: user.id,
          name: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: member.role,
          createdAt: member.createdAt,
        })
        .from(member)
        .innerJoin(user, eq(user.id, member.userId))
        .where(eq(member.organizationId, id))
        .orderBy(asc(member.createdAt)),
      db
        .select({ value: count() })
        .from(services)
        .where(eq(services.salonId, id)),
      db
        .select({ value: count() })
        .from(appointments)
        .where(eq(appointments.salonId, id)),
      db
        .select({ value: count() })
        .from(appointmentRequests)
        .where(eq(appointmentRequests.salonId, id)),
    ])

  return {
    salon,
    members,
    stats: {
      services: serviceRows[0]?.value ?? 0,
      appointments: appointmentRows[0]?.value ?? 0,
      appointmentRequests: requestRows[0]?.value ?? 0,
    },
  }
}

export async function updateAdminSalonStatus(input: {
  salonId: string
  status: 'active' | 'suspended' | 'archived'
}) {
  const db = getDb()
  const [updated] = await db
    .update(salonProfile)
    .set({ status: input.status })
    .where(eq(salonProfile.organizationId, input.salonId))
    .returning({
      salonId: salonProfile.organizationId,
      status: salonProfile.status,
    })
  return updated
}

export async function listAdminSalonClients(
  salonId: string,
  input: ListInput = {},
) {
  const { page, pageSize, offset, search } = normalizeList(input)
  const where = and(
    eq(clients.salonId, salonId),
    search
      ? or(
          ilike(clients.name, searchLike(search)),
          ilike(clients.phone, searchLike(search)),
          ilike(clients.notes, searchLike(search)),
        )
      : undefined,
  )
  const db = getDb()
  const rows = db
    .select({
      id: clients.id,
      name: clients.name,
      phone: clients.phone,
      isPlaceholder: clients.isPlaceholder,
      notes: clients.notes,
      createdAt: clients.createdAt,
    })
    .from(clients)
    .where(where)
    .orderBy(desc(clients.createdAt))
    .limit(pageSize)
    .offset(offset)
  const totalRows = db.select({ value: count() }).from(clients).where(where)
  return withPagination(rows, totalRows, page, pageSize)
}

export async function listAdminSalonAppointments(
  salonId: string,
  input: ListInput = {},
) {
  const { page, pageSize, offset, search } = normalizeList(input)
  const where = and(
    eq(appointments.salonId, salonId),
    search
      ? or(
          ilike(clients.name, searchLike(search)),
          ilike(clients.phone, searchLike(search)),
          ilike(user.name, searchLike(search)),
          ilike(appointments.bookedServiceName, searchLike(search)),
          ilike(appointments.date, searchLike(search)),
        )
      : undefined,
  )
  const db = getDb()
  const rows = db
    .select({
      id: appointments.id,
      clientId: appointments.clientId,
      clientName: clients.name,
      clientPhone: clients.phone,
      staffId: appointments.staffId,
      staffName: user.name,
      serviceId: appointments.serviceId,
      date: appointments.date,
      startTime: appointments.startTime,
      endTime: appointments.endTime,
      bookedServiceName: appointments.bookedServiceName,
      bookedTotalDuration: appointments.bookedTotalDuration,
      bookedTotalPrice: appointments.bookedTotalPrice,
      status: appointments.status,
      createdAt: appointments.createdAt,
      updatedAt: appointments.updatedAt,
    })
    .from(appointments)
    .innerJoin(clients, eq(clients.id, appointments.clientId))
    .innerJoin(user, eq(user.id, appointments.staffId))
    .where(where)
    .orderBy(desc(appointments.date), desc(appointments.startTime))
    .limit(pageSize)
    .offset(offset)
  const totalRows = db
    .select({ value: count() })
    .from(appointments)
    .innerJoin(clients, eq(clients.id, appointments.clientId))
    .innerJoin(user, eq(user.id, appointments.staffId))
    .where(where)
  return withPagination(rows, totalRows, page, pageSize)
}

export async function listAdminSalonAppointmentRequests(
  salonId: string,
  input: ListInput = {},
) {
  const { page, pageSize, offset, search } = normalizeList(input)
  const where = and(
    eq(appointmentRequests.salonId, salonId),
    search
      ? or(
          ilike(appointmentRequests.customerName, searchLike(search)),
          ilike(appointmentRequests.customerPhone, searchLike(search)),
          ilike(appointmentRequests.bookedServiceName, searchLike(search)),
          ilike(appointmentRequests.requestedDate, searchLike(search)),
        )
      : undefined,
  )
  const db = getDb()
  const rows = db
    .select({
      id: appointmentRequests.id,
      serviceId: appointmentRequests.serviceId,
      staffId: appointmentRequests.staffId,
      requestedDate: appointmentRequests.requestedDate,
      requestedStartTime: appointmentRequests.requestedStartTime,
      requestedEndTime: appointmentRequests.requestedEndTime,
      customerName: appointmentRequests.customerName,
      customerPhone: appointmentRequests.customerPhone,
      bookedServiceName: appointmentRequests.bookedServiceName,
      bookedServiceDuration: appointmentRequests.bookedServiceDuration,
      bookedServicePrice: appointmentRequests.bookedServicePrice,
      status: appointmentRequests.status,
      paymentStatus: appointmentRequests.paymentStatus,
      appointmentId: appointmentRequests.appointmentId,
      reviewedAt: appointmentRequests.reviewedAt,
      rejectionReason: appointmentRequests.rejectionReason,
      createdAt: appointmentRequests.createdAt,
      updatedAt: appointmentRequests.updatedAt,
    })
    .from(appointmentRequests)
    .where(where)
    .orderBy(desc(appointmentRequests.createdAt))
    .limit(pageSize)
    .offset(offset)
  const totalRows = db
    .select({ value: count() })
    .from(appointmentRequests)
    .where(where)
  return withPagination(rows, totalRows, page, pageSize)
}

export async function listAdminSalonStaff(
  salonId: string,
  input: ListInput = {},
) {
  const { page, pageSize, offset, search } = normalizeList(input)
  const where = and(
    eq(salonMember.organizationId, salonId),
    search
      ? or(
          ilike(user.name, searchLike(search)),
          ilike(user.phoneNumber, searchLike(search)),
          ilike(user.email, searchLike(search)),
          ilike(salonMember.displayName, searchLike(search)),
        )
      : undefined,
  )
  const db = getDb()
  const rows = db
    .select({
      id: salonMember.id,
      userId: salonMember.userId,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      displayName: salonMember.displayName,
      color: salonMember.color,
      active: salonMember.active,
      createdAt: salonMember.createdAt,
    })
    .from(salonMember)
    .innerJoin(user, eq(user.id, salonMember.userId))
    .where(where)
    .orderBy(desc(salonMember.createdAt))
    .limit(pageSize)
    .offset(offset)
  const totalRows = db
    .select({ value: count() })
    .from(salonMember)
    .innerJoin(user, eq(user.id, salonMember.userId))
    .where(where)
  return withPagination(rows, totalRows, page, pageSize)
}

export async function listAdminSalonServices(
  salonId: string,
  input: ListInput = {},
) {
  const { page, pageSize, offset, search } = normalizeList(input)
  const where = and(
    eq(services.salonId, salonId),
    search
      ? or(
          ilike(services.name, searchLike(search)),
          ilike(serviceCategories.name, searchLike(search)),
          ilike(serviceFamilies.name, searchLike(search)),
        )
      : undefined,
  )
  const db = getDb()
  const rows = db
    .select({
      id: services.id,
      name: services.name,
      kind: services.kind,
      categoryId: services.categoryId,
      categoryName: serviceCategories.name,
      familyId: services.familyId,
      familyName: serviceFamilies.name,
      duration: services.duration,
      price: services.price,
      color: services.color,
      active: services.active,
      createdAt: services.createdAt,
    })
    .from(services)
    .innerJoin(serviceCategories, eq(serviceCategories.id, services.categoryId))
    .leftJoin(serviceFamilies, eq(serviceFamilies.id, services.familyId))
    .where(where)
    .orderBy(
      asc(serviceCategories.name),
      asc(serviceFamilies.name),
      asc(services.name),
    )
    .limit(pageSize)
    .offset(offset)
  const totalRows = db
    .select({ value: count() })
    .from(services)
    .innerJoin(serviceCategories, eq(serviceCategories.id, services.categoryId))
    .leftJoin(serviceFamilies, eq(serviceFamilies.id, services.familyId))
    .where(where)
  return withPagination(rows, totalRows, page, pageSize)
}

export async function listAdminUsers(input: ListInput = {}) {
  const { page, pageSize, offset, search } = normalizeList(input)
  const where = search
    ? or(
        ilike(user.name, searchLike(search)),
        ilike(user.email, searchLike(search)),
        ilike(user.phoneNumber, searchLike(search)),
        ilike(user.username, searchLike(search)),
      )
    : undefined

  const db = getDb()
  const rows = db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      username: user.username,
      createdAt: user.createdAt,
      platformRole: platformAdmins.role,
      platformActive: platformAdmins.active,
      salonMembershipCount: sql<number>`count(distinct ${member.id})`,
    })
    .from(user)
    .leftJoin(platformAdmins, eq(platformAdmins.userId, user.id))
    .leftJoin(member, eq(member.userId, user.id))
    .where(where)
    .groupBy(user.id, platformAdmins.id)
    .orderBy(desc(user.createdAt))
    .limit(pageSize)
    .offset(offset)

  const totalRows = db.select({ value: count() }).from(user).where(where)
  return withPagination(rows, totalRows, page, pageSize)
}

export async function getAdminUser(id: string) {
  const db = getDb()
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      phoneNumber: user.phoneNumber,
      phoneNumberVerified: user.phoneNumberVerified,
      username: user.username,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      platformRole: platformAdmins.role,
      platformActive: platformAdmins.active,
    })
    .from(user)
    .leftJoin(platformAdmins, eq(platformAdmins.userId, user.id))
    .where(eq(user.id, id))
    .limit(1)

  const adminUser = rows[0]
  if (!adminUser) return undefined

  const [memberships, messagingAccounts] = await Promise.all([
    db
      .select({
        salonId: organization.id,
        salonName: organization.name,
        salonSlug: organization.slug,
        salonStatus: salonProfile.status,
        role: member.role,
        createdAt: member.createdAt,
      })
      .from(member)
      .innerJoin(organization, eq(organization.id, member.organizationId))
      .leftJoin(salonProfile, eq(salonProfile.organizationId, organization.id))
      .where(eq(member.userId, id))
      .orderBy(asc(member.createdAt)),
    db
      .select({
        id: userMessagingAccounts.id,
        provider: userMessagingAccounts.provider,
        externalId: userMessagingAccounts.externalId,
        displayName: userMessagingAccounts.displayName,
        enabled: userMessagingAccounts.enabled,
        linkedAt: userMessagingAccounts.linkedAt,
        updatedAt: userMessagingAccounts.updatedAt,
      })
      .from(userMessagingAccounts)
      .where(eq(userMessagingAccounts.userId, id))
      .orderBy(asc(userMessagingAccounts.provider)),
  ])

  return { user: adminUser, memberships, messagingAccounts }
}

export async function listAdminInternalNotes(input: {
  subjectType: 'salon' | 'user'
  subjectId: string
}) {
  const db = getDb()
  return db
    .select({
      id: adminInternalNotes.id,
      subjectType: adminInternalNotes.subjectType,
      subjectId: adminInternalNotes.subjectId,
      body: adminInternalNotes.body,
      authorUserId: adminInternalNotes.authorUserId,
      authorName: user.name,
      createdAt: adminInternalNotes.createdAt,
    })
    .from(adminInternalNotes)
    .innerJoin(user, eq(user.id, adminInternalNotes.authorUserId))
    .where(
      and(
        eq(adminInternalNotes.subjectType, input.subjectType),
        eq(adminInternalNotes.subjectId, input.subjectId),
      ),
    )
    .orderBy(desc(adminInternalNotes.createdAt))
}

export async function listAdminCatalogPresets(input: ListInput = {}) {
  const { page, pageSize, offset, search } = normalizeList(input)
  const where = search
    ? or(
        ilike(catalogPresets.name, searchLike(search)),
        ilike(catalogPresets.slug, searchLike(search)),
      )
    : undefined
  const db = getDb()
  const rows = db
    .select()
    .from(catalogPresets)
    .where(where)
    .orderBy(asc(catalogPresets.sortOrder), asc(catalogPresets.name))
    .limit(pageSize)
    .offset(offset)
  const totalRows = db
    .select({ value: count() })
    .from(catalogPresets)
    .where(where)
  return withPagination(rows, totalRows, page, pageSize)
}

export async function createAdminCatalogPreset(input: {
  slug: string
  name: string
  description?: string | null
  tree: CatalogPresetTree
  sortOrder?: number
  isActive?: boolean
}) {
  const db = getDb()
  const [created] = await db
    .insert(catalogPresets)
    .values({
      slug: input.slug,
      name: input.name,
      description: input.description ?? null,
      tree: input.tree,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
    })
    .returning()
  return created
}

export async function updateAdminCatalogPreset(input: {
  id: string
  slug?: string
  name?: string
  description?: string | null
  tree?: CatalogPresetTree
  sortOrder?: number
  isActive?: boolean
}) {
  const db = getDb()
  const [updated] = await db
    .update(catalogPresets)
    .set({
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.tree !== undefined ? { tree: input.tree } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedAt: new Date(),
    })
    .where(eq(catalogPresets.id, input.id))
    .returning()
  return updated
}

export async function getAdminMessagingHealth() {
  const db = getDb()
  const [accounts, failedNotifications, failedFollowUps] = await Promise.all([
    db
      .select({
        provider: userMessagingAccounts.provider,
        enabled: userMessagingAccounts.enabled,
        value: count(),
      })
      .from(userMessagingAccounts)
      .groupBy(userMessagingAccounts.provider, userMessagingAccounts.enabled)
      .orderBy(asc(userMessagingAccounts.provider)),
    db
      .select({
        channel: notificationDeliveries.channel,
        provider: notificationDeliveries.provider,
        value: count(),
      })
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.status, 'failed'))
      .groupBy(notificationDeliveries.channel, notificationDeliveries.provider),
    db
      .select({
        provider: clientFollowUpMessageDeliveries.provider,
        value: count(),
      })
      .from(clientFollowUpMessageDeliveries)
      .where(eq(clientFollowUpMessageDeliveries.status, 'failed'))
      .groupBy(clientFollowUpMessageDeliveries.provider),
  ])

  return { accounts, failedNotifications, failedFollowUps }
}

export async function listAdminNotificationDeliveries(input: ListInput = {}) {
  const { page, pageSize, offset } = normalizeList(input)
  const db = getDb()
  const rows = db
    .select({
      id: notificationDeliveries.id,
      notificationId: notificationDeliveries.notificationId,
      channel: notificationDeliveries.channel,
      status: notificationDeliveries.status,
      provider: notificationDeliveries.provider,
      providerMessageId: notificationDeliveries.providerMessageId,
      error: notificationDeliveries.error,
      createdAt: notificationDeliveries.createdAt,
      sentAt: notificationDeliveries.sentAt,
      salonId: notifications.salonId,
      userId: notifications.userId,
      notificationType: notifications.type,
      title: notifications.title,
    })
    .from(notificationDeliveries)
    .innerJoin(
      notifications,
      eq(notifications.id, notificationDeliveries.notificationId),
    )
    .orderBy(desc(notificationDeliveries.createdAt))
    .limit(pageSize)
    .offset(offset)
  const totalRows = db.select({ value: count() }).from(notificationDeliveries)
  return withPagination(rows, totalRows, page, pageSize)
}

export async function listAdminSupportAppointments(input: ListInput = {}) {
  const { page, pageSize, offset, search } = normalizeList(input)
  const where = search
    ? or(
        ilike(clients.name, searchLike(search)),
        ilike(clients.phone, searchLike(search)),
        ilike(appointments.bookedServiceName, searchLike(search)),
      )
    : undefined
  const db = getDb()
  const rows = db
    .select({
      id: appointments.id,
      salonId: appointments.salonId,
      salonName: organization.name,
      clientId: appointments.clientId,
      clientName: clients.name,
      clientPhone: clients.phone,
      staffId: appointments.staffId,
      serviceId: appointments.serviceId,
      date: appointments.date,
      startTime: appointments.startTime,
      endTime: appointments.endTime,
      bookedServiceName: appointments.bookedServiceName,
      bookedTotalPrice: appointments.bookedTotalPrice,
      status: appointments.status,
      createdAt: appointments.createdAt,
    })
    .from(appointments)
    .innerJoin(organization, eq(organization.id, appointments.salonId))
    .innerJoin(clients, eq(clients.id, appointments.clientId))
    .where(where)
    .orderBy(desc(appointments.date), desc(appointments.startTime))
    .limit(pageSize)
    .offset(offset)
  const totalRows = db
    .select({ value: count() })
    .from(appointments)
    .innerJoin(clients, eq(clients.id, appointments.clientId))
    .where(where)
  return withPagination(rows, totalRows, page, pageSize)
}

export async function listAdminSupportAppointmentRequests(
  input: ListInput = {},
) {
  const { page, pageSize, offset, search } = normalizeList(input)
  const where = search
    ? or(
        ilike(appointmentRequests.customerName, searchLike(search)),
        ilike(appointmentRequests.customerPhone, searchLike(search)),
        ilike(appointmentRequests.bookedServiceName, searchLike(search)),
      )
    : undefined
  const db = getDb()
  const rows = db
    .select({
      id: appointmentRequests.id,
      salonId: appointmentRequests.salonId,
      salonName: organization.name,
      serviceId: appointmentRequests.serviceId,
      staffId: appointmentRequests.staffId,
      requestedDate: appointmentRequests.requestedDate,
      requestedStartTime: appointmentRequests.requestedStartTime,
      requestedEndTime: appointmentRequests.requestedEndTime,
      customerName: appointmentRequests.customerName,
      customerPhone: appointmentRequests.customerPhone,
      bookedServiceName: appointmentRequests.bookedServiceName,
      status: appointmentRequests.status,
      paymentStatus: appointmentRequests.paymentStatus,
      appointmentId: appointmentRequests.appointmentId,
      createdAt: appointmentRequests.createdAt,
      updatedAt: appointmentRequests.updatedAt,
    })
    .from(appointmentRequests)
    .innerJoin(organization, eq(organization.id, appointmentRequests.salonId))
    .where(where)
    .orderBy(desc(appointmentRequests.createdAt))
    .limit(pageSize)
    .offset(offset)
  const totalRows = db
    .select({ value: count() })
    .from(appointmentRequests)
    .where(where)
  return withPagination(rows, totalRows, page, pageSize)
}

export async function listAdminAuditLog(
  input: ListInput & {
    action?: string
    targetType?: string
    targetId?: string
    salonId?: string
  } = {},
) {
  const { page, pageSize, offset } = normalizeList(input)
  const filters: SQL[] = []
  if (input.action) filters.push(eq(adminAuditEvents.action, input.action))
  if (input.targetType)
    filters.push(eq(adminAuditEvents.targetType, input.targetType))
  if (input.targetId)
    filters.push(eq(adminAuditEvents.targetId, input.targetId))
  if (input.salonId) filters.push(eq(adminAuditEvents.salonId, input.salonId))
  const where = filters.length > 0 ? and(...filters) : undefined

  const db = getDb()
  const rows = db
    .select({
      id: adminAuditEvents.id,
      actorUserId: adminAuditEvents.actorUserId,
      actorName: user.name,
      actorPlatformRole: adminAuditEvents.actorPlatformRole,
      action: adminAuditEvents.action,
      targetType: adminAuditEvents.targetType,
      targetId: adminAuditEvents.targetId,
      salonId: adminAuditEvents.salonId,
      reason: adminAuditEvents.reason,
      metadata: adminAuditEvents.metadata,
      requestId: adminAuditEvents.requestId,
      ip: adminAuditEvents.ip,
      userAgent: adminAuditEvents.userAgent,
      createdAt: adminAuditEvents.createdAt,
    })
    .from(adminAuditEvents)
    .innerJoin(user, eq(user.id, adminAuditEvents.actorUserId))
    .where(where)
    .orderBy(desc(adminAuditEvents.createdAt))
    .limit(pageSize)
    .offset(offset)
  const totalRows = db
    .select({ value: count() })
    .from(adminAuditEvents)
    .where(where)
  return withPagination(rows, totalRows, page, pageSize)
}

export async function listPlatformAdmins(input: ListInput = {}) {
  const { page, pageSize, offset, search } = normalizeList(input)
  const where = search
    ? or(
        ilike(user.name, searchLike(search)),
        ilike(user.email, searchLike(search)),
        ilike(user.phoneNumber, searchLike(search)),
        ilike(user.username, searchLike(search)),
      )
    : undefined
  const db = getDb()
  const rows = db
    .select({
      id: platformAdmins.id,
      userId: platformAdmins.userId,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: platformAdmins.role,
      active: platformAdmins.active,
      createdAt: platformAdmins.createdAt,
      updatedAt: platformAdmins.updatedAt,
      revokedAt: platformAdmins.revokedAt,
      createdByUserId: platformAdmins.createdByUserId,
      revokedByUserId: platformAdmins.revokedByUserId,
    })
    .from(platformAdmins)
    .innerJoin(user, eq(user.id, platformAdmins.userId))
    .where(where)
    .orderBy(desc(platformAdmins.createdAt))
    .limit(pageSize)
    .offset(offset)
  const totalRows = db
    .select({ value: count() })
    .from(platformAdmins)
    .innerJoin(user, eq(user.id, platformAdmins.userId))
    .where(where)
  return withPagination(rows, totalRows, page, pageSize)
}

export async function getPlatformAdminById(id: string) {
  const db = getDb()
  const rows = await db
    .select()
    .from(platformAdmins)
    .where(eq(platformAdmins.id, id))
    .limit(1)
  return rows[0]
}

export async function upsertPlatformAdmin(input: {
  userId: string
  role: PlatformRole
  active?: boolean
  actorUserId: string
}) {
  const db = getDb()
  const existing = await db
    .select({ id: platformAdmins.id })
    .from(platformAdmins)
    .where(eq(platformAdmins.userId, input.userId))
    .limit(1)

  if (existing[0]) {
    const [updated] = await db
      .update(platformAdmins)
      .set({
        role: input.role,
        active: input.active ?? true,
        revokedAt: input.active === false ? new Date() : null,
        revokedByUserId: input.active === false ? input.actorUserId : null,
        updatedAt: new Date(),
      })
      .where(eq(platformAdmins.id, existing[0].id))
      .returning()
    return updated
  }

  const [created] = await db
    .insert(platformAdmins)
    .values({
      userId: input.userId,
      role: input.role,
      active: input.active ?? true,
      createdByUserId: input.actorUserId,
      revokedAt: input.active === false ? new Date() : null,
      revokedByUserId: input.active === false ? input.actorUserId : null,
    })
    .returning()
  return created
}

export async function updatePlatformAdmin(input: {
  id: string
  role?: PlatformRole
  active?: boolean
  actorUserId: string
}) {
  const db = getDb()
  const [updated] = await db
    .update(platformAdmins)
    .set({
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.active !== undefined
        ? {
            active: input.active,
            revokedAt: input.active ? null : new Date(),
            revokedByUserId: input.active ? null : input.actorUserId,
          }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(platformAdmins.id, input.id))
    .returning()
  return updated
}
