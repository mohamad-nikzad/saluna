import { Hono } from 'hono'
import { eq, or } from 'drizzle-orm'
import { z } from 'zod'

import { getDb } from '@repo/database/client'
import { user } from '@repo/database/schema'
import {
  evaluateStaffInviteLinkRouting,
  maskStaffInvitePhone,
  resolveStaffInviteByToken,
} from '@repo/database/staff'
import { auth } from '@repo/auth/server'

import type { AppEnv } from '../factory'
import { error, ok } from '../lib/responses'
import { zValidator } from '../lib/validate'

const tokenParamSchema = z.object({ token: z.string().min(32).max(128) })

async function loadSessionPhone(c: Parameters<typeof ok>[0]) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  const sessionUserId = session?.user?.id
  if (!sessionUserId) {
    return { sessionPresent: false as const, sessionPhone: null as string | null }
  }
  const rows = await getDb()
    .select({
      phoneNumber: user.phoneNumber,
      username: user.username,
      verified: user.phoneNumberVerified,
    })
    .from(user)
    .where(eq(user.id, sessionUserId))
    .limit(1)
  const row = rows[0]
  if (!row?.verified) {
    return { sessionPresent: true as const, sessionPhone: null as string | null }
  }
  return {
    sessionPresent: true as const,
    sessionPhone: row.phoneNumber ?? row.username,
  }
}

async function isPhoneRegistered(phone: string) {
  const rows = await getDb()
    .select({ id: user.id })
    .from(user)
    .where(or(eq(user.phoneNumber, phone), eq(user.username, phone)))
    .limit(1)
  return rows[0] != null
}

/**
 * Public Staff Invite link lookup. Resolves routing into login/registration
 * or a switch-account path. Never grants Staff Profile Access by itself.
 */
export const staffInviteLinksRoute = new Hono<AppEnv>().get(
  '/:token',
  zValidator('param', tokenParamSchema),
  async (c) => {
    const { token } = c.req.valid('param')
    const resolved = await resolveStaffInviteByToken({ token })
    if (resolved.status === 'not_found') {
      return error(c, 'لینک دعوت نامعتبر یا منقضی شده است', 404, 'INVITE_INVALID')
    }

    const invite = resolved.invite
    const { sessionPresent, sessionPhone } = await loadSessionPhone(c)
    const phoneRegistered = await isPhoneRegistered(invite.phone)
    const phonesMatch =
      sessionPresent && sessionPhone != null
        ? sessionPhone === invite.phone
        : sessionPresent
          ? false
          : null

    const routing = evaluateStaffInviteLinkRouting({
      inviteStatus: invite.status,
      sessionPresent,
      phonesMatch,
      phoneRegistered,
    })

    return ok(c, {
      invite: {
        id: invite.inviteId,
        salonId: invite.salonId,
        salonName: invite.salonName,
        staffProfileId: invite.staffProfileId,
        staffName: invite.staffName,
        phone: maskStaffInvitePhone(invite.phone),
        expiresAt: invite.expiresAt.toISOString(),
        status: invite.status,
      },
      phoneRegistered,
      phonesMatch,
      routing,
    })
  },
)
