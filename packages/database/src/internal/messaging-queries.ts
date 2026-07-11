import { and, eq, gte, isNull, sql } from 'drizzle-orm'
import { DEFAULT_PUBLIC_LAYOUT_ID } from '@repo/salon-core/public-layouts'
import { DEFAULT_PUBLIC_THEME_ID } from '@repo/salon-core/public-themes'
import { getDb } from '../client'
import type { MessagingProviderId } from '../messaging-provider-id'
import {
  messagingLinkTokens,
  salonPublicSettings,
  userMessagingAccounts,
} from '../schema'

export type { MessagingProviderId }

type DbClient = ReturnType<typeof getDb>
type DbExecutor =
  | DbClient
  | Parameters<Parameters<DbClient['transaction']>[0]>[0]

export type UserMessagingAccount = {
  id: string
  userId: string
  provider: MessagingProviderId
  externalId: string
  displayName: string | null
  enabled: boolean
  linkedAt: Date
  updatedAt: Date
}

export type MessagingLinkToken = {
  token: string
  userId: string
  salonId: string
  provider: MessagingProviderId
  createdAt: Date
  expiresAt: Date
  consumedAt: Date | null
}

export type CreateLinkTokenInput = {
  userId: string
  salonId: string
  provider: MessagingProviderId
  ttlMinutes: number
}

export type UpsertAccountInput = {
  userId: string
  provider: MessagingProviderId
  externalId: string
  displayName?: string | null
}

export const MESSAGING_LINK_WINDOW_MS = 15 * 60 * 1000
export const MESSAGING_LINK_MAX_PER_WINDOW = 10

export type MessagingLinkRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number }

/** Limits how many link tokens a user can mint per rolling window. */
export async function checkMessagingLinkRateLimit(
  userId: string,
): Promise<MessagingLinkRateLimitResult> {
  const db = getDb()
  const now = new Date()
  const windowStart = new Date(now.getTime() - MESSAGING_LINK_WINDOW_MS)

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(messagingLinkTokens)
    .where(
      and(
        eq(messagingLinkTokens.userId, userId),
        gte(messagingLinkTokens.createdAt, windowStart),
      ),
    )

  if (count < MESSAGING_LINK_MAX_PER_WINDOW) {
    return { allowed: true }
  }

  const [oldest] = await db
    .select({ createdAt: messagingLinkTokens.createdAt })
    .from(messagingLinkTokens)
    .where(
      and(
        eq(messagingLinkTokens.userId, userId),
        gte(messagingLinkTokens.createdAt, windowStart),
      ),
    )
    .orderBy(messagingLinkTokens.createdAt)
    .limit(1)

  const retryAfterMs = oldest
    ? Math.max(
        0,
        oldest.createdAt.getTime() + MESSAGING_LINK_WINDOW_MS - now.getTime(),
      )
    : MESSAGING_LINK_WINDOW_MS

  return { allowed: false, retryAfterMs }
}

function rowToAccount(
  row: typeof userMessagingAccounts.$inferSelect,
): UserMessagingAccount {
  return {
    id: row.id,
    userId: row.userId,
    provider: row.provider,
    externalId: row.externalId,
    displayName: row.displayName,
    enabled: row.enabled,
    linkedAt: row.linkedAt,
    updatedAt: row.updatedAt,
  }
}

function rowToToken(
  row: typeof messagingLinkTokens.$inferSelect,
): MessagingLinkToken {
  return {
    token: row.token,
    userId: row.userId,
    salonId: row.salonId,
    provider: row.provider,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    consumedAt: row.consumedAt,
  }
}

export async function createLinkToken(
  input: CreateLinkTokenInput,
): Promise<MessagingLinkToken> {
  const db = getDb()
  const expiresAt = new Date(Date.now() + input.ttlMinutes * 60 * 1000)
  const [row] = await db
    .insert(messagingLinkTokens)
    .values({
      userId: input.userId,
      salonId: input.salonId,
      provider: input.provider,
      expiresAt,
    })
    .returning()
  return rowToToken(row)
}

/** Reads a link token without consuming it. Returns undefined if missing, consumed, or expired. */
export async function findValidLinkToken(
  token: string,
  provider: MessagingProviderId,
): Promise<MessagingLinkToken | undefined> {
  const db = getDb()
  const now = new Date()
  const [row] = await db
    .select()
    .from(messagingLinkTokens)
    .where(
      and(
        eq(messagingLinkTokens.token, token),
        eq(messagingLinkTokens.provider, provider),
        isNull(messagingLinkTokens.consumedAt),
      ),
    )
    .limit(1)
  if (!row) return undefined
  if (row.expiresAt.getTime() < now.getTime()) return undefined
  return rowToToken(row)
}

/** Atomically consumes a link token when valid (unconsumed, unexpired). */
export async function consumeLinkTokenIfValid(
  token: string,
  provider: MessagingProviderId,
): Promise<MessagingLinkToken | undefined> {
  const db = getDb()
  const now = new Date()
  const [row] = await db
    .update(messagingLinkTokens)
    .set({ consumedAt: now })
    .where(
      and(
        eq(messagingLinkTokens.token, token),
        eq(messagingLinkTokens.provider, provider),
        isNull(messagingLinkTokens.consumedAt),
        gte(messagingLinkTokens.expiresAt, now),
      ),
    )
    .returning()
  return row ? rowToToken(row) : undefined
}

/** @deprecated Use {@link consumeLinkTokenIfValid}. */
export const consumeLinkToken = consumeLinkTokenIfValid

async function upsertAccountWithExecutor(
  executor: DbExecutor,
  input: UpsertAccountInput,
): Promise<UserMessagingAccount> {
  const [row] = await executor
    .insert(userMessagingAccounts)
    .values({
      userId: input.userId,
      provider: input.provider,
      externalId: input.externalId,
      displayName: input.displayName ?? null,
    })
    .onConflictDoUpdate({
      target: [userMessagingAccounts.userId, userMessagingAccounts.provider],
      set: {
        externalId: input.externalId,
        displayName: input.displayName ?? null,
        enabled: true,
        updatedAt: new Date(),
      },
    })
    .returning()
  return rowToAccount(row)
}

async function enableMessagingProviderForSalonWithExecutor(
  executor: DbExecutor,
  salonId: string,
  provider: MessagingProviderId,
): Promise<void> {
  const [row] = await executor
    .select({ providers: salonPublicSettings.enabledMessagingProviders })
    .from(salonPublicSettings)
    .where(eq(salonPublicSettings.salonId, salonId))
    .limit(1)

  const current = row?.providers ?? []
  if (current.includes(provider)) return

  const next = [...current, provider]
  const [existing] = await executor
    .select({ salonId: salonPublicSettings.salonId })
    .from(salonPublicSettings)
    .where(eq(salonPublicSettings.salonId, salonId))
    .limit(1)

  if (existing) {
    await executor
      .update(salonPublicSettings)
      .set({ enabledMessagingProviders: next, updatedAt: new Date() })
      .where(eq(salonPublicSettings.salonId, salonId))
    return
  }

  await executor.insert(salonPublicSettings).values({
    salonId,
    enabled: false,
    themeId: DEFAULT_PUBLIC_THEME_ID,
    layoutId: DEFAULT_PUBLIC_LAYOUT_ID,
    appointmentRequestsEnabled: true,
    enabledMessagingProviders: next,
  })
}

export type LinkMessagingAccountInput = UpsertAccountInput & {
  salonId: string
}

/** Upserts the user messaging account and enables the provider for the salon atomically. */
export async function linkMessagingAccountAndEnableProvider(
  input: LinkMessagingAccountInput,
): Promise<UserMessagingAccount> {
  const db = getDb()
  return db.transaction(async (tx) => {
    const account = await upsertAccountWithExecutor(tx, input)
    await enableMessagingProviderForSalonWithExecutor(
      tx,
      input.salonId,
      input.provider,
    )
    return account
  })
}

export async function findAccountByExternalId(
  provider: MessagingProviderId,
  externalId: string,
): Promise<UserMessagingAccount | undefined> {
  const db = getDb()
  const [row] = await db
    .select()
    .from(userMessagingAccounts)
    .where(
      and(
        eq(userMessagingAccounts.provider, provider),
        eq(userMessagingAccounts.externalId, externalId),
      ),
    )
    .limit(1)
  return row ? rowToAccount(row) : undefined
}

export async function findAccountByUserAndProvider(
  userId: string,
  provider: MessagingProviderId,
): Promise<UserMessagingAccount | undefined> {
  const db = getDb()
  const [row] = await db
    .select()
    .from(userMessagingAccounts)
    .where(
      and(
        eq(userMessagingAccounts.userId, userId),
        eq(userMessagingAccounts.provider, provider),
      ),
    )
    .limit(1)
  return row ? rowToAccount(row) : undefined
}

export async function upsertAccount(
  input: UpsertAccountInput,
): Promise<UserMessagingAccount> {
  return upsertAccountWithExecutor(getDb(), input)
}

export async function setAccountEnabled(
  id: string,
  userId: string,
  enabled: boolean,
): Promise<UserMessagingAccount | undefined> {
  const db = getDb()
  const [row] = await db
    .update(userMessagingAccounts)
    .set({ enabled, updatedAt: new Date() })
    .where(
      and(
        eq(userMessagingAccounts.id, id),
        eq(userMessagingAccounts.userId, userId),
      ),
    )
    .returning()
  return row ? rowToAccount(row) : undefined
}

export async function deleteAccount(
  id: string,
  userId: string,
): Promise<boolean> {
  const db = getDb()
  const rows = await db
    .delete(userMessagingAccounts)
    .where(
      and(
        eq(userMessagingAccounts.id, id),
        eq(userMessagingAccounts.userId, userId),
      ),
    )
    .returning({ id: userMessagingAccounts.id })
  return rows.length > 0
}

export async function listAccountsForUser(
  userId: string,
): Promise<UserMessagingAccount[]> {
  const db = getDb()
  const rows = await db
    .select()
    .from(userMessagingAccounts)
    .where(eq(userMessagingAccounts.userId, userId))
  return rows.map(rowToAccount)
}
