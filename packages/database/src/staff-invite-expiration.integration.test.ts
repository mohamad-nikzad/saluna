import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  listUnacceptedStaffInvitesForUser,
  acceptStaffInvite,
} from './staff-invite-acceptance'
import { getAllStaff } from './internal/staff-queries'
import { getUserById } from './internal/user-queries'
import {
  resendManagerStaffInvite,
  cancelManagerStaffInvite,
} from './staff-invites'

const databaseName = `saluna_invite_test_${process.pid}_${Date.now()}`
const admin = postgres('postgres://postgres:postgres@127.0.0.1:5432/postgres', {
  max: 1,
})
const url = `postgres://postgres:postgres@127.0.0.1:5432/${databaseName}`
const sql = postgres(url, { max: 1 })
const userId = randomUUID()
const salonId = randomUUID()
const profileId = randomUUID()
const inviteId = randomUUID()
let created = false

// Always use a disposable local database, never the configured production URL.
describe.skipIf(process.env.RUN_DATABASE_INTEGRATION !== '1')(
  'expired staff invitations',
  () => {
    beforeAll(async () => {
      await admin`create database ${admin(databaseName)}`
      created = true
      await migrate(drizzle(sql), {
        migrationsFolder: fileURLToPath(
          new URL('./migrations', import.meta.url),
        ),
      })
      process.env.DATABASE_URL = url
      await sql`insert into "user" (id,name,email,phone_number,phone_number_verified) values (${userId},'Staff','staff@example.test','09121234567',true)`
      await sql`insert into organization (id,name,slug) values (${salonId},'Test salon',${salonId})`
      await sql`insert into staff_profiles (id,salon_id,name,phone,color) values (${profileId},${salonId},'Staff','09121234567','pink')`
      await sql`insert into staff_invites (id,salon_id,staff_profile_id,phone,status,token_hash,invited_by_user_id,expires_at) values (${inviteId},${salonId},${profileId},'09121234567','pending','old-token',${userId},now() - interval '1 day')`
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

    it('keeps overdue and explicitly expired invitations visible, renews them, and grants access only after acceptance', async () => {
      expect(await listUnacceptedStaffInvitesForUser(userId)).toMatchObject([
        { id: inviteId, status: 'pending' },
      ])
      expect(await acceptStaffInvite({ userId, inviteId })).toEqual({
        status: 'rejected',
        reason: 'invite_expired',
      })
      expect(await listUnacceptedStaffInvitesForUser(userId)).toMatchObject([
        { id: inviteId, status: 'expired' },
      ])
      expect(await getAllStaff(salonId)).toMatchObject([
        { id: profileId, inviteStatus: 'expired' },
      ])
      expect(await getUserById(profileId)).toMatchObject({
        inviteStatus: 'expired',
      })
      const renewed = await resendManagerStaffInvite({
        salonId,
        staffProfileId: profileId,
      })
      expect(renewed.status).toBe('resent')
      if (renewed.status !== 'resent') throw new Error('renewal failed')
      expect(renewed.invite.status).toBe('pending')
      expect(await getAllStaff(salonId)).toMatchObject([
        { id: profileId, inviteStatus: 'pending' },
      ])
      expect(renewed.invite.expiredAt).toBeNull()
      expect(renewed.invite.expiresAt.getTime()).toBeGreaterThan(Date.now())
      expect(renewed.invite.tokenHash).not.toBe('old-token')
      expect(await sql`select * from staff_profile_accesses`).toHaveLength(0)
      expect((await acceptStaffInvite({ userId, inviteId })).status).toBe(
        'accepted',
      )
      expect(await listUnacceptedStaffInvitesForUser(userId)).toEqual([])
      expect(
        await sql`select * from staff_profile_accesses where user_id=${userId} and revoked_at is null`,
      ).toHaveLength(1)
    })

    it('hides invitations for other phones, unverified identities, inactive profiles and closed invitations', async () => {
      await sql`update staff_profiles set user_id=null,active=true where id=${profileId}`
      await sql`update staff_invites set status='expired' where id=${inviteId}`
      await sql`update "user" set phone_number_verified=false where id=${userId}`
      expect(await listUnacceptedStaffInvitesForUser(userId)).toEqual([])
      await sql`update "user" set phone_number_verified=true,phone_number='09129876543' where id=${userId}`
      expect(await listUnacceptedStaffInvitesForUser(userId)).toEqual([])
      await sql`update "user" set phone_number='09121234567' where id=${userId}`
      await sql`update staff_profiles set active=false where id=${profileId}`
      expect(await listUnacceptedStaffInvitesForUser(userId)).toEqual([])
      await sql`update staff_profiles set active=true where id=${profileId}`
      expect(
        (await cancelManagerStaffInvite({ salonId, staffProfileId: profileId }))
          .status,
      ).toBe('cancelled')
      expect(await listUnacceptedStaffInvitesForUser(userId)).toEqual([])
    })
  },
)
