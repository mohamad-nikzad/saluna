import { Hono } from 'hono'
import { z } from 'zod'

import { auth, getAuthForRequest } from '@repo/auth/server'
import {
  completeSalonHandoff,
  getActiveSalonHandoff,
  getSalonIdentityConflictForPhone,
  hasCredentialPassword,
} from '@repo/database/salon-handoff'
import { newPasswordSchema } from '@repo/salon-core/forms/auth'

import type { AppEnv } from '../factory'
import { error, ok } from '../lib/responses'
import { zValidator } from '../lib/validate'

const tokenParamSchema = z.object({ token: z.string().min(32).max(128) })
const otpSchema = z.object({ code: z.string().length(6) })
const completeSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  password: newPasswordSchema.optional(),
})
function maskedPhone(phone: string) {
  return `${phone.slice(0, 4)}•••${phone.slice(-4)}`
}

function forwardSetCookie(c: Parameters<typeof ok>[0], headers: Headers) {
  for (const cookie of headers.getSetCookie()) {
    c.header('Set-Cookie', cookie, { append: true })
  }
}

async function proxyOtp(
  c: Parameters<typeof ok>[0],
  path: string,
  body: object,
) {
  const requestAuth = getAuthForRequest(c.req.raw)
  if (!requestAuth) return error(c, 'مبدأ درخواست مجاز نیست', 403)
  const url = new URL(c.req.url)
  url.pathname = `/api/v1/auth${path}`
  url.search = ''
  const headers = new Headers(c.req.raw.headers)
  headers.set('content-type', 'application/json')
  const response = await requestAuth.handler(
    new Request(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }),
  )
  forwardSetCookie(c, response.headers)
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })
}

export const salonHandoffRoute = new Hono<AppEnv>()
  .get('/:token', zValidator('param', tokenParamSchema), async (c) => {
    const handoff = await getActiveSalonHandoff(c.req.valid('param').token)
    if (!handoff?.intendedOwnerPhone) {
      return error(
        c,
        'لینک تحویل نامعتبر یا منقضی شده است',
        404,
        'HANDOFF_INVALID',
      )
    }
    return ok(c, {
      phone: maskedPhone(handoff.intendedOwnerPhone),
      expiresAt: handoff.expiresAt,
      requiresPassword: !handoff.credentialPassword,
    })
  })
  .post(
    '/:token/send-otp',
    zValidator('param', tokenParamSchema),
    async (c) => {
      const handoff = await getActiveSalonHandoff(c.req.valid('param').token)
      if (!handoff?.intendedOwnerPhone) {
        return error(
          c,
          'لینک تحویل نامعتبر یا منقضی شده است',
          404,
          'HANDOFF_INVALID',
        )
      }
      return proxyOtp(c, '/phone-number/send-otp', {
        phoneNumber: handoff.intendedOwnerPhone,
      })
    },
  )
  .post(
    '/:token/verify-otp',
    zValidator('param', tokenParamSchema),
    zValidator('json', otpSchema),
    async (c) => {
      const handoff = await getActiveSalonHandoff(c.req.valid('param').token)
      if (!handoff?.intendedOwnerPhone) {
        return error(
          c,
          'لینک تحویل نامعتبر یا منقضی شده است',
          404,
          'HANDOFF_INVALID',
        )
      }
      return proxyOtp(c, '/phone-number/verify', {
        phoneNumber: handoff.intendedOwnerPhone,
        code: c.req.valid('json').code,
      })
    },
  )
  .post(
    '/:token/complete',
    zValidator('param', tokenParamSchema),
    zValidator('json', completeSchema),
    async (c) => {
      const session = await auth.api.getSession({ headers: c.req.raw.headers })
      if (!session?.user) return error(c, 'ابتدا شماره را تایید کنید', 401)
      const handoff = await getActiveSalonHandoff(c.req.valid('param').token)
      if (!handoff?.intendedOwnerPhone) {
        const retryResult = await completeSalonHandoff({
          token: c.req.valid('param').token,
          userId: session.user.id,
          displayName: c.req.valid('json').displayName,
        })
        if (retryResult.status === 'completed') {
          return ok(c, {
            salonId: retryResult.salonId,
            redirectTo: '/dashboard',
            publicEnabled: retryResult.publicEnabled,
          })
        }
        return error(
          c,
          'لینک تحویل نامعتبر یا منقضی شده است',
          409,
          'HANDOFF_INVALID',
        )
      }
      const identityPhone =
        session.user.phoneNumber ?? session.user.username ?? ''
      const conflict = await getSalonIdentityConflictForPhone({
        phone: identityPhone,
        excludingSalonId: handoff.salonId,
      })
      if (conflict) {
        return error(
          c,
          `این شماره قبلاً به سالن «${conflict.salonName}» با وضعیت ${conflict.salonStatus} متصل است`,
          409,
          'HANDOFF_IDENTITY_CONFLICT',
        )
      }

      const body = c.req.valid('json')
      const userHasPassword = await hasCredentialPassword(session.user.id)
      if (!userHasPassword) {
        if (!body.password) return error(c, 'رمز عبور الزامی است', 400)
        try {
          await auth.api.setPassword({
            body: { newPassword: body.password },
            headers: c.req.raw.headers,
          })
        } catch (err) {
          const code =
            typeof err === 'object' && err !== null
              ? (err as { body?: { code?: string } }).body?.code
              : undefined
          if (code !== 'PASSWORD_ALREADY_SET') {
            if (code === 'PASSWORD_TOO_SHORT') {
              return error(c, 'رمز عبور باید حداقل ۸ کاراکتر باشد', 400, code)
            }
            throw err
          }
        }
      }

      const result = await completeSalonHandoff({
        token: c.req.valid('param').token,
        userId: session.user.id,
        displayName: body.displayName,
      })
      if (result.status === 'invalid') {
        return error(
          c,
          'لینک تحویل نامعتبر یا منقضی شده است',
          409,
          'HANDOFF_INVALID',
        )
      }
      if (result.status === 'phone_mismatch') {
        return error(
          c,
          'شماره تاییدشده با مالک موردنظر مطابقت ندارد',
          403,
          'HANDOFF_PHONE_MISMATCH',
        )
      }
      if (result.status === 'identity_conflict') {
        return error(
          c,
          `این شماره قبلاً به سالن «${result.conflict.salonName}» با وضعیت ${result.conflict.salonStatus} متصل است`,
          409,
          'HANDOFF_IDENTITY_CONFLICT',
        )
      }
      return ok(c, {
        salonId: result.salonId,
        redirectTo: '/dashboard',
        publicEnabled: result.publicEnabled,
      })
    },
  )
