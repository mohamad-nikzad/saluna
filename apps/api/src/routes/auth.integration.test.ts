import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { Hono } from 'hono'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// This suite creates its own local database and never reads the configured URL.
describe.skipIf(process.env.RUN_DATABASE_INTEGRATION !== '1')(
  'first-time staff authentication',
  () => {
    const databaseName = `saluna_auth_test_${process.pid}_${Date.now()}`
    const admin = postgres(
      'postgres://postgres:postgres@127.0.0.1:5432/postgres',
      { max: 1 },
    )
    const url = `postgres://postgres:postgres@127.0.0.1:5432/${databaseName}`
    const sql = postgres(url, { max: 1 })
    const ownerId = randomUUID()
    const salonId = randomUUID()
    let created = false
    let app: Hono
    let clientIp = '10.0.0.1'

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
        'local-auth-test-secret-at-least-32-characters'
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
      await sql`insert into member (id,user_id,organization_id,role) values (${randomUUID()},${ownerId},${salonId},'owner')`
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

    async function request(
      path: string,
      body?: unknown,
      cookie?: string,
      selectedSalonId?: string,
    ) {
      return app.request(`http://localhost:3000/api/v1/auth${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
          'x-forwarded-for': clientIp,
          ...(cookie ? { Cookie: cookie } : {}),
          ...(selectedSalonId ? { 'X-Saluna-Salon-Id': selectedSalonId } : {}),
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

    it('lets passwordless staff verify and enter their two accepted salons without accepting invitations again', async () => {
      const phone = '09121234565'
      clientIp = '10.0.0.5'
      const userId = randomUUID()
      const secondSalonId = randomUUID()
      const firstProfileId = randomUUID()
      const secondProfileId = randomUUID()
      await sql`insert into "user" (id,name,email,phone_number,phone_number_verified) values (${userId},'Staff',${`${phone}@example.test`},${phone},true)`
      await sql`insert into organization (id,name,slug) values (${secondSalonId},'سالن دوم',${secondSalonId})`
      await sql`insert into salon_profile (organization_id,status) values (${secondSalonId},'active')`
      const { acceptStaffInvite } = await import('@repo/database/staff')
      for (const [acceptedSalonId, profileId] of [
        [salonId, firstProfileId],
        [secondSalonId, secondProfileId],
      ] as const) {
        const inviteId = randomUUID()
        await sql`insert into staff_profiles (id,salon_id,name,phone,color) values (${profileId},${acceptedSalonId},'هستی',${phone},'rose')`
        await sql`insert into staff_invites (id,salon_id,staff_profile_id,phone,status,token_hash,invited_by_user_id,expires_at) values (${inviteId},${acceptedSalonId},${profileId},${phone},'pending',${randomUUID()},${ownerId},${new Date(Date.now() + 86400000).toISOString()})`
        const accepted = await acceptStaffInvite({ userId, inviteId })
        if (accepted.status !== 'accepted')
          throw new Error('fixture invitation acceptance failed')
      }

      expect(
        (await request('/phone-number/send-otp', { phoneNumber: phone }))
          .status,
      ).toBe(200)
      const verified = await request('/phone-number/verify', {
        phoneNumber: phone,
        code: '123456',
      })
      expect(verified.status).toBe(200)
      expect(await verified.json()).toMatchObject({ user: { id: userId } })
      const cookie = cookies(verified)
      expect(
        await (await request('/me', undefined, cookie)).json(),
      ).toMatchObject({
        status: 'needs_staff_password',
        user: { id: userId },
      })
      expect(
        (
          await request(
            '/staff-claim/password',
            { password: 'secret123' },
            cookie,
          )
        ).status,
      ).toBe(200)
      expect(
        await (await request('/staff-invites', undefined, cookie)).json(),
      ).toMatchObject({ invites: [] })
      const expectedSalons = [
        { salonId, salonName: 'آراویرا', staffProfileId: firstProfileId },
        {
          salonId: secondSalonId,
          salonName: 'سالن دوم',
          staffProfileId: secondProfileId,
        },
      ]
      const me = await (await request('/me', undefined, cookie)).json()
      expect(me).toMatchObject({
        status: 'needs_salon_selection',
        user: { id: userId },
      })
      expect(me.salons).toHaveLength(2)
      expect(me.salons).toEqual(expect.arrayContaining(expectedSalons))
      for (const accepted of expectedSalons) {
        expect(
          await (
            await request('/me', undefined, cookie, accepted.salonId)
          ).json(),
        ).toMatchObject({
          status: 'ready',
          user: { id: userId, role: 'staff', ...accepted },
        })
      }
    }, 15000)

    it.each(['new', 'existing', 'accepted', 'expired'] as const)(
      'verifies the %s identity, preserves its Staff Profile, and establishes its own password',
      async (kind) => {
        const phone = {
          new: '09121234561',
          existing: '09121234562',
          accepted: '09121234563',
          expired: '09121234564',
        }[kind]
        clientIp = `10.0.0.${phone.slice(-1)}`
        const existingId = randomUUID()
        const profileId = randomUUID()
        const inviteId = randomUUID()
        if (kind !== 'new')
          await sql`insert into "user" (id,name,email,phone_number,phone_number_verified) values (${existingId},'Staff',${`${phone}@example.test`},${phone},${kind === 'accepted'})`
        await sql`insert into staff_profiles (id,salon_id,name,phone,color) values (${profileId},${salonId},'هستی',${phone},'rose')`
        await sql`insert into staff_invites (id,salon_id,staff_profile_id,phone,status,token_hash,invited_by_user_id,expires_at) values (${inviteId},${salonId},${profileId},${phone},'pending',${randomUUID()},${ownerId},${new Date(Date.now() + (kind === 'expired' ? -86400000 : 86400000)).toISOString()})`
        if (kind === 'accepted') {
          const { acceptStaffInvite } = await import('@repo/database/staff')
          const accepted = await acceptStaffInvite({
            userId: existingId,
            inviteId,
          })
          if (accepted.status !== 'accepted')
            throw new Error('fixture invitation acceptance failed')
        }
        const status = await request('/phone-status', { phone })
        expect(await status.json()).toMatchObject({
          registered: kind !== 'new',
          hasPassword: false,
          otpLoginEnabled: false,
        })
        expect(
          (await request('/phone-number/send-otp', { phoneNumber: phone }))
            .status,
        ).toBe(200)
        const verified = await request('/phone-number/verify', {
          phoneNumber: phone,
          code: '123456',
        })
        expect(verified.status).toBe(200)
        const verifiedBody = await verified.json()
        const userId = verifiedBody.user.id
        if (kind !== 'new') expect(userId).toBe(existingId)
        const cookie = cookies(verified)
        const me = await request('/me', undefined, cookie)
        expect(await me.json()).toMatchObject({
          status: 'needs_staff_password',
          user: { id: userId },
        })
        expect(
          (
            await request(
              '/staff-claim/password',
              { password: 'secret123' },
              cookie,
            )
          ).status,
        ).toBe(200)
        const invitations = await request('/staff-invites', undefined, cookie)
        const invites = (await invitations.json()).invites
        if (kind === 'accepted') {
          expect(invites).toEqual([])
        } else {
          expect(invites).toMatchObject([
            { id: inviteId, salonName: 'آراویرا', staffName: 'هستی' },
          ])
          expect(
            await sql`select id from staff_profile_accesses where user_id = ${userId}`,
          ).toHaveLength(0)
          if (kind === 'expired') {
            const expired = await request(
              `/staff-invites/${inviteId}/accept`,
              {},
              cookie,
            )
            expect(expired.status).toBe(409)
            const { resendManagerStaffInvite } =
              await import('@repo/database/staff')
            expect(
              await resendManagerStaffInvite({
                salonId,
                staffProfileId: profileId,
              }),
            ).toMatchObject({ status: 'resent' })
            const renewed = (
              await (await request('/staff-invites', undefined, cookie)).json()
            ).invites[0]
            expect(
              (await request(`/staff-invites/${renewed.id}/accept`, {}, cookie))
                .status,
            ).toBe(200)
          } else {
            expect(
              (await request(`/staff-invites/${inviteId}/accept`, {}, cookie))
                .status,
            ).toBe(200)
          }
        }
        expect(
          await (await request('/me', undefined, cookie)).json(),
        ).toMatchObject({
          status: 'ready',
          user: {
            id: userId,
            salonId,
            staffProfileId: profileId,
            role: 'staff',
          },
        })
        expect(
          await sql`select id from "user" where phone_number = ${phone}`,
        ).toHaveLength(1)
        expect(
          await sql`select id,name from staff_profiles where id = ${profileId}`,
        ).toEqual([{ id: profileId, name: 'هستی' }])
        expect(
          (await request('/phone-number/send-otp', { phoneNumber: phone }))
            .status,
        ).toBe(403)
        expect(
          (
            await request('/phone-number/verify', {
              phoneNumber: phone,
              code: '123456',
            })
          ).status,
        ).toBe(403)
        expect(
          (
            await request('/sign-in/phone-number', {
              phoneNumber: phone,
              password: 'secret123',
            })
          ).status,
        ).toBe(200)
        if (kind === 'existing') {
          expect(
            (
              await request('/phone-number/request-password-reset', {
                phoneNumber: phone,
              })
            ).status,
          ).toBe(200)
          const reset = await request(
            '/phone-number/verify-password-reset-otp',
            { phoneNumber: phone, otp: '123456' },
          )
          expect(reset.status).toBe(200)
          const { token } = await reset.json()
          expect(
            (
              await request('/reset-password', {
                token,
                newPassword: 'changed123',
              })
            ).status,
          ).toBe(200)
          const login = await request('/sign-in/phone-number', {
            phoneNumber: phone,
            password: 'changed123',
          })
          expect(login.status).toBe(200)
          expect(
            await (await request('/me', undefined, cookies(login))).json(),
          ).toMatchObject({
            status: 'ready',
            user: { id: userId, role: 'staff' },
          })
        }
      },
      15000,
    )
  },
)
