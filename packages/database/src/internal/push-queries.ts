import { and, eq } from 'drizzle-orm'
import { getDb } from '../client'
import { pushSubscriptions } from '../schema'

export type PushSubscriptionKeys = {
  endpoint: string
  p256dh: string
  auth: string
}

export async function upsertPushSubscription(
  userId: string,
  salonId: string,
  keys: PushSubscriptionKeys,
): Promise<void> {
  const db = getDb()
  await db
    .insert(pushSubscriptions)
    .values({
      salonId,
      userId,
      endpoint: keys.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        userId,
        salonId,
        p256dh: keys.p256dh,
        auth: keys.auth,
        createdAt: new Date(),
      },
    })
}

export async function getPushSubscriptionsForUser(
  userId: string,
  salonId?: string,
): Promise<PushSubscriptionKeys[]> {
  const db = getDb()
  return db
    .select({
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      auth: pushSubscriptions.auth,
    })
    .from(pushSubscriptions)
    .where(
      salonId
        ? and(
            eq(pushSubscriptions.userId, userId),
            eq(pushSubscriptions.salonId, salonId),
          )
        : eq(pushSubscriptions.userId, userId),
    )
}

export async function deletePushSubscriptionByEndpoint(
  endpoint: string,
): Promise<void> {
  const db = getDb()
  await db
    .delete(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint))
}

export async function deletePushSubscriptionForUser(
  userId: string,
  salonId: string,
  endpoint: string,
): Promise<boolean> {
  const db = getDb()
  const removed = await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.salonId, salonId),
        eq(pushSubscriptions.endpoint, endpoint),
      ),
    )
    .returning({ id: pushSubscriptions.id })
  return removed.length > 0
}
