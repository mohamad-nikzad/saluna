import { Hono } from 'hono'
import { and, eq, isNotNull, or } from 'drizzle-orm'
import { z } from 'zod'
import { auth, getAuthForRequest } from '@repo/auth/server'
import { isAuthOtpLoginEnabled } from '@repo/auth/phone-otp'
import {
  exchangePasswordResetOtp,
  PasswordRecoveryError,
} from '@repo/auth/password-recovery'
import { getDb } from '@repo/database/client'
import {
  businessSettings,
  account,
  member,
  organization,
  salonOnboarding,
  salonMember,
  salonProfile,
  user,
} from '@repo/database/schema'
import { normalizeCalendarColorId } from '@repo/salon-core/calendar-colors'
import { STAFF_COLORS } from '@repo/salon-core/types'
import {
  preWorkspaceAccountSchema,
  preWorkspaceSchema,
  resetPasswordSchema,
  signupSchema,
} from '@repo/salon-core/forms/auth'
import { phoneSchema } from '@repo/salon-core/forms/primitives'
import { getManagerOnboardingFlags } from '@repo/database/onboarding'
import { getUserWithServiceIds } from '@repo/database/staff'
import { getMemberForUser } from '@repo/database/members'
import { mapRole } from '@repo/auth/permissions'
import type { AppEnv } from '../factory'
import { zValidator } from '../lib/validate'
import { brand } from '@repo/brand'
import { error, ok } from '../lib/responses'

const OWNER_COLOR = normalizeCalendarColorId(STAFF_COLORS[0])
const phoneStatusSchema = z.object({ phone: phoneSchema })
const phoneOtpRequestSchema = z.object({ phoneNumber: phoneSchema })
const verifyPasswordResetOtpSchema = z.object({
  phoneNumber: phoneSchema,
  otp: z.string().length(6),
})

function phoneToEmail(phone: string): string {
  return `${phone}@${brand.emailLocalDomain}`
}

function forwardSetCookie(c: Parameters<typeof ok>[0], headers: Headers) {
  // Better Auth sets multiple cookies on signup (the 7-day `session_token` and,
  // with cookieCache enabled, a short-lived `session_data` cache cookie). A
  // plain `headers.get('set-cookie')` collapses them into one comma-joined
  // string the browser can't parse, dropping the real session token — so the
  // session silently dies once the 60s cache cookie expires. Forward each
  // Set-Cookie header individually instead.
  for (const cookie of headers.getSetCookie()) {
    c.header('Set-Cookie', cookie, { append: true })
  }
}

/**
 * Salon names are entered in Persian, which can't form a Latin URL slug, so we
 * mint a unique placeholder at signup. The owner picks a friendly booking link
 * later in onboarding.
 */
async function generateUniqueSlug(
  db: ReturnType<typeof getDb>,
): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const slug = `salon-${Math.random().toString(36).slice(2, 8)}`
    const taken = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.slug, slug))
      .limit(1)
    if (!taken[0]) return slug
  }
  throw new Error('could not generate a unique salon slug')
}

function isConflict(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : ''
  return (
    msg.includes('already') ||
    msg.includes('exists') ||
    msg.includes('duplicate') ||
    msg.includes('unique')
  )
}

function getBetterAuthErrorCode(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null) return undefined
  const body = (err as { body?: { code?: unknown } }).body
  return typeof body?.code === 'string' ? body.code : undefined
}

async function getSessionUser(c: Parameters<typeof ok>[0]) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  return session?.user
}

async function hasCredentialPassword(userId: string): Promise<boolean> {
  const rows = await getDb()
    .select({ id: account.id })
    .from(account)
    .where(
      and(
        eq(account.userId, userId),
        eq(account.providerId, 'credential'),
        isNotNull(account.password),
      ),
    )
    .limit(1)
  return Boolean(rows[0])
}

async function isCompletedAccount(phone: string): Promise<boolean> {
  const rows = await getDb()
    .select({ id: user.id })
    .from(user)
    .innerJoin(
      account,
      and(eq(account.userId, user.id), eq(account.providerId, 'credential')),
    )
    .innerJoin(member, eq(member.userId, user.id))
    .where(or(eq(user.phoneNumber, phone), eq(user.username, phone)))
    .limit(1)
  return Boolean(rows[0])
}

async function guardOtpLogin(c: Parameters<typeof ok>[0]) {
  if (isAuthOtpLoginEnabled()) return handleAuthRequest(c)

  const parsed = phoneOtpRequestSchema.safeParse(
    await c.req.raw
      .clone()
      .json()
      .catch(() => null),
  )
  if (!parsed.success) return handleAuthRequest(c)
  if (await isCompletedAccount(parsed.data.phoneNumber)) {
    return error(
      c,
      'ورود با کد پیامکی موقتاً غیرفعال است',
      403,
      'OTP_LOGIN_DISABLED',
    )
  }
  return handleAuthRequest(c)
}

function handleAuthRequest(c: Parameters<typeof ok>[0]) {
  const requestAuth = getAuthForRequest(c.req.raw)
  if (!requestAuth) return error(c, 'مبدأ درخواست مجاز نیست', 403)
  return requestAuth.handler(c.req.raw)
}

async function getOrganizationById(db: ReturnType<typeof getDb>, id: string) {
  const rows = await db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
    })
    .from(organization)
    .where(eq(organization.id, id))
    .limit(1)
  return rows[0]
}

async function createWorkspaceSidecars(input: {
  db: ReturnType<typeof getDb>
  userId: string
  orgId: string
  managerName: string
}) {
  await input.db.transaction(async (tx) => {
    await tx.insert(salonProfile).values({ organizationId: input.orgId })
    await tx.insert(salonMember).values({
      userId: input.userId,
      organizationId: input.orgId,
      displayName: input.managerName,
      color: OWNER_COLOR,
      active: true,
    })
    await tx.insert(businessSettings).values({
      salonId: input.orgId,
      workingStart: '09:00',
      workingEnd: '19:00',
      slotDurationMinutes: 30,
    })
    await tx.insert(salonOnboarding).values({ salonId: input.orgId })
  })
}

/**
 * Signup wrapper: creates the owner user via Better Auth, then the salon
 * organization, sidecars, and initial business hours. The Better Auth sign-in
 * cookie is forwarded onto our response so the PWA is logged in immediately.
 *
 * Login / logout / get-session are served directly by the mounted Better Auth
 * handler at /api/v1/auth/sign-in/*, /sign-out, /get-session.
 *
 * `/me` first resolves the Better Auth session, then optionally resolves salon
 * membership. OTP-created users can be authenticated before workspace creation,
 * so the route returns `needs_workspace` when no membership exists yet.
 */
export const authRoute = new Hono<AppEnv>()
  .get('/me', async (c) => {
    const sessionUser = await getSessionUser(c)
    if (!sessionUser) return error(c, 'وارد نشده‌اید', 401)

    const member = await getMemberForUser(sessionUser.id)
    if (!member) {
      const userHasPassword = await hasCredentialPassword(sessionUser.id)
      return ok(c, {
        status: 'needs_workspace',
        user: {
          id: sessionUser.id,
          name: sessionUser.name,
          phone: sessionUser.phoneNumber ?? sessionUser.username ?? '',
          hasPassword: userHasPassword,
        },
      })
    }

    const role = mapRole(member.role)
    const userId = member.userId
    const salonId = member.organizationId
    const user = await getUserWithServiceIds(userId, salonId)
    if (!user) return error(c, 'وارد نشده‌اید', 401)

    if (user.role === 'manager') {
      const flags = await getManagerOnboardingFlags(salonId)
      return ok(c, {
        status: 'ready',
        user: {
          ...user,
          needsOnboarding: flags.needsOnboarding,
          onboardingCompleted: flags.onboardingCompleted,
        },
      })
    }

    return ok(c, { status: 'ready', user: { ...user, role } })
  })
  .post('/phone-number/send-otp', guardOtpLogin)
  .post('/phone-number/verify', guardOtpLogin)
  .post('/reset-password', async (c) => {
    const parsed = resetPasswordSchema.safeParse(
      await c.req.raw
        .clone()
        .json()
        .catch(() => null),
    )
    if (!parsed.success) {
      return error(c, parsed.error.issues[0]?.message ?? 'داده نامعتبر', 400)
    }
    return handleAuthRequest(c)
  })
  .post(
    '/phone-number/verify-password-reset-otp',
    zValidator('json', verifyPasswordResetOtpSchema),
    async (c) => {
      const { phoneNumber, otp } = c.req.valid('json')
      try {
        const token = await exchangePasswordResetOtp({ phoneNumber, otp })
        return ok(c, { token })
      } catch (err) {
        if (!(err instanceof PasswordRecoveryError)) throw err
        if (err.code === 'TOO_MANY_ATTEMPTS') {
          return error(c, 'تعداد تلاش‌ها بیش از حد مجاز است', 403, err.code)
        }
        return error(c, 'کد تایید نامعتبر یا منقضی شده است', 400, err.code)
      }
    },
  )
  .post('/phone-status', zValidator('json', phoneStatusSchema), async (c) => {
    const { phone } = c.req.valid('json')
    const rows = await getDb()
      .select({ id: user.id })
      .from(user)
      .where(or(eq(user.phoneNumber, phone), eq(user.username, phone)))
      .limit(1)

    return ok(c, {
      registered: Boolean(rows[0]),
      otpLoginEnabled: isAuthOtpLoginEnabled(),
    })
  })
  .post(
    '/signup/account',
    zValidator('json', preWorkspaceAccountSchema),
    async (c) => {
      const sessionUser = await getSessionUser(c)
      if (!sessionUser) return error(c, 'وارد نشده‌اید', 401)

      const { managerName, password } = c.req.valid('json')
      const userHasPassword = await hasCredentialPassword(sessionUser.id)
      if (!userHasPassword && !password) {
        return error(c, 'رمز عبور الزامی است', 400)
      }

      if (!userHasPassword && password) {
        try {
          await auth.api.setPassword({
            body: { newPassword: password },
            headers: c.req.raw.headers,
          })
        } catch (err) {
          const code = getBetterAuthErrorCode(err)
          if (code === 'PASSWORD_ALREADY_SET') {
            // The account table is the source we can query, but Better Auth may
            // still report an already-set password for older or concurrent
            // sessions. Treat that as an idempotent account-completion state.
          } else if (code === 'PASSWORD_TOO_SHORT') {
            return error(c, 'رمز عبور باید حداقل ۸ کاراکتر باشد', 400, code)
          } else {
            throw err
          }
        }
      }

      await getDb()
        .update(user)
        .set({ name: managerName, updatedAt: new Date() })
        .where(eq(user.id, sessionUser.id))

      return ok(c, {
        user: {
          id: sessionUser.id,
          name: managerName,
          phone: sessionUser.phoneNumber ?? sessionUser.username ?? '',
        },
      })
    },
  )
  .post(
    '/signup/workspace',
    zValidator('json', preWorkspaceSchema),
    async (c) => {
      const sessionUser = await getSessionUser(c)
      if (!sessionUser) return error(c, 'وارد نشده‌اید', 401)

      const db = getDb()
      const existingMember = await getMemberForUser(sessionUser.id)
      if (existingMember) {
        const existingOrg = await getOrganizationById(
          db,
          existingMember.organizationId,
        )
        if (!existingOrg) return error(c, 'سالن یافت نشد', 404)
        return ok(c, {
          salon: existingOrg,
          user: {
            id: sessionUser.id,
            name: existingMember.name,
            phone: existingMember.username,
          },
          redirectTo: '/onboarding',
        })
      }

      const { salonName, slug: requestedSlug } = c.req.valid('json')
      let slug: string
      if (requestedSlug) {
        const existingSlug = await db
          .select({ id: organization.id })
          .from(organization)
          .where(eq(organization.slug, requestedSlug))
          .limit(1)
        if (existingSlug[0]) {
          return error(c, 'این آدرس سالن قبلاً ثبت شده است', 409)
        }
        slug = requestedSlug
      } else {
        slug = await generateUniqueSlug(db)
      }

      let orgId: string
      try {
        const createdOrg = await auth.api.createOrganization({
          body: { name: salonName, slug, userId: sessionUser.id },
        })
        if (!createdOrg) throw new Error('createOrganization returned empty')
        orgId = createdOrg.id
      } catch (err) {
        if (isConflict(err)) {
          return error(c, 'این آدرس سالن قبلاً ثبت شده است', 409)
        }
        throw err
      }

      await createWorkspaceSidecars({
        db,
        userId: sessionUser.id,
        orgId,
        managerName: sessionUser.name,
      })

      return ok(c, {
        salon: { id: orgId, name: salonName, slug },
        user: {
          id: sessionUser.id,
          name: sessionUser.name,
          phone: sessionUser.phoneNumber ?? sessionUser.username ?? '',
        },
        redirectTo: '/onboarding',
      })
    },
  )
  .post('/signup', zValidator('json', signupSchema), async (c) => {
    const {
      salonName,
      slug: requestedSlug,
      managerName,
      managerPhone,
      password,
    } = c.req.valid('json')
    const db = getDb()

    let slug: string
    if (requestedSlug) {
      // A client-chosen slug must be free before we create the user, so a clash
      // can't leave an orphaned user with no organization behind.
      const existingSlug = await db
        .select({ id: organization.id })
        .from(organization)
        .where(eq(organization.slug, requestedSlug))
        .limit(1)
      if (existingSlug[0]) {
        return error(c, 'این آدرس سالن قبلاً ثبت شده است', 409)
      }
      slug = requestedSlug
    } else {
      slug = await generateUniqueSlug(db)
    }

    let signUpRes: Response
    try {
      signUpRes = await auth.api.signUpEmail({
        body: {
          email: phoneToEmail(managerPhone),
          password,
          name: managerName,
          username: managerPhone,
        },
        asResponse: true,
      })
    } catch (err) {
      if (isConflict(err)) {
        return error(c, 'این شماره موبایل قبلاً ثبت شده است', 409)
      }
      throw err
    }
    if (!signUpRes.ok) {
      if (signUpRes.status === 409 || signUpRes.status === 422) {
        return error(c, 'این شماره موبایل قبلاً ثبت شده است', 409)
      }
      return error(c, 'ثبت‌نام ناموفق بود', 400)
    }
    const signUpBody = (await signUpRes.json()) as {
      user: { id: string }
    }
    const userId = signUpBody.user.id
    await db
      .update(user)
      .set({
        phoneNumber: managerPhone,
        phoneNumberVerified: true,
        displayUsername: managerPhone,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId))

    let orgId: string
    try {
      const createdOrg = await auth.api.createOrganization({
        body: { name: salonName, slug, userId },
      })
      if (!createdOrg) throw new Error('createOrganization returned empty')
      orgId = createdOrg.id
    } catch (err) {
      if (isConflict(err)) {
        return error(c, 'این آدرس سالن قبلاً ثبت شده است', 409)
      }
      throw err
    }

    await db.transaction(async (tx) => {
      await tx.insert(salonProfile).values({ organizationId: orgId })
      await tx.insert(salonMember).values({
        userId,
        organizationId: orgId,
        displayName: managerName,
        color: OWNER_COLOR,
        active: true,
      })
      await tx.insert(businessSettings).values({
        salonId: orgId,
        workingStart: '09:00',
        workingEnd: '19:00',
        slotDurationMinutes: 30,
      })
    })

    forwardSetCookie(c, signUpRes.headers)
    return ok(c, {
      salon: { id: orgId, name: salonName, slug },
      user: { id: userId, name: managerName, phone: managerPhone },
      redirectTo: '/onboarding',
    })
  })

export type AuthRoute = typeof authRoute
