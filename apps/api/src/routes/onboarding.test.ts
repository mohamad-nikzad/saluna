import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@repo/database/onboarding', () => ({
  getOnboardingStatus: vi.fn(),
  updateOnboardingState: vi.fn(),
}))

vi.mock('@repo/auth/server', () => ({
  auth: { api: { getSession: vi.fn() } },
}))

vi.mock('@repo/database/staff', () => ({
  resolveStaffTenantContext: vi.fn(),
}))

vi.mock('@repo/database/members', () => ({
  getMemberForUser: vi.fn(),
  getManagerMemberForUser: vi.fn(),
}))

import * as db from '@repo/database/onboarding'
import { auth as authServer } from '@repo/auth/server'
import {
  getManagerMemberForUser,
  getMemberForUser,
} from '@repo/database/members'
import { resolveStaffTenantContext } from '@repo/database/staff'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgres://stub'
process.env.JWT_SECRET = 'test-secret'

const { app } = await import('../app')

const authHeaders = { Authorization: 'Bearer testtoken' }

function makeStatus(
  steps: Partial<{
    businessHoursSet: boolean
    servicesAdded: boolean
    staffAdded: boolean
    presenceSet: boolean
    publicPageConfigured: boolean
    notificationsConfigured: boolean
  }> = {},
  extra: Partial<{ completedAt: Date | null; skippedAt: Date | null }> = {},
) {
  return {
    salon: { id: 's1', name: 'S', slug: 's', phone: null, address: null },
    steps: {
      businessHoursSet: false,
      servicesAdded: false,
      staffAdded: false,
      presenceSet: false,
      publicPageConfigured: false,
      notificationsConfigured: false,
      ...steps,
    },
    completedAt: null,
    skippedAt: null,
    ...extra,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(authServer.api.getSession).mockImplementation(
    async (args: any) =>
      (args?.headers?.get?.('Authorization')
        ? { user: { id: 'u1' } }
        : null) as never,
  )
  vi.mocked(getMemberForUser).mockResolvedValue({
    userId: 'u1',
    organizationId: 's1',
    role: 'owner',
    name: 'Manager',
    username: '09120000000',
  } as never)
  vi.mocked(getManagerMemberForUser).mockResolvedValue({
    userId: 'u1',
    organizationId: 's1',
    role: 'owner',
    name: 'Manager',
    username: '09120000000',
  } as never)
})

describe('onboarding router', () => {
  it('401 without auth', async () => {
    const res = await app.request('/api/v1/onboarding')
    expect(res.status).toBe(401)
  })

  it('403 for staff', async () => {
    vi.mocked(getManagerMemberForUser).mockResolvedValue(undefined as never)
    vi.mocked(resolveStaffTenantContext).mockResolvedValue({
      status: 'ok',
      userId: 'u2',
      salonId: 's1',
      staffProfileId: 'profile-u2',
      name: 'Staff',
      phone: '09120000001',
      salonStatus: 'active',
    } as never)
    const res = await app.request('/api/v1/onboarding', {
      headers: authHeaders,
    })
    expect(res.status).toBe(403)
  })

  it('GET returns status with the new six-step shape', async () => {
    const status = makeStatus({
      businessHoursSet: true,
      servicesAdded: true,
      staffAdded: false,
      presenceSet: true,
      publicPageConfigured: false,
      notificationsConfigured: true,
    })
    vi.mocked(db.getOnboardingStatus).mockResolvedValue(status as never)
    const res = await app.request('/api/v1/onboarding', {
      headers: authHeaders,
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { onboarding: typeof status }
    expect(Object.keys(body.onboarding.steps).sort()).toEqual(
      [
        'businessHoursSet',
        'notificationsConfigured',
        'presenceSet',
        'publicPageConfigured',
        'servicesAdded',
        'staffAdded',
      ].sort(),
    )
    expect(body.onboarding.steps.presenceSet).toBe(true)
    expect(body.onboarding.steps.notificationsConfigured).toBe(true)
    expect(body.onboarding.steps.publicPageConfigured).toBe(false)
  })

  it('PATCH 400 on invalid action', async () => {
    const res = await app.request('/api/v1/onboarding', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'bogus' }),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'درخواست نامعتبر است' })
  })

  it("PATCH 400 on legacy 'confirm-profile' action", async () => {
    const res = await app.request('/api/v1/onboarding', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm-profile' }),
    })
    expect(res.status).toBe(400)
  })

  it('PATCH complete updates state', async () => {
    vi.mocked(db.updateOnboardingState).mockResolvedValue(
      makeStatus({}, { completedAt: new Date() }) as never,
    )
    const res = await app.request('/api/v1/onboarding', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'complete' }),
    })
    expect(res.status).toBe(200)
    expect(db.updateOnboardingState).toHaveBeenCalledWith('s1', 'complete')
  })

  it('PATCH reopen updates state', async () => {
    vi.mocked(db.updateOnboardingState).mockResolvedValue(makeStatus() as never)
    const res = await app.request('/api/v1/onboarding', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reopen' }),
    })
    expect(res.status).toBe(200)
    expect(db.updateOnboardingState).toHaveBeenCalledWith('s1', 'reopen')
  })

  it('PATCH confirm-business-hours updates state', async () => {
    vi.mocked(db.updateOnboardingState).mockResolvedValue(
      makeStatus({ businessHoursSet: true }) as never,
    )
    const res = await app.request('/api/v1/onboarding', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm-business-hours' }),
    })
    expect(res.status).toBe(200)
    expect(db.updateOnboardingState).toHaveBeenCalledWith(
      's1',
      'confirm-business-hours',
    )
    const body = (await res.json()) as {
      onboarding: ReturnType<typeof makeStatus>
    }
    expect(body.onboarding.steps.businessHoursSet).toBe(true)
  })

  it('PATCH skip fails (400) when services or staff missing', async () => {
    vi.mocked(db.getOnboardingStatus).mockResolvedValue(
      makeStatus({ servicesAdded: true, staffAdded: false }) as never,
    )
    const res = await app.request('/api/v1/onboarding', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'skip' }),
    })
    expect(res.status).toBe(400)
    expect(db.updateOnboardingState).not.toHaveBeenCalled()
  })

  it('PATCH skip fails (400) when services missing', async () => {
    vi.mocked(db.getOnboardingStatus).mockResolvedValue(
      makeStatus({ servicesAdded: false, staffAdded: true }) as never,
    )
    const res = await app.request('/api/v1/onboarding', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'skip' }),
    })
    expect(res.status).toBe(400)
    expect(db.updateOnboardingState).not.toHaveBeenCalled()
  })

  it('PATCH set-manager-staff flips staffAdded to true', async () => {
    vi.mocked(db.updateOnboardingState).mockResolvedValue(
      makeStatus({ staffAdded: true }) as never,
    )
    const res = await app.request('/api/v1/onboarding', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set-manager-staff' }),
    })
    expect(res.status).toBe(200)
    expect(db.updateOnboardingState).toHaveBeenCalledWith(
      's1',
      'set-manager-staff',
    )
    const body = (await res.json()) as {
      onboarding: ReturnType<typeof makeStatus>
    }
    expect(body.onboarding.steps.staffAdded).toBe(true)
  })

  it('PATCH skip allowed once services + manager-staff are set', async () => {
    // manager-staff path: staffAdded derived true even with no staff rows.
    vi.mocked(db.getOnboardingStatus).mockResolvedValue(
      makeStatus({ servicesAdded: true, staffAdded: true }) as never,
    )
    vi.mocked(db.updateOnboardingState).mockResolvedValue(
      makeStatus(
        { servicesAdded: true, staffAdded: true },
        { skippedAt: new Date() },
      ) as never,
    )
    const res = await app.request('/api/v1/onboarding', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'skip' }),
    })
    expect(res.status).toBe(200)
    expect(db.updateOnboardingState).toHaveBeenCalledWith('s1', 'skip')
  })

  it('PATCH skip succeeds when services + staff both present', async () => {
    vi.mocked(db.getOnboardingStatus).mockResolvedValue(
      makeStatus({ servicesAdded: true, staffAdded: true }) as never,
    )
    vi.mocked(db.updateOnboardingState).mockResolvedValue(
      makeStatus(
        { servicesAdded: true, staffAdded: true },
        { skippedAt: new Date() },
      ) as never,
    )
    const res = await app.request('/api/v1/onboarding', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'skip' }),
    })
    expect(res.status).toBe(200)
    expect(db.updateOnboardingState).toHaveBeenCalledWith('s1', 'skip')
  })
})
