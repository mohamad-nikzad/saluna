import { and, eq, isNull } from 'drizzle-orm'
import { getDb } from '../client'
import { messagingLinkTokens, userMessagingAccounts } from '../schema'

export type MessagingProviderId = 'telegram' | 'bale' | 'rubika' | 'whatsapp'

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

function rowToAccount(row: typeof userMessagingAccounts.$inferSelect): UserMessagingAccount {
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

function rowToToken(row: typeof messagingLinkTokens.$inferSelect): MessagingLinkToken {
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

export async function createLinkToken(input: CreateLinkTokenInput): Promise<MessagingLinkToken> {
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

/** Atomically marks a token consumed and returns it if it was valid (unconsumed, unexpired). */
export async function consumeLinkToken(
  token: string,
  provider: MessagingProviderId
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
        isNull(messagingLinkTokens.consumedAt)
      )
    )
    .returning()
  if (!row) return undefined
  if (row.expiresAt.getTime() < now.getTime()) return undefined
  return rowToToken(row)
}

export async function findAccountByExternalId(
  provider: MessagingProviderId,
  externalId: string
): Promise<UserMessagingAccount | undefined> {
  const db = getDb()
  const [row] = await db
    .select()
    .from(userMessagingAccounts)
    .where(
      and(
        eq(userMessagingAccounts.provider, provider),
        eq(userMessagingAccounts.externalId, externalId)
      )
    )
    .limit(1)
  return row ? rowToAccount(row) : undefined
}

export async function findAccountByUserAndProvider(
  userId: string,
  provider: MessagingProviderId
): Promise<UserMessagingAccount | undefined> {
  const db = getDb()
  const [row] = await db
    .select()
    .from(userMessagingAccounts)
    .where(
      and(
        eq(userMessagingAccounts.userId, userId),
        eq(userMessagingAccounts.provider, provider)
      )
    )
    .limit(1)
  return row ? rowToAccount(row) : undefined
}

export async function upsertAccount(input: UpsertAccountInput): Promise<UserMessagingAccount> {
  const db = getDb()
  const [row] = await db
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

export async function setAccountEnabled(
  id: string,
  userId: string,
  enabled: boolean
): Promise<UserMessagingAccount | undefined> {
  const db = getDb()
  const [row] = await db
    .update(userMessagingAccounts)
    .set({ enabled, updatedAt: new Date() })
    .where(
      and(eq(userMessagingAccounts.id, id), eq(userMessagingAccounts.userId, userId))
    )
    .returning()
  return row ? rowToAccount(row) : undefined
}

export async function deleteAccount(id: string, userId: string): Promise<boolean> {
  const db = getDb()
  const rows = await db
    .delete(userMessagingAccounts)
    .where(
      and(eq(userMessagingAccounts.id, id), eq(userMessagingAccounts.userId, userId))
    )
    .returning({ id: userMessagingAccounts.id })
  return rows.length > 0
}

export async function listAccountsForUser(userId: string): Promise<UserMessagingAccount[]> {
  const db = getDb()
  const rows = await db
    .select()
    .from(userMessagingAccounts)
    .where(eq(userMessagingAccounts.userId, userId))
  return rows.map(rowToAccount)
}
