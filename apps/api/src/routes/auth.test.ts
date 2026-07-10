import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@repo/auth/server', () => {
  const auth = {
    api: {
      getSession: vi.fn(),
      signUpEmail: vi.fn(),
      createOrganization: vi.fn(),
      setPassword: vi.fn(),
    },
    handler: vi.fn(),
  }
  const adminAuth = {
    api: { getSession: vi.fn() },
    handler: vi.fn(),
  }
  return {
    auth,
    adminAuth,
    getAuthForRequest: vi.fn((request: Request) => {
      const origin = request.headers.get('origin')
      if (origin === 'http://localhost:3003') return adminAuth
      if (!origin || origin === 'http://localhost:3000') return auth
      return null
    }),
  }
})

vi.mock('@repo/database/members', () => ({
  getMemberForUser: vi.fn(),
  getManagerMemberForUser: vi.fn(),
}))

vi.mock('@repo/database/onboarding', () => ({
  getManagerOnboardingFlags: vi.fn(),
}))

vi.mock('@repo/database/staff', () => ({
  resolveStaffTenantContext: vi.fn(),
  acceptStaffInvite: vi.fn(),
  claimStaffProfile: vi.fn(),
  declineStaffInvite: vi.fn(),
  getStaffProfileForUser: vi.fn(),
  getUserWithServiceIds: vi.fn(),
  listPendingStaffInvitesForUser: vi.fn(),
  listStaffSalonOptionsForUser: vi.fn(),
}))

vi.mock('@repo/database/client', () => {
  let selectRows: unknown[] = []
  type SelectChain = {
    innerJoin: () => SelectChain
    where: () => { limit: () => Promise<unknown[]> }
  }
  const stub: {
    __setSelectRows: (rows: unknown[]) => void
    transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>
    insert: () => { values: () => Promise<void> }
    update: () => { set: () => { where: () => Promise<void> } }
    select: () => {
      from: () => SelectChain
    }
  } = {
    __setSelectRows: (rows) => {
      selectRows = rows
    },
    transaction: async (fn) => fn(stub),
    insert: () => ({ values: async () => undefined }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
    select: () => ({
      from: () => {
        const chain: SelectChain = {
          innerJoin: () => chain,
          where: () => ({ limit: async () => selectRows }),
        }
        return chain
      },
    }),
  }
  return { getDb: () => stub }
})

import { adminAuth, auth as authServer } from '@repo/auth/server'
import { getDb } from '@repo/database/client'
import { getManagerOnboardingFlags } from '@repo/database/onboarding'
import { getManagerMemberForUser, getMemberForUser } from '@repo/database/members'
import { resolveStaffTenantContext } from '@repo/database/staff'
import {
  acceptStaffInvite,
  claimStaffProfile,
  declineStaffInvite,
  getStaffProfileForUser,
  getUserWithServiceIds,
  listPendingStaffInvitesForUser,
  listStaffSalonOptionsForUser,
} from '@repo/database/staff'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgres://stub'
process.env.JWT_SECRET = 'test-secret'

const { app } = await import('../app')

const validBody = {
  salonName: 'My Salon',
  slug: 'my-salon',
  managerName: 'Ali',
  managerPhone: '09121234567',
  password: 'secret123',
}

function jsonHeaders() {
  return { 'Content-Type': 'application/json' }
}

function mockSignUpResponse(opts: {
  ok: boolean
  userId?: string
  status?: number
  setCookie?: string | string[]
}) {
  const headers = new Headers()
  if (opts.setCookie) {
    const cookies = Array.isArray(opts.setCookie)
      ? opts.setCookie
      : [opts.setCookie]
    for (const cookie of cookies) headers.append('set-cookie', cookie)
  }
  const body = opts.ok
    ? { user: { id: opts.userId ?? 'u1' } }
    : { error: 'fail' }
  return new Response(JSON.stringify(body), {
    status: opts.status ?? (opts.ok ? 200 : 400),
    headers,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(
    getDb() as unknown as { __setSelectRows: (rows: unknown[]) => void }
  ).__setSelectRows([])
  vi.mocked(claimStaffProfile).mockResolvedValue({ status: 'none' })
  vi.mocked(getStaffProfileForUser).mockResolvedValue(undefined as never)
  vi.mocked(listPendingStaffInvitesForUser).mockResolvedValue([])
  vi.mocked(listStaffSalonOptionsForUser).mockResolvedValue([])
  vi.mocked(getManagerMemberForUser).mockResolvedValue(undefined)
})

describe('auth signup route', () => {
  it('returns 400 on invalid body', async () => {
    const res = await app.request('/api/v1/auth/signup', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ ...validBody, slug: '' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 409 when signUpEmail rejects as duplicate', async () => {
    vi.mocked(authServer.api.signUpEmail).mockRejectedValue(
      new Error('user already exists'),
    )
    const res = await app.request('/api/v1/auth/signup', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(validBody),
    })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      error: 'این شماره موبایل قبلاً ثبت شده است',
    })
  })

  it('returns 409 when createOrganization rejects as duplicate slug', async () => {
    vi.mocked(authServer.api.signUpEmail).mockResolvedValue(
      mockSignUpResponse({ ok: true, userId: 'u1' }) as never,
    )
    vi.mocked(authServer.api.createOrganization).mockRejectedValue(
      new Error('slug already exists'),
    )
    const res = await app.request('/api/v1/auth/signup', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(validBody),
    })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      error: 'این آدرس سالن قبلاً ثبت شده است',
    })
  })

  it('returns 200 with salon/user/redirectTo and forwards Set-Cookie', async () => {
    vi.mocked(authServer.api.signUpEmail).mockResolvedValue(
      mockSignUpResponse({
        ok: true,
        userId: 'u1',
        setCookie: 'better-auth.session_token=tok; HttpOnly; Path=/',
      }) as never,
    )
    vi.mocked(authServer.api.createOrganization).mockResolvedValue({
      id: 's1',
      name: 'My Salon',
      slug: 'my-salon',
    } as never)
    const res = await app.request('/api/v1/auth/signup', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(validBody),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      salon: { id: string }
      user: { id: string }
      redirectTo: string
    }
    expect(body.salon.id).toBe('s1')
    expect(body.user.id).toBe('u1')
    expect(body.redirectTo).toBe('/onboarding')
    expect(res.headers.get('set-cookie') ?? '').toContain(
      'better-auth.session_token=tok',
    )
  })

  it('forwards every Set-Cookie header (session token + cache cookie) separately', async () => {
    vi.mocked(authServer.api.signUpEmail).mockResolvedValue(
      mockSignUpResponse({
        ok: true,
        userId: 'u1',
        setCookie: [
          'better-auth.session_token=tok; HttpOnly; Path=/',
          'better-auth.session_data=cache; Max-Age=60; HttpOnly; Path=/',
        ],
      }) as never,
    )
    vi.mocked(authServer.api.createOrganization).mockResolvedValue({
      id: 's1',
      name: 'My Salon',
      slug: 'my-salon',
    } as never)
    const res = await app.request('/api/v1/auth/signup', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(validBody),
    })
    expect(res.status).toBe(200)
    const cookies = res.headers.getSetCookie()
    expect(cookies).toContainEqual(
      expect.stringContaining('better-auth.session_token=tok'),
    )
    expect(cookies).toContainEqual(
      expect.stringContaining('better-auth.session_data=cache'),
    )
  })
})

describe('auth /me shim', () => {
  it('returns 401 when there is no session', async () => {
    vi.mocked(authServer.api.getSession).mockResolvedValue(null as never)
    const res = await app.request('/api/v1/auth/me')
    expect(res.status).toBe(401)
  })

  it('returns needs_workspace when the session user has no salon membership', async () => {
    vi.mocked(authServer.api.getSession).mockResolvedValue({
      user: {
        id: 'u1',
        name: 'Ali',
        phoneNumber: '09121234567',
        username: '09121234567',
      },
    } as never)
    vi.mocked(getManagerMemberForUser).mockResolvedValue(undefined)
    vi.mocked(listStaffSalonOptionsForUser).mockResolvedValue([])
    vi.mocked(getMemberForUser).mockResolvedValue(undefined)

    const res = await app.request('/api/v1/auth/me')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      status: 'needs_workspace',
      user: {
        id: 'u1',
        name: 'Ali',
        phone: '09121234567',
        hasPassword: false,
      },
    })
    expect(getUserWithServiceIds).not.toHaveBeenCalled()
  })

  it('marks pre-workspace users that already have a credential password', async () => {
    vi.mocked(authServer.api.getSession).mockResolvedValue({
      user: {
        id: 'u1',
        name: 'Ali',
        phoneNumber: '09121234567',
        username: '09121234567',
      },
    } as never)
    vi.mocked(getManagerMemberForUser).mockResolvedValue(undefined)
    vi.mocked(listStaffSalonOptionsForUser).mockResolvedValue([])
    vi.mocked(getMemberForUser).mockResolvedValue(undefined)
    ;(
      getDb() as unknown as { __setSelectRows: (rows: unknown[]) => void }
    ).__setSelectRows([{ id: 'account1' }])

    const res = await app.request('/api/v1/auth/me')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      status: 'needs_workspace',
      user: {
        id: 'u1',
        name: 'Ali',
        phone: '09121234567',
        hasPassword: true,
      },
    })
  })

  it('resolves the Better Auth session into the legacy User shape', async () => {
    vi.mocked(authServer.api.getSession).mockResolvedValue({
      user: { id: 'u1' },
    } as never)
    vi.mocked(getManagerMemberForUser).mockResolvedValue({
      userId: 'u1',
      organizationId: 's1',
      role: 'owner',
      name: 'Ali',
      username: '09121234567',
    })
    const fullUser = {
      id: 'u1',
      salonId: 's1',
      name: 'Ali',
      role: 'manager' as const,
      color: 'blue',
      phone: '09121234567',
      createdAt: new Date('2026-01-01'),
      serviceIds: null,
    }
    vi.mocked(getUserWithServiceIds).mockResolvedValue(fullUser)
    vi.mocked(getManagerOnboardingFlags).mockResolvedValue({
      needsOnboarding: false,
      onboardingCompleted: true,
    })

    const res = await app.request('/api/v1/auth/me')
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      status: string
      user: {
        id: string
        salonId: string
        role: string
        needsOnboarding?: boolean
        onboardingCompleted?: boolean
      }
    }
    expect(body.user.id).toBe('u1')
    expect(body.status).toBe('ready')
    expect(body.user.salonId).toBe('s1')
    expect(body.user.role).toBe('manager')
    expect(body.user.needsOnboarding).toBe(false)
    expect(body.user.onboardingCompleted).toBe(true)
    expect(getUserWithServiceIds).toHaveBeenCalledWith('u1', 's1')
    expect(getManagerOnboardingFlags).toHaveBeenCalledWith('s1')
  })

  it('lets single-salon staff enter without a salon header', async () => {
    vi.mocked(authServer.api.getSession).mockResolvedValue({
      user: {
        id: 'u2',
        name: 'Staff',
        phoneNumber: '09120000001',
        username: '09120000001',
      },
    } as never)
    vi.mocked(listStaffSalonOptionsForUser).mockResolvedValue([
      {
        salonId: 'salon-a',
        salonName: 'Salon A',
        staffProfileId: 'profile-a',
      },
    ])
    vi.mocked(getUserWithServiceIds).mockResolvedValue({
      id: 'u2',
      salonId: 'salon-a',
      name: 'Staff',
      role: 'staff',
      color: 'blue',
      phone: '09120000001',
      createdAt: new Date('2026-01-01'),
      serviceIds: null,
    })

    const res = await app.request('/api/v1/auth/me')
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      status: 'ready',
      user: {
        id: 'u2',
        salonId: 'salon-a',
        role: 'staff',
        salonName: 'Salon A',
      },
    })
  })

  it('returns needs_salon_selection for multi-salon staff without a salon header', async () => {
    vi.mocked(authServer.api.getSession).mockResolvedValue({
      user: {
        id: 'u2',
        name: 'Staff',
        phoneNumber: '09120000001',
        username: '09120000001',
      },
    } as never)
    const salons = [
      {
        salonId: 'salon-a',
        salonName: 'Salon A',
        staffProfileId: 'profile-a',
      },
      {
        salonId: 'salon-b',
        salonName: 'Salon B',
        staffProfileId: 'profile-b',
      },
    ]
    vi.mocked(listStaffSalonOptionsForUser).mockResolvedValue(salons)

    const res = await app.request('/api/v1/auth/me')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      status: 'needs_salon_selection',
      user: {
        id: 'u2',
        name: 'Staff',
        phone: '09120000001',
      },
      salons,
    })
    expect(getUserWithServiceIds).not.toHaveBeenCalled()
  })

  it('resolves multi-salon staff when X-Saluna-Salon-Id matches an accepted salon', async () => {
    vi.mocked(authServer.api.getSession).mockResolvedValue({
      user: {
        id: 'u2',
        name: 'Staff',
        phoneNumber: '09120000001',
        username: '09120000001',
      },
    } as never)
    vi.mocked(listStaffSalonOptionsForUser).mockResolvedValue([
      {
        salonId: 'salon-a',
        salonName: 'Salon A',
        staffProfileId: 'profile-a',
      },
      {
        salonId: 'salon-b',
        salonName: 'Salon B',
        staffProfileId: 'profile-b',
      },
    ])
    vi.mocked(getUserWithServiceIds).mockResolvedValue({
      id: 'u2',
      salonId: 'salon-b',
      name: 'Staff',
      role: 'staff',
      color: 'blue',
      phone: '09120000001',
      createdAt: new Date('2026-01-01'),
      serviceIds: null,
    })

    const res = await app.request('/api/v1/auth/me', {
      headers: { 'X-Saluna-Salon-Id': 'salon-b' },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      status: 'ready',
      user: {
        salonId: 'salon-b',
        role: 'staff',
        salonName: 'Salon B',
      },
    })
    expect(getUserWithServiceIds).toHaveBeenCalledWith('u2', 'salon-b')
  })

  it('falls back to needs_salon_selection when the stored salon is no longer valid', async () => {
    vi.mocked(authServer.api.getSession).mockResolvedValue({
      user: {
        id: 'u2',
        name: 'Staff',
        phoneNumber: '09120000001',
        username: '09120000001',
      },
    } as never)
    const salons = [
      {
        salonId: 'salon-a',
        salonName: 'Salon A',
        staffProfileId: 'profile-a',
      },
      {
        salonId: 'salon-b',
        salonName: 'Salon B',
        staffProfileId: 'profile-b',
      },
    ]
    vi.mocked(listStaffSalonOptionsForUser).mockResolvedValue(salons)

    const res = await app.request('/api/v1/auth/me', {
      headers: { 'X-Saluna-Salon-Id': 'salon-gone' },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      status: 'needs_salon_selection',
      user: {
        id: 'u2',
        name: 'Staff',
        phone: '09120000001',
      },
      salons,
    })
  })
})

describe('auth staff-salons route', () => {
  it('lists accepted salons for staff', async () => {
    vi.mocked(authServer.api.getSession).mockResolvedValue({
      user: { id: 'u2' },
    } as never)
    const salons = [
      {
        salonId: 'salon-a',
        salonName: 'Salon A',
        staffProfileId: 'profile-a',
      },
    ]
    vi.mocked(listStaffSalonOptionsForUser).mockResolvedValue(salons)

    const res = await app.request('/api/v1/auth/staff-salons')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ salons })
  })

  it('returns an empty list for managers', async () => {
    vi.mocked(authServer.api.getSession).mockResolvedValue({
      user: { id: 'u1' },
    } as never)
    vi.mocked(getManagerMemberForUser).mockResolvedValue({
      userId: 'u1',
      organizationId: 's1',
      role: 'owner',
      name: 'Ali',
      username: '09121234567',
    })

    const res = await app.request('/api/v1/auth/staff-salons')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ salons: [] })
    expect(listStaffSalonOptionsForUser).not.toHaveBeenCalled()
  })
})

describe('auth phone status route', () => {
  it('returns registered true when the phone belongs to a user', async () => {
    ;(
      getDb() as unknown as { __setSelectRows: (rows: unknown[]) => void }
    ).__setSelectRows([{ id: 'u1' }])

    const res = await app.request('/api/v1/auth/phone-status', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ phone: '09121234567' }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      registered: true,
      otpLoginEnabled: false,
    })
  })

  it('returns registered false for a new phone number', async () => {
    const res = await app.request('/api/v1/auth/phone-status', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ phone: '09121234567' }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      registered: false,
      otpLoginEnabled: false,
    })
  })
})

describe('Better Auth passthrough routes', () => {
  it('routes admin sign-in to the admin cookie namespace', async () => {
    vi.mocked(adminAuth.handler).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }) as never,
    )

    const res = await app.request('/api/v1/auth/sign-in/phone-number', {
      method: 'POST',
      headers: {
        ...jsonHeaders(),
        Origin: 'http://localhost:3003',
      },
      body: JSON.stringify({
        phoneNumber: '09121234567',
        password: 'secret123',
      }),
    })

    expect(res.status).toBe(200)
    expect(adminAuth.handler).toHaveBeenCalledOnce()
    expect(authServer.handler).not.toHaveBeenCalled()
  })

  it('rejects auth requests from an explicit untrusted origin', async () => {
    const res = await app.request('/api/v1/auth/sign-out', {
      method: 'POST',
      headers: { Origin: 'https://untrusted.example' },
    })

    expect(res.status).toBe(403)
    expect(adminAuth.handler).not.toHaveBeenCalled()
    expect(authServer.handler).not.toHaveBeenCalled()
  })

  it('rejects OTP login for a completed account while the flag is disabled', async () => {
    ;(
      getDb() as unknown as { __setSelectRows: (rows: unknown[]) => void }
    ).__setSelectRows([{ id: 'u1' }])

    const res = await app.request('/api/v1/auth/phone-number/send-otp', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ phoneNumber: '09121234567' }),
    })

    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: 'OTP_LOGIN_DISABLED' })
    expect(authServer.handler).not.toHaveBeenCalled()
  })

  it('keeps registration OTP available for an incomplete account', async () => {
    vi.mocked(authServer.handler).mockResolvedValue(
      new Response(JSON.stringify({ message: 'OTP sent' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }) as never,
    )

    const res = await app.request('/api/v1/auth/phone-number/send-otp', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ phoneNumber: '09121234567' }),
    })

    expect(res.status).toBe(200)
    expect(authServer.handler).toHaveBeenCalledOnce()
  })

  it('passes phone-number password sign-in through to Better Auth', async () => {
    vi.mocked(authServer.handler).mockResolvedValue(
      new Response(JSON.stringify({ ok: true, endpoint: 'phone' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }) as never,
    )

    const res = await app.request('/api/v1/auth/sign-in/phone-number', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        phoneNumber: '09121234567',
        password: 'secret123',
      }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, endpoint: 'phone' })
    expect(authServer.handler).toHaveBeenCalledOnce()
    const forwardedRequest = vi.mocked(authServer.handler).mock.calls[0]?.[0]
    expect(forwardedRequest).toBeInstanceOf(Request)
    expect((forwardedRequest as Request).url).toContain(
      '/api/v1/auth/sign-in/phone-number',
    )
  })

  it('keeps legacy username/password sign-in available for rollback', async () => {
    vi.mocked(authServer.handler).mockResolvedValue(
      new Response(JSON.stringify({ ok: true, endpoint: 'username' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }) as never,
    )

    const res = await app.request('/api/v1/auth/sign-in/username', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        username: '09121234567',
        password: 'secret123',
      }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, endpoint: 'username' })
    expect(authServer.handler).toHaveBeenCalledOnce()
    const forwardedRequest = vi.mocked(authServer.handler).mock.calls[0]?.[0]
    expect(forwardedRequest).toBeInstanceOf(Request)
    expect((forwardedRequest as Request).url).toContain(
      '/api/v1/auth/sign-in/username',
    )
  })
})

describe('OTP signup continuation routes', () => {
  it('claims the matching Staff Profile only after successful OTP verification', async () => {
    vi.mocked(authServer.handler).mockResolvedValue(
      new Response(
        JSON.stringify({
          status: true,
          user: {
            id: 'u1',
            phoneNumber: '09121234567',
            phoneNumberVerified: true,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ) as never,
    )
    vi.mocked(claimStaffProfile).mockResolvedValue({
      status: 'claimed',
      profileId: 'profile-1',
      salonId: 'salon-1',
      transferred: false,
    })

    const res = await app.request('/api/v1/auth/phone-number/verify', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ phoneNumber: '09121234567', code: '123456' }),
    })

    expect(res.status).toBe(200)
    expect(claimStaffProfile).toHaveBeenCalledWith({
      userId: 'u1',
      phone: '09121234567',
    })
  })

  it('runs a Staff Access Transfer only after successful OTP verification', async () => {
    vi.mocked(authServer.handler).mockResolvedValue(
      new Response(JSON.stringify({ status: true, user: { id: 'u1' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }) as never,
    )
    vi.mocked(claimStaffProfile).mockResolvedValue({
      status: 'claimed',
      profileId: 'profile-new',
      salonId: 'salon-new',
      transferred: true,
    })

    const res = await app.request('/api/v1/auth/phone-number/verify', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ phoneNumber: '09121234567', code: '123456' }),
    })

    expect(res.status).toBe(200)
    expect(claimStaffProfile).toHaveBeenCalledOnce()
  })

  it('rejects an ambiguous Staff Profile claim after OTP without identity detail', async () => {
    vi.mocked(authServer.handler).mockResolvedValue(
      new Response(JSON.stringify({ status: true, user: { id: 'u1' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }) as never,
    )
    vi.mocked(claimStaffProfile).mockResolvedValue({
      status: 'rejected',
      reason: 'ambiguous',
    })

    const res = await app.request('/api/v1/auth/phone-number/verify', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ phoneNumber: '09121234567', code: '123456' }),
    })

    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ code: 'STAFF_CLAIM_AMBIGUOUS' })
  })

  it('lets a newly claimed staff member establish their own password', async () => {
    vi.mocked(authServer.api.getSession).mockResolvedValue({
      user: { id: 'u1' },
    } as never)
    vi.mocked(getStaffProfileForUser).mockResolvedValue({
      id: 'profile-1',
    } as never)

    const res = await app.request('/api/v1/auth/staff-claim/password', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ password: 'secret123' }),
    })

    expect(res.status).toBe(200)
    expect(authServer.api.setPassword).toHaveBeenCalledWith({
      body: { newPassword: 'secret123' },
      headers: expect.any(Headers),
    })
  })

  it('reuses a claimed identity that already has a password without replacing it', async () => {
    vi.mocked(authServer.api.getSession).mockResolvedValue({
      user: { id: 'u1' },
    } as never)
    vi.mocked(listStaffSalonOptionsForUser).mockResolvedValue([
      {
        salonId: 'salon-1',
        salonName: 'Salon One',
        staffProfileId: 'profile-1',
      },
    ])
    vi.mocked(getStaffProfileForUser).mockResolvedValue({
      id: 'profile-1',
    } as never)
    vi.mocked(getUserWithServiceIds).mockResolvedValue({
      id: 'u1',
      salonId: 'salon-1',
      name: 'Sara',
      phone: '09121234567',
      role: 'staff',
      color: 'mint',
      createdAt: new Date(),
    })
    ;(
      getDb() as unknown as { __setSelectRows: (rows: unknown[]) => void }
    ).__setSelectRows([{ id: 'credential-1' }])

    const res = await app.request('/api/v1/auth/me', { headers: jsonHeaders() })

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ status: 'ready' })
    expect(authServer.api.setPassword).not.toHaveBeenCalled()
  })

  it('sets the password and real manager name for an OTP-created account', async () => {
    vi.mocked(authServer.api.getSession).mockResolvedValue({
      user: {
        id: 'u1',
        name: 'Temporary',
        phoneNumber: '09121234567',
        username: '09121234567',
      },
    } as never)
    vi.mocked(authServer.api.setPassword).mockResolvedValue({
      status: true,
    } as never)

    const res = await app.request('/api/v1/auth/signup/account', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        managerName: 'Ali',
        password: 'secret123',
      }),
    })

    expect(res.status).toBe(200)
    expect(authServer.api.setPassword).toHaveBeenCalledWith({
      body: { newPassword: 'secret123' },
      headers: expect.any(Headers),
    })
    expect(await res.json()).toEqual({
      user: { id: 'u1', name: 'Ali', phone: '09121234567' },
    })
  })

  it('rejects non-Latin passwords before account completion', async () => {
    vi.mocked(authServer.api.getSession).mockResolvedValue({
      user: {
        id: 'u1',
        name: 'Temporary',
        phoneNumber: '09121234567',
        username: '09121234567',
      },
    } as never)

    const res = await app.request('/api/v1/auth/signup/account', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        managerName: 'Ali',
        password: 'secret۱۲۳',
      }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error:
        'رمز عبور فقط می‌تواند شامل حروف انگلیسی، اعداد و نمادهای کیبورد انگلیسی باشد',
    })
    expect(authServer.api.setPassword).not.toHaveBeenCalled()
  })

  it('updates only the real manager name when the account already has a password', async () => {
    vi.mocked(authServer.api.getSession).mockResolvedValue({
      user: {
        id: 'u1',
        name: 'Temporary',
        phoneNumber: '09121234567',
        username: '09121234567',
      },
    } as never)
    ;(
      getDb() as unknown as { __setSelectRows: (rows: unknown[]) => void }
    ).__setSelectRows([{ id: 'account1' }])

    const res = await app.request('/api/v1/auth/signup/account', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ managerName: 'Ali' }),
    })

    expect(res.status).toBe(200)
    expect(authServer.api.setPassword).not.toHaveBeenCalled()
    expect(await res.json()).toEqual({
      user: { id: 'u1', name: 'Ali', phone: '09121234567' },
    })
  })

  it('requires a password when the pre-workspace account has no credential password', async () => {
    vi.mocked(authServer.api.getSession).mockResolvedValue({
      user: {
        id: 'u1',
        name: 'Temporary',
        phoneNumber: '09121234567',
        username: '09121234567',
      },
    } as never)

    const res = await app.request('/api/v1/auth/signup/account', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ managerName: 'Ali' }),
    })

    expect(res.status).toBe(400)
    expect(authServer.api.setPassword).not.toHaveBeenCalled()
  })

  it('requires a session before setting account details', async () => {
    vi.mocked(authServer.api.getSession).mockResolvedValue(null as never)

    const res = await app.request('/api/v1/auth/signup/account', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        managerName: 'Ali',
        password: 'secret123',
      }),
    })

    expect(res.status).toBe(401)
    expect(authServer.api.setPassword).not.toHaveBeenCalled()
  })

  it('rejects non-Latin password resets before Better Auth handling', async () => {
    const res = await app.request('/api/v1/auth/reset-password', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        token: 'token',
        newPassword: 'secret۱۲۳',
      }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error:
        'رمز عبور فقط می‌تواند شامل حروف انگلیسی، اعداد و نمادهای کیبورد انگلیسی باشد',
    })
    expect(authServer.handler).not.toHaveBeenCalled()
  })

  it('passes valid password resets through to Better Auth', async () => {
    vi.mocked(authServer.handler).mockResolvedValue(
      new Response(JSON.stringify({ status: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }) as never,
    )

    const res = await app.request('/api/v1/auth/reset-password', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        token: 'token',
        newPassword: 'secret123',
      }),
    })

    expect(res.status).toBe(200)
    expect(authServer.handler).toHaveBeenCalledOnce()
  })

  it('creates a workspace for an authenticated user without membership', async () => {
    vi.mocked(authServer.api.getSession).mockResolvedValue({
      user: {
        id: 'u1',
        name: 'Ali',
        phoneNumber: '09121234567',
        username: '09121234567',
      },
    } as never)
    vi.mocked(getMemberForUser).mockResolvedValue(undefined)
    vi.mocked(authServer.api.createOrganization).mockResolvedValue({
      id: 's1',
      name: 'My Salon',
      slug: 'my-salon',
    } as never)

    const res = await app.request('/api/v1/auth/signup/workspace', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ salonName: 'My Salon', slug: 'my-salon' }),
    })

    expect(res.status).toBe(200)
    expect(authServer.api.createOrganization).toHaveBeenCalledWith({
      body: { name: 'My Salon', slug: 'my-salon', userId: 'u1' },
    })
    expect(await res.json()).toEqual({
      salon: { id: 's1', name: 'My Salon', slug: 'my-salon' },
      user: { id: 'u1', name: 'Ali', phone: '09121234567' },
      redirectTo: '/onboarding',
    })
  })

  it('returns existing workspace state instead of creating another workspace', async () => {
    vi.mocked(authServer.api.getSession).mockResolvedValue({
      user: {
        id: 'u1',
        name: 'Ali',
        phoneNumber: '09121234567',
        username: '09121234567',
      },
    } as never)
    vi.mocked(getMemberForUser).mockResolvedValue({
      userId: 'u1',
      organizationId: 's1',
      role: 'owner',
      name: 'Ali',
      username: '09121234567',
    })
    ;(
      getDb() as unknown as { __setSelectRows: (rows: unknown[]) => void }
    ).__setSelectRows([
      { id: 's1', name: 'Existing Salon', slug: 'existing-salon' },
    ])

    const res = await app.request('/api/v1/auth/signup/workspace', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ salonName: 'Ignored Salon' }),
    })

    expect(res.status).toBe(200)
    expect(authServer.api.createOrganization).not.toHaveBeenCalled()
    expect(await res.json()).toEqual({
      salon: { id: 's1', name: 'Existing Salon', slug: 'existing-salon' },
      user: { id: 'u1', name: 'Ali', phone: '09121234567' },
      redirectTo: '/onboarding',
    })
  })
})

describe('Staff Invite accept and decline', () => {
  const inviteId = '11111111-1111-4111-8111-111111111111'
  const pendingInvite = {
    id: inviteId,
    salonId: 'salon-b',
    salonName: 'Salon B',
    staffProfileId: 'profile-b',
    staffName: 'Sara',
    phone: '09121234567',
    expiresAt: new Date('2026-07-20T12:00:00Z'),
    createdAt: new Date('2026-07-09T12:00:00Z'),
  }

  it('lists pending Staff Invites for the verified session phone', async () => {
    vi.mocked(authServer.api.getSession).mockResolvedValue({
      user: { id: 'u1' },
    } as never)
    vi.mocked(listPendingStaffInvitesForUser).mockResolvedValue([pendingInvite])

    const res = await app.request('/api/v1/auth/staff-invites')

    expect(res.status).toBe(200)
    expect(listPendingStaffInvitesForUser).toHaveBeenCalledWith('u1')
    expect(await res.json()).toEqual({
      invites: [
        {
          id: inviteId,
          salonId: 'salon-b',
          salonName: 'Salon B',
          staffProfileId: 'profile-b',
          staffName: 'Sara',
          phone: '09121234567',
          expiresAt: '2026-07-20T12:00:00.000Z',
          createdAt: '2026-07-09T12:00:00.000Z',
        },
      ],
    })
  })

  it('requires login to list pending Staff Invites', async () => {
    vi.mocked(authServer.api.getSession).mockResolvedValue(null)

    const res = await app.request('/api/v1/auth/staff-invites')

    expect(res.status).toBe(401)
    expect(listPendingStaffInvitesForUser).not.toHaveBeenCalled()
  })

  it('accepts a Staff Invite and returns Staff Profile Access', async () => {
    vi.mocked(authServer.api.getSession).mockResolvedValue({
      user: { id: 'u1' },
    } as never)
    vi.mocked(acceptStaffInvite).mockResolvedValue({
      status: 'accepted',
      access: {
        id: 'access-1',
        salonId: 'salon-b',
        staffProfileId: 'profile-b',
        userId: 'u1',
        staffInviteId: inviteId,
        acceptedAt: new Date('2026-07-09T12:00:00Z'),
        revokedAt: null,
        createdAt: new Date('2026-07-09T12:00:00Z'),
        updatedAt: new Date('2026-07-09T12:00:00Z'),
      },
      invite: {
        id: inviteId,
        status: 'accepted',
        acceptedAt: new Date('2026-07-09T12:00:00Z'),
        declinedAt: null,
      } as never,
      preservedAccessSalonIds: ['salon-a'],
    })

    const res = await app.request(
      `/api/v1/auth/staff-invites/${inviteId}/accept`,
      {
        method: 'POST',
        headers: jsonHeaders(),
      },
    )

    expect(res.status).toBe(200)
    expect(acceptStaffInvite).toHaveBeenCalledWith({
      userId: 'u1',
      inviteId,
    })
    expect(await res.json()).toMatchObject({
      access: {
        id: 'access-1',
        salonId: 'salon-b',
        staffProfileId: 'profile-b',
      },
      invite: { id: inviteId, status: 'accepted' },
      preservedAccessSalonIds: ['salon-a'],
    })
  })

  it('rejects accepting a Staff Invite for a different phone', async () => {
    vi.mocked(authServer.api.getSession).mockResolvedValue({
      user: { id: 'u1' },
    } as never)
    vi.mocked(acceptStaffInvite).mockResolvedValue({
      status: 'rejected',
      reason: 'phone_mismatch',
    })

    const res = await app.request(
      `/api/v1/auth/staff-invites/${inviteId}/accept`,
      {
        method: 'POST',
        headers: jsonHeaders(),
      },
    )

    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: 'phone_mismatch' })
  })

  it('declines a Staff Invite without creating Staff Profile Access', async () => {
    vi.mocked(authServer.api.getSession).mockResolvedValue({
      user: { id: 'u1' },
    } as never)
    vi.mocked(declineStaffInvite).mockResolvedValue({
      status: 'declined',
      invite: {
        id: inviteId,
        status: 'declined',
        declinedAt: new Date('2026-07-09T12:00:00Z'),
        acceptedAt: null,
      } as never,
    })

    const res = await app.request(
      `/api/v1/auth/staff-invites/${inviteId}/decline`,
      {
        method: 'POST',
        headers: jsonHeaders(),
      },
    )

    expect(res.status).toBe(200)
    expect(declineStaffInvite).toHaveBeenCalledWith({
      userId: 'u1',
      inviteId,
    })
    expect(acceptStaffInvite).not.toHaveBeenCalled()
    expect(await res.json()).toMatchObject({
      invite: { id: inviteId, status: 'declined' },
    })
  })

  it('rejects declining a Staff Invite for a different phone', async () => {
    vi.mocked(authServer.api.getSession).mockResolvedValue({
      user: { id: 'u1' },
    } as never)
    vi.mocked(declineStaffInvite).mockResolvedValue({
      status: 'rejected',
      reason: 'phone_mismatch',
    })

    const res = await app.request(
      `/api/v1/auth/staff-invites/${inviteId}/decline`,
      {
        method: 'POST',
        headers: jsonHeaders(),
      },
    )

    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: 'phone_mismatch' })
  })
})
