import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { Hono } from 'hono'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { addDaysYmd, salonTodayYmd } from '@repo/salon-core/salon-local-time'
import { repairStaffIdentities } from '../../../../packages/database/src/staff-identity-repair'

// Real auth middleware, persisted sessions/access, intake, queries, and status writes.
describe.skipIf(process.env.RUN_DATABASE_INTEGRATION !== '1')(
  'Staff Profile appointment ownership',
  () => {
    const databaseName = `saluna_staff_identity_${process.pid}_${Date.now()}`
    const admin = postgres(
      'postgres://postgres:postgres@127.0.0.1:5432/postgres',
      { max: 1 },
    )
    const sql = postgres(
      `postgres://postgres:postgres@127.0.0.1:5432/${databaseName}`,
      { max: 1 },
    )
    const manager = randomUUID(),
      identity = randomUUID(),
      outsider = randomUUID()
    const salon = randomUUID(),
      otherSalon = randomUUID(),
      client = randomUUID(),
      category = randomUUID(),
      service = randomUUID()
    const date = addDaysYmd(salonTodayYmd(), 1)
    const managerToken = randomUUID(),
      staffToken = randomUUID(),
      outsiderToken = randomUUID()
    let app: Hono
    let created = false
    let profile: string, otherProfile: string, pre: string, post: string

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
      process.env.DATABASE_URL = `postgres://postgres:postgres@127.0.0.1:5432/${databaseName}`
      process.env.DATABASE_URL_DIRECT = process.env.DATABASE_URL
      process.env.NODE_ENV = 'test'
      process.env.BETTER_AUTH_SECRET =
        'staff-identity-integration-secret-32-characters'
      await sql`insert into "user" (id, name, email, phone_number, phone_number_verified) values
      (${manager}, 'Manager', 'manager@test.local', '09120000001', true),
      (${identity}, 'Staff login', 'staff@test.local', '09120000002', true),
      (${outsider}, 'Unassigned', 'other@test.local', '09120000003', true)`
      await sql`insert into organization (id, name, slug) values (${salon}, 'Salon', ${salon}), (${otherSalon}, 'Other salon', ${otherSalon})`
      await sql`insert into salon_profile (organization_id, status) values (${salon}, 'active'), (${otherSalon}, 'active')`
      await sql`insert into member (id, organization_id, user_id, role) values (${randomUUID()}, ${salon}, ${manager}, 'owner'), (${randomUUID()}, ${otherSalon}, ${manager}, 'admin')`
      await sql`insert into business_settings (salon_id, working_days) values (${salon}, 127), (${otherSalon}, 127)`
      await sql`insert into service_categories (id, salon_id, name) values (${category}, ${salon}, 'Hair')`
      await sql`insert into services (id, salon_id, category_id, name, duration, price, color, allow_multiple_staff) values (${service}, ${salon}, ${category}, 'Service', 30, 100, 'rose', true)`
      await sql`insert into clients (id, salon_id, name, phone, notes) values (${client}, ${salon}, 'Client', '09121111111', 'private notes')`
      for (const [id, token] of [
        [manager, managerToken],
        [identity, staffToken],
        [outsider, outsiderToken],
      ]) {
        await sql`insert into session (id, user_id, token, expires_at) values (${randomUUID()}, ${id!}, ${token!}, now() + interval '1 day')`
      }
      await repairStaffIdentities(sql, {
        apply: true,
        saveRecovery: async () => {},
      })
      const { staff } = await import('./staff')
      const { appointments } = await import('./appointments')
      const { today } = await import('./today')
      const { authRoute } = await import('./auth')
      const { appointmentRequestsRoute } =
        await import('./appointment-requests')
      app = new Hono()
        .route('/auth', authRoute)
        .route('/staff', staff)
        .route('/appointments', appointments)
        .route('/today', today)
        .route('/appointment-requests', appointmentRequestsRoute)
    }, 30000)

    afterAll(async () => {
      const g = globalThis as typeof globalThis & {
        __salon_postgres?: ReturnType<typeof postgres>
        __salon_drizzle?: unknown
      }
      await g.__salon_postgres?.end({ timeout: 5 })
      delete g.__salon_postgres
      delete g.__salon_drizzle
      await sql.end({ timeout: 5 })
      if (created)
        await admin`drop database ${admin(databaseName)} with (force)`
      await admin.end({ timeout: 5 })
    })

    async function request(
      path: string,
      token = managerToken,
      body?: unknown,
      method = body ? 'POST' : 'GET',
      salonId = salon,
    ) {
      return app.request(`http://localhost:3000${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Saluna-Salon-Id': salonId,
          'Content-Type': 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
    }
    async function book(staffId: string, startTime: string, extra?: string) {
      return request('/appointments', managerToken, {
        clientId: client,
        serviceId: service,
        date,
        startTime,
        staffAssignments: [
          {
            staffId,
            isLead: true,
            allocationBasisPoints: extra ? 6000 : 10000,
          },
          ...(extra
            ? [{ staffId: extra, isLead: false, allocationBasisPoints: 4000 }]
            : []),
        ],
      })
    }

    it('keeps pre-acceptance ownership and creates visible appointments after acceptance', async () => {
      const inviteResponse = await request('/staff', managerToken, {
        name: 'Salon staff',
        phone: '09120000002',
        role: 'staff',
      })
      expect(inviteResponse.status).toBe(200)
      const invite = await inviteResponse.json()
      profile = invite.user.id
      expect(profile).not.toBe(identity)
      await request(
        `/staff/${profile}/services`,
        managerToken,
        { serviceIds: [service] },
        'PATCH',
      )
      expect(
        (
          await request(
            `/staff/${profile}/schedule`,
            managerToken,
            {
              schedule: Array.from({ length: 7 }, (_, dayOfWeek) => ({
                dayOfWeek,
                active: true,
                workingStart: '09:00',
                workingEnd: '17:00',
              })),
            },
            'PUT',
          )
        ).status,
      ).toBe(200)
      const schedules =
        await sql`select * from staff_schedules where staff_id = ${profile} order by id`
      const before = await book(profile, '10:00')
      expect(before.status).toBe(200)
      pre = (await before.json()).appointment.id
      const { acceptStaffInvite } = await import('@repo/database/staff')
      expect(
        (
          await acceptStaffInvite({
            inviteId: invite.invite.id,
            userId: identity,
          })
        ).status,
      ).toBe('accepted')
      await sql`insert into account (id, user_id, account_id, provider_id, password)
        values (${randomUUID()}, ${identity}, ${identity}, 'credential', 'existing-password-hash')`
      const me = await request('/auth/me', staffToken)
      expect(me.status).toBe(200)
      expect(await me.json()).toMatchObject({
        status: 'ready',
        user: { id: identity, staffProfileId: profile },
      })
      const managerMe = await request('/auth/me')
      expect(managerMe.status).toBe(200)
      expect(await managerMe.json()).toMatchObject({
        status: 'ready',
        user: { id: manager, salonId: salon, role: 'manager' },
      })
      expect(
        await sql`select * from staff_schedules where staff_id = ${profile} order by id`,
      ).toEqual(schedules)
      expect((await book(profile, '18:00')).status).toBe(409)
      const after = await book(profile, '11:00')
      expect(after.status).toBe(200)
      post = (await after.json()).appointment.id
      expect(
        (
          await sql`select distinct staff_id from appointment_staff_assignments`
        ).map((r) => r.staff_id),
      ).toEqual([profile])
      const directory = await (await request('/staff')).json()
      expect(
        directory.staff.find((s: { id: string }) => s.id === profile),
      ).toMatchObject({ loginUserId: identity, serviceIds: [service] })
      for (const path of [
        `/appointments?startDate=${date}&endDate=${date}`,
        `/today?date=${date}`,
      ]) {
        const response = await request(path, staffToken)
        expect(response.status).toBe(200)
        expect(
          (await response.json()).appointments
            .map((a: { id: string }) => a.id)
            .sort(),
        ).toEqual([pre, post].sort())
      }
      const detail = await (
        await request(`/appointments/${post}`, staffToken)
      ).json()
      expect(detail.appointment.staff.id).toBe(profile)
      expect(detail.appointment.client.phone).toBeUndefined()
      expect(detail.appointment.client.notes).toBeUndefined()
      expect(
        (
          await request(
            `/appointments/${post}`,
            staffToken,
            { status: 'confirmed' },
            'PATCH',
          )
        ).status,
      ).toBe(200)
      expect((await book(identity, '12:00')).status).toBe(404)
      const { resolveStaffNotificationRecipient } =
        await import('@repo/database/staff')
      expect(
        await resolveStaffNotificationRecipient({
          salonId: salon,
          staffId: profile,
        }),
      ).toMatchObject({ userId: identity, staffProfileId: profile })
    })

    it('uses profile IDs for managers, extra assignments, requests, packages, and commissions', async () => {
      const [managerProfile] =
        await sql`select id from staff_profiles where salon_id = ${salon} and user_id = ${manager}`
      expect(managerProfile!.id).not.toBe(manager)
      expect(
        (
          await request(
            `/staff/${managerProfile!.id}`,
            managerToken,
            undefined,
            'DELETE',
          )
        ).status,
      ).toBe(400)
      expect(
        (
          await request(
            `/staff/${managerProfile!.id}/access/revoke`,
            managerToken,
            {},
          )
        ).status,
      ).toBe(400)
      const multi = await book(profile, '12:00', managerProfile!.id)
      expect(multi.status).toBe(200)
      const multiAppointment = (await multi.json()).appointment
      expect(
        multiAppointment.staffAssignments.map(
          (r: { staffId: string }) => r.staffId,
        ),
      ).toEqual([profile, managerProfile!.id])
      expect((await book(profile, '12:15')).status).toBe(409)
      const requestId = randomUUID()
      await sql`insert into appointment_requests (id, salon_id, service_id, client_id, staff_id,
        requested_date, requested_start_time, requested_end_time, customer_name, customer_phone,
        booked_service_name, booked_service_duration, booked_service_price)
        values (${requestId}, ${salon}, ${service}, ${client}, ${profile}, ${date}, '13:00', '13:30',
        'Client', '09121111111', 'Service', 30, 100)`
      const approved = await request(
        `/appointment-requests/${requestId}/approve`,
        managerToken,
        {},
      )
      expect(approved.status).toBe(200)
      const approvedId = (await approved.json()).appointmentId
      expect(
        (
          await sql`select staff_id from appointment_staff_assignments where appointment_id = ${approvedId}`
        )[0]?.staff_id,
      ).toBe(profile)
      const services = await import('@repo/database/services')
      const pkg = await services.createServicePackage({
        salonId: salon,
        name: 'Package',
        active: true,
      })
      const withComponents = await services.replaceServicePackageComponents(
        pkg.id,
        salon,
        [service],
      )
      await services.replaceServicePackageStaffCapabilities(pkg.id, salon, [
        profile,
        managerProfile!.id,
      ])
      await expect(
        services.replaceServicePackageStaffCapabilities(pkg.id, salon, [
          identity,
        ]),
      ).rejects.toThrow('staff not found')
      const booking = await services.createServicePackageBooking({
        salonId: salon,
        packageId: pkg.id,
        clientId: client,
        date,
        tasks: [
          {
            packageComponentId: withComponents.components[0]!.id,
            staffId: profile,
            startTime: '14:00',
            endTime: '14:30',
          },
        ],
      })
      expect(booking.leadStaffId).toBe(profile)
      expect(booking.tasks[0]?.staffId).toBe(profile)
      await sql`insert into commission_agreements (salon_id, staff_profile_id, percentage_basis_points, activated_at)
        values (${salon}, ${profile}, 5000, now())`
      expect(
        (
          await request(
            `/appointments/${post}`,
            staffToken,
            { status: 'completed' },
            'PATCH',
          )
        ).status,
      ).toBe(200)
      expect(
        (
          await sql`select staff_profile_id, amount from staff_commissions where appointment_id = ${post}`
        )[0],
      ).toMatchObject({ staff_profile_id: profile, amount: 50 })
      await sql`delete from service_package_bookings where id = ${booking.id}`
      await sql`delete from appointments where id in (${multiAppointment.id}, ${approvedId}, ${booking.tasks[0]!.appointmentId})`
    })

    it('isolates two salons and rejects unassigned staff', async () => {
      const { createManagerStaffInvite, acceptStaffInvite } =
        await import('@repo/database/staff')
      const invite = await createManagerStaffInvite({
        salonId: otherSalon,
        name: 'Other profile',
        phone: '09120000002',
        invitedByUserId: manager,
      })
      if (invite.status !== 'created') throw new Error('invite rejected')
      otherProfile = invite.profile.id
      expect(
        (
          await acceptStaffInvite({
            inviteId: invite.invite.id,
            userId: identity,
          })
        ).status,
      ).toBe('accepted')
      const unassigned = await createManagerStaffInvite({
        salonId: salon,
        name: 'Unassigned',
        phone: '09120000003',
        invitedByUserId: manager,
      })
      if (unassigned.status !== 'created') throw new Error('invite rejected')
      await acceptStaffInvite({
        inviteId: unassigned.invite.id,
        userId: outsider,
      })
      expect(
        (await request(`/appointments/${post}`, outsiderToken)).status,
      ).toBe(403)
      expect(
        (
          await request(
            `/appointments/${post}`,
            outsiderToken,
            { status: 'completed' },
            'PATCH',
          )
        ).status,
      ).toBe(403)
      expect(
        (
          await request(
            `/appointments/${post}`,
            staffToken,
            undefined,
            'GET',
            otherSalon,
          )
        ).status,
      ).toBe(404)
      expect((await book(otherProfile, '12:00')).status).toBe(404)
    })

    it('revokes immediately, leaves history untouched, and restores only the accepted profile', async () => {
      const before =
        await sql`select * from appointment_staff_assignments order by id`
      expect(
        (
          await request(
            `/staff/${profile}/access/revoke`,
            managerToken,
            {},
            'POST',
          )
        ).status,
      ).toBe(200)
      expect((await request(`/appointments/${post}`, staffToken)).status).toBe(
        403,
      )
      expect(
        (
          await request(
            `/appointments/${post}`,
            staffToken,
            { status: 'completed' },
            'PATCH',
          )
        ).status,
      ).toBe(403)
      expect(
        await sql`select * from appointment_staff_assignments order by id`,
      ).toEqual(before)
      const {
        createManagerStaffInvite,
        acceptStaffInvite,
        leaveStaffProfileAccess,
      } = await import('@repo/database/staff')
      const invite = await createManagerStaffInvite({
        salonId: salon,
        name: 'Salon staff',
        phone: '09120000002',
        invitedByUserId: manager,
      })
      if (invite.status !== 'created') throw new Error('invite rejected')
      expect(invite.profile.id).toBe(profile)
      await acceptStaffInvite({ inviteId: invite.invite.id, userId: identity })
      expect((await request(`/appointments/${post}`, staffToken)).status).toBe(
        200,
      )
      expect(
        await sql`select * from appointment_staff_assignments order by id`,
      ).toEqual(before)
      expect(
        (await leaveStaffProfileAccess({ salonId: salon, userId: identity }))
          .status,
      ).toBe('revoked')
      expect((await request(`/appointments/${post}`, staffToken)).status).toBe(
        403,
      )
    })

    it('preserves history through departure, replacement access, deactivation, and reactivation', async () => {
      const replacement = randomUUID(),
        token = randomUUID()
      await sql`insert into "user" (id, name, email, phone_number, phone_number_verified)
        values (${replacement}, 'Replacement', 'replacement@test.local', '09120000004', true)`
      await sql`insert into session (user_id, token, expires_at) values (${replacement}, ${token}, now() + interval '1 day')`
      const before =
        await sql`select * from appointment_staff_assignments order by id`
      expect(
        (
          await request(
            `/staff/${profile}`,
            managerToken,
            {
              name: 'Salon staff',
              phone: '09120000004',
              nickname: null,
              role: 'staff',
            },
            'PATCH',
          )
        ).status,
      ).toBe(200)
      const {
        createManagerStaffInvite,
        acceptStaffInvite,
        resolveStaffNotificationRecipient,
      } = await import('@repo/database/staff')
      const accept = async () => {
        const invite = await createManagerStaffInvite({
          salonId: salon,
          name: 'Salon staff',
          phone: '09120000004',
          invitedByUserId: manager,
        })
        if (invite.status !== 'created') throw new Error('invite rejected')
        expect(invite.profile.id).toBe(profile)
        expect(
          (
            await acceptStaffInvite({
              inviteId: invite.invite.id,
              userId: replacement,
            })
          ).status,
        ).toBe('accepted')
      }
      await accept()
      expect((await request(`/appointments/${post}`, staffToken)).status).toBe(
        403,
      )
      expect((await request(`/appointments/${post}`, token)).status).toBe(200)
      expect(
        await resolveStaffNotificationRecipient({
          salonId: salon,
          staffId: profile,
        }),
      ).toMatchObject({ userId: replacement })
      expect(
        (await request(`/staff/${profile}`, managerToken, undefined, 'DELETE'))
          .status,
      ).toBe(200)
      expect((await request(`/appointments/${post}`, token)).status).toBe(403)
      expect((await request(`/appointments/${post}`)).status).toBe(200)
      expect(
        (await request(`/staff/${profile}/reactivate`, managerToken, {}))
          .status,
      ).toBe(200)
      expect((await request(`/appointments/${post}`, token)).status).toBe(403)
      await accept()
      expect((await request(`/appointments/${post}`, token)).status).toBe(200)
      expect(
        await sql`select * from appointment_staff_assignments order by id`,
      ).toEqual(before)
    })

    it('audits and repairs identity references without touching assignment IDs or commission snapshots; rerun is empty', async () => {
      await sql`update appointment_staff_assignments set staff_id = ${identity}, commission_excluded_at = now() where salon_id = ${salon} and staff_id = ${profile}`
      await sql`update staff_services set staff_user_id = ${identity} where salon_id = ${salon} and staff_user_id = ${profile}`
      const before =
        await sql`select * from appointment_staff_assignments order by id`
      const earnings = await sql`select * from staff_commissions order by id`
      const history =
        await sql`select * from appointment_status_history order by id`
      const audit = await repairStaffIdentities(sql)
      expect(audit.before.appointment_staff_assignments).toBe(2)
      expect(audit.applied).toBe(false)
      expect(
        await sql`select * from appointment_staff_assignments order by id`,
      ).toEqual(before)
      let saved = false
      const repair = await repairStaffIdentities(sql, {
        apply: true,
        saveRecovery: async (r) => {
          expect(r.recovery.length).toBeGreaterThan(0)
          saved = true
        },
      })
      expect(saved).toBe(true)
      expect(repair.after.appointment_staff_assignments).toBe(0)
      expect(
        (
          await sql`select * from appointment_staff_assignments order by id`
        ).map((r) => ({ ...r, staff_id: identity })),
      ).toEqual(before)
      expect(await sql`select * from staff_commissions order by id`).toEqual(
        earnings,
      )
      expect(
        await sql`select * from appointment_status_history order by id`,
      ).toEqual(history)
      const rerun = await repairStaffIdentities(sql, {
        apply: true,
        saveRecovery: async () => {},
      })
      expect(rerun.recovery).toEqual([])
      expect(rerun.profilesCreated).toEqual([])
      const foreignId = randomUUID()
      await sql`update appointment_staff_assignments set staff_id = ${foreignId} where appointment_id = ${pre}`
      expect((await repairStaffIdentities(sql)).unresolved).toContainEqual(
        expect.objectContaining({ salonId: salon, staffId: foreignId }),
      )
    })
    it('reports ambiguous and conflicting ownership and leaves those records untouched', async () => {
      const [outsiderProfile] =
        await sql`select id from staff_profiles where salon_id = ${salon} and user_id = ${outsider}`
      await sql`insert into staff_profile_accesses (salon_id, staff_profile_id, user_id, accepted_at, revoked_at)
        values (${salon}, ${outsiderProfile!.id}, ${identity}, now() - interval '2 days', now() - interval '1 day')`
      await sql`update appointment_staff_assignments set staff_id = ${identity} where appointment_id = ${post}`
      await sql`insert into staff_schedules (salon_id, staff_id, day_of_week, working_start, working_end)
        values (${salon}, ${outsider}, 1, '09:00', '17:00'), (${salon}, ${outsiderProfile!.id}, 1, '10:00', '18:00')`
      const before =
        await sql`select * from appointment_staff_assignments order by id`
      const schedules = await sql`select * from staff_schedules order by id`
      const result = await repairStaffIdentities(sql, {
        apply: true,
        saveRecovery: async () => {},
      })
      expect(result.unresolved).toContainEqual(
        expect.objectContaining({
          staffId: identity,
          reason: 'Ambiguous Staff Profile ownership',
        }),
      )
      expect(result.unresolved).toContainEqual(
        expect.objectContaining({
          staffId: outsider,
          reason: 'Conflicting staff_schedules destination',
        }),
      )
      expect(
        await sql`select * from appointment_staff_assignments order by id`,
      ).toEqual(before)
      expect(await sql`select * from staff_schedules order by id`).toEqual(
        schedules,
      )
      await expect(repairStaffIdentities(sql, { apply: true })).rejects.toThrow(
        'recovery report',
      )
    })
    it('claims a legacy linked profile without moving work and creates access for status writes', async () => {
      const legacyIdentity = randomUUID(),
        legacyProfile = randomUUID(),
        token = randomUUID()
      await sql`insert into "user" (id, name, email, phone_number, phone_number_verified)
        values (${legacyIdentity}, 'Legacy identity', 'legacy@test.local', '09120000005', true)`
      await sql`insert into member (organization_id, user_id, role) values (${salon}, ${legacyIdentity}, 'member')`
      await sql`insert into staff_profiles (id, salon_id, user_id, name, phone, claimed_at)
        values (${legacyProfile}, ${salon}, ${legacyIdentity}, 'Legacy profile', '09120000005', now())`
      await sql`insert into session (user_id, token, expires_at) values (${legacyIdentity}, ${token}, now() + interval '1 day')`
      const response = await book(legacyProfile, '15:00')
      expect(response.status).toBe(200)
      const appointmentId = (await response.json()).appointment.id
      const before =
        await sql`select * from appointment_staff_assignments where appointment_id = ${appointmentId}`
      const { claimStaffProfile } = await import('@repo/database/staff')
      expect(
        await claimStaffProfile({
          userId: legacyIdentity,
          phone: '09120000005',
        }),
      ).toMatchObject({ status: 'claimed', profileId: legacyProfile })
      expect(
        await sql`select * from appointment_staff_assignments where appointment_id = ${appointmentId}`,
      ).toEqual(before)
      expect(
        (
          await request(
            `/appointments/${appointmentId}`,
            token,
            { status: 'confirmed' },
            'PATCH',
          )
        ).status,
      ).toBe(200)
    })
  },
)
