import type { BetterAuthPlugin } from 'better-auth'
import {
  APIError,
  createAuthEndpoint,
  sensitiveSessionMiddleware,
} from 'better-auth/api'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '@repo/database/client'
import { account, user } from '@repo/database/schema'

/**
 * Replaces Better Auth's server-only setPassword operation. A passwordless
 * credential row is completed in place, and concurrent setup never replaces
 * a password that another request has already established.
 */
export function firstPassword() {
  return {
    id: 'first-password',
    endpoints: {
      setPassword: createAuthEndpoint(
        {
          method: 'POST',
          body: z.object({ newPassword: z.string() }),
          use: [sensitiveSessionMiddleware],
        },
        async (ctx) => {
          const { newPassword } = ctx.body
          const { minPasswordLength, maxPasswordLength } =
            ctx.context.password.config
          if (newPassword.length < minPasswordLength) {
            throw new APIError('BAD_REQUEST', {
              code: 'PASSWORD_TOO_SHORT',
              message: 'Password is too short',
            })
          }
          if (newPassword.length > maxPasswordLength) {
            throw new APIError('BAD_REQUEST', {
              code: 'PASSWORD_TOO_LONG',
              message: 'Password is too long',
            })
          }

          const userId = ctx.context.session.user.id
          const passwordHash = await ctx.context.password.hash(newPassword)
          await getDb().transaction(async (tx) => {
            // The identity exists even when its credential does not. Locking it
            // serializes first-time creation as well as completion of null rows.
            const [identity] = await tx
              .select({ id: user.id })
              .from(user)
              .where(eq(user.id, userId))
              .for('update')
            if (!identity) {
              throw new APIError('UNAUTHORIZED', {
                code: 'UNAUTHORIZED',
                message: 'Unauthorized',
              })
            }

            const credentials = await tx
              .select({ id: account.id, password: account.password })
              .from(account)
              .where(
                and(
                  eq(account.userId, userId),
                  eq(account.providerId, 'credential'),
                ),
              )
              .for('update')
            if (credentials.some((credential) => credential.password)) {
              throw new APIError('BAD_REQUEST', {
                code: 'PASSWORD_ALREADY_SET',
                message: 'Password is already set',
              })
            }

            if (credentials.length > 0) {
              await tx
                .update(account)
                .set({ password: passwordHash, updatedAt: new Date() })
                .where(
                  and(
                    eq(account.userId, userId),
                    eq(account.providerId, 'credential'),
                  ),
                )
            } else {
              await tx.insert(account).values({
                userId,
                providerId: 'credential',
                accountId: userId,
                password: passwordHash,
              })
            }
          })
          return ctx.json({ status: true })
        },
      ),
    },
  } satisfies BetterAuthPlugin
}
