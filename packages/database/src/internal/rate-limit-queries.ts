import { and, eq, gte, lt, sql } from 'drizzle-orm'
import { getDb } from '../client'
import { publicSubmitRateLimits } from '../schema'

export const PUBLIC_SUBMIT_WINDOW_MS = 10 * 60 * 1000
export const PUBLIC_SUBMIT_MAX_PER_WINDOW = 5

export type PublicSubmitRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number }

/**
 * Records a public submit attempt for `ip` and returns whether the request is
 * within the rate limit (`PUBLIC_SUBMIT_MAX_PER_WINDOW` per
 * `PUBLIC_SUBMIT_WINDOW_MS`). Opportunistically purges rows older than the
 * window so the table stays small.
 */
export async function checkAndRecordPublicSubmit(
  ip: string,
): Promise<PublicSubmitRateLimitResult> {
  const db = getDb()
  const now = new Date()
  const windowStart = new Date(now.getTime() - PUBLIC_SUBMIT_WINDOW_MS)

  // Purge stale rows for this IP first to keep the count query honest.
  await db
    .delete(publicSubmitRateLimits)
    .where(
      and(
        eq(publicSubmitRateLimits.ip, ip),
        lt(publicSubmitRateLimits.createdAt, windowStart),
      ),
    )

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(publicSubmitRateLimits)
    .where(
      and(
        eq(publicSubmitRateLimits.ip, ip),
        gte(publicSubmitRateLimits.createdAt, windowStart),
      ),
    )

  if (count >= PUBLIC_SUBMIT_MAX_PER_WINDOW) {
    const [oldest] = await db
      .select({ createdAt: publicSubmitRateLimits.createdAt })
      .from(publicSubmitRateLimits)
      .where(
        and(
          eq(publicSubmitRateLimits.ip, ip),
          gte(publicSubmitRateLimits.createdAt, windowStart),
        ),
      )
      .orderBy(publicSubmitRateLimits.createdAt)
      .limit(1)
    const retryAfterMs = oldest
      ? Math.max(
          0,
          oldest.createdAt.getTime() + PUBLIC_SUBMIT_WINDOW_MS - now.getTime(),
        )
      : PUBLIC_SUBMIT_WINDOW_MS
    return { allowed: false, retryAfterMs }
  }

  await db.insert(publicSubmitRateLimits).values({ ip })
  return { allowed: true }
}

/** Daily housekeeping — call from cron to clear all expired rows globally. */
export async function purgePublicSubmitRateLimits(): Promise<number> {
  const db = getDb()
  const windowStart = new Date(Date.now() - PUBLIC_SUBMIT_WINDOW_MS)
  const deleted = await db
    .delete(publicSubmitRateLimits)
    .where(lt(publicSubmitRateLimits.createdAt, windowStart))
    .returning({ id: publicSubmitRateLimits.id })
  return deleted.length
}
