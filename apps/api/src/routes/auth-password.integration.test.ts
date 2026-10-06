import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { Hono } from 'hono'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Own disposable database; never use the configured application database.
describe.skipIf(process.env.RUN_DATABASE_INTEGRATION !== '1')(
  'first-time password setup',
  () => {
    const databaseName = `saluna_password_test_${process.pid}_${Date.now()}`
    const admin = postgres(
      'postgres://postgres:postgres@127.0.0.1:5432/postgres',
      { max: 1 },
    )
    const url = `postgres://postgres:postgres@127.0.0.1:5432/${databaseName}`
    const sql = postgres(url, { max: 1 })
    const salonId = randomUUID()
    const ownerId = randomUUID()
    let created = false
    let app: Hono
    let nextPhone = 9121234570
    let nextRequest = 1

    beforeAll(async () => {
      await admin`create database ${admin(databaseName)}`
      created = true
      await migrate(drizzle(sql), {
        migrationsFolder: fileURLToPath(
          new URL(
            '../../../../packages/database/src/migrations',
            import.meta.url,
          ),
        ),
      })
      process.env.DATABASE_URL = url
      process.env.NODE_ENV = 'test'
      process.env.BETTER_AUTH_SECRET =
        'local-password-test-secret-at-least-32-characters'
      process.env.AUTH_OTP_BYPASS_ENABLED = 'true'
      process.env.AUTH_OTP_LOGIN_ENABLED = 'false'
      const { authRoute } = await import('./auth')
      const { auth } = await import('@repo/auth/server')
      app = new Hono()
        .route('/api/v1/auth', authRoute)
        .on(['GET', 'POST'], '/api/v1/auth/*', (c) => auth.handler(c.req.raw))
      await sql`insert into "user" (id,name,email) values (${ownerId},'Owner','owner@example.test')`
      await sql`insert into organization (id,name,slug) values (${salonId},'آراویرا',${salonId})`
      await sql`insert into salon_profile (organization_id,status) values (${salonId},'active')`
    }, 30000)

    afterAll(async () => {
      const globals = globalThis as typeof globalThis & {
        __salon_postgres?: ReturnType<typeof postgres>
        __salon_drizzle?: unknown
      }
      await globals.__salon_postgres?.end({ timeout: 5 })
      delete globals.__salon_postgres
      delete globals.__salon_drizzle
      await sql.end({ timeout: 5 })
      if (created)
        await admin`drop database ${admin(databaseName)} with (force)`
      await admin.end({ timeout: 5 })
    })

    function request(path: string, body?: unknown, cookie?: string) {
      return app.request(`http://localhost:3000/api/v1/auth${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
          'x-forwarded-for': `10.1.0.${nextRequest++}`,
          ...(cookie ? { Cookie: cookie } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
    }

    function cookies(response: Response) {
      return response.headers
        .getSetCookie()
        .map((cookie) => cookie.split(';')[0])
        .join('; ')
    }

    async function verifiedStaff(emptyCredential = false) {
      const phone = `0${nextPhone++}`
      const userId = randomUUID()
      const profileId = randomUUID()
      await sql`insert into "user" (id,name,email,phone_number,phone_number_verified) values (${userId},'Staff',${`${phone}@example.test`},${phone},true)`
      const inviteId = randomUUID()
      await sql`insert into staff_profiles (id,salon_id,name,phone,color) values (${profileId},${salonId},'هستی',${phone},'rose')`
      await sql`insert into staff_invites (id,salon_id,staff_profile_id,phone,status,token_hash,invited_by_user_id,expires_at) values (${inviteId},${salonId},${profileId},${phone},'pending',${randomUUID()},${ownerId},${new Date(Date.now() + 86400000).toISOString()})`
      const { acceptStaffInvite } = await import('@repo/database/staff')
      expect(await acceptStaffInvite({ userId, inviteId })).toMatchObject({
        status: 'accepted',
      })
      if (emptyCredential)
        await sql`insert into account (id,account_id,provider_id,user_id,password) values (${randomUUID()},${userId},'credential',${userId},null)`
      expect(
        (await request('/phone-number/send-otp', { phoneNumber: phone }))
          .status,
      ).toBe(200)
      const verified = await request('/phone-number/verify', {
        phoneNumber: phone,
        code: '123456',
      })
      expect(verified.status).toBe(200)
      return { phone, userId, cookie: cookies(verified) }
    }

    async function login(phone: string, password: string) {
      return request('/sign-in/phone-number', { phoneNumber: phone, password })
    }

    it.each(['/staff-claim/password', '/signup/account'])(
      '%s completes an empty credential so the verified identity can sign out and sign in again',
      async (path) => {
        const staff = await verifiedStaff(true)
        expect(
          (
            await request(
              path,
              { managerName: 'Staff', password: 'first123' },
              staff.cookie,
            )
          ).status,
        ).toBe(200)
        expect((await request('/sign-out', {}, staff.cookie)).status).toBe(200)
        const signedIn = await login(staff.phone, 'first123')
        expect(signedIn.status).toBe(200)
        expect(
          await (await request('/me', undefined, cookies(signedIn))).json(),
        ).toMatchObject({
          status: 'ready',
          user: { id: staff.userId, role: 'staff', salonId },
        })
      },
      15000,
    )

    it.each(['absent', 'empty'] as const)(
      'concurrent setup with an %s credential establishes one login method and preserves the winning password',
      async (credential) => {
        const staff = await verifiedStaff(credential === 'empty')
        const passwords = ['first123', 'other456']
        const results = await Promise.all(
          passwords.map((password) =>
            request('/staff-claim/password', { password }, staff.cookie),
          ),
        )
        expect(results.map((response) => response.status)).toEqual([200, 200])
        const linked = await request('/list-accounts', undefined, staff.cookie)
        expect(linked.status).toBe(200)
        const methods = (await linked.json()) as { providerId: string }[]
        expect(
          methods.filter((method) => method.providerId === 'credential'),
        ).toHaveLength(1)
        expect((await request('/sign-out', {}, staff.cookie)).status).toBe(200)
        const signedIn = await Promise.all(
          passwords.map((password) => login(staff.phone, password)),
        )
        expect(signedIn.map((response) => response.status).sort()).toEqual([
          200, 401,
        ])
        const winner = signedIn.findIndex((response) => response.status === 200)
        const winningCookie = cookies(signedIn[winner]!)
        expect(
          (
            await request(
              '/staff-claim/password',
              { password: 'replace789' },
              winningCookie,
            )
          ).status,
        ).toBe(200)
        expect((await request('/sign-out', {}, winningCookie)).status).toBe(200)
        expect((await login(staff.phone, passwords[winner]!)).status).toBe(200)
        expect((await login(staff.phone, 'replace789')).status).toBe(401)
      },
      15000,
    )

    it.each(['/staff-claim/password', '/signup/account'])(
      '%s keeps password limits when completing an empty credential',
      async (path) => {
        const staff = await verifiedStaff(true)
        expect(
          (
            await request(
              path,
              { managerName: 'Staff', password: 'short' },
              staff.cookie,
            )
          ).status,
        ).toBe(400)
        const tooLong = await request(
          path,
          { managerName: 'Staff', password: 'a'.repeat(129) },
          staff.cookie,
        )
        expect(tooLong.status).toBe(400)
        expect(await tooLong.json()).toMatchObject({
          code: 'PASSWORD_TOO_LONG',
        })
        expect(
          await (await request('/phone-status', { phone: staff.phone })).json(),
        ).toMatchObject({ hasPassword: false })
        expect(
          (
            await request(
              path,
              { managerName: 'Staff', password: 'a'.repeat(128) },
              staff.cookie,
            )
          ).status,
        ).toBe(200)
        expect((await request('/sign-out', {}, staff.cookie)).status).toBe(200)
        expect((await login(staff.phone, 'a'.repeat(128))).status).toBe(200)
      },
      15000,
    )

    it.each(['/staff-claim/password', '/signup/account'])(
      '%s rejects password setup from a signed-out session with cached cookies',
      async (path) => {
        const staff = await verifiedStaff(true)
        expect((await request('/sign-out', {}, staff.cookie)).status).toBe(200)
        const setup = await request(
          path,
          { managerName: 'Staff', password: 'first123' },
          staff.cookie,
        )
        expect(setup.status).toBe(401)
        expect(await setup.json()).toMatchObject({ code: 'UNAUTHORIZED' })
        expect(
          await (await request('/phone-status', { phone: staff.phone })).json(),
        ).toMatchObject({ hasPassword: false })
        expect((await login(staff.phone, 'first123')).status).toBe(401)
      },
      15000,
    )
  },
)
