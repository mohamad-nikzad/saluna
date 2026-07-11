import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { AppEnv } from '../factory'

vi.mock('@repo/auth/server', () => {
  const auth = {
    api: {
      getSession: vi.fn(),
    },
  }
  const adminAuth = {
    api: {
      getSession: vi.fn(),
    },
  }
  return { auth, adminAuth }
})

vi.mock('@repo/database/staff', () => ({
  resolveStaffTenantContext: vi.fn(),
}))

vi.mock('@repo/database/members', () => ({
  getMemberForUser: vi.fn(),
  getManagerMemberForUser: vi.fn(),
}))

vi.mock('@repo/database/admin', () => ({
  getPlatformAdminForUser: vi.fn(),
  bootstrapPlatformOwnerIfNeeded: vi.fn(),
  getUserPhoneForPlatformBootstrap: vi.fn(),
}))

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgres://stub'
process.env.PLATFORM_ADMIN_BOOTSTRAP_PHONES = '09121111111'

const { adminAuth, auth } = await import('@repo/auth/server')
const { getManagerMemberForUser, getMemberForUser } =
  await import('@repo/database/members')
const { resolveStaffTenantContext } = await import('@repo/database/staff')
const {
  getPlatformAdminForUser,
  bootstrapPlatformOwnerIfNeeded,
  getUserPhoneForPlatformBootstrap,
} = await import('@repo/database/admin')
const { requirePlatformAdmin, requireTenant } = await import('./auth')

function appWithPlatform(
  permission?: Parameters<typeof requirePlatformAdmin>[0],
) {
  return new Hono<AppEnv>().get(
    '/admin',
    requirePlatformAdmin(permission),
    (c) => c.json(c.get('platformAdmin')),
  )
}

function appWithTenant() {
  return new Hono<AppEnv>().get('/tenant', requireTenant(), (c) =>
    c.json(c.get('tenant')),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(auth.api.getSession).mockResolvedValue({
    user: {
      id: 'u1',
      name: 'Ali',
      phoneNumber: '09121111111',
      username: '09121111111',
    },
  } as never)
  vi.mocked(adminAuth.api.getSession).mockResolvedValue({
    user: {
      id: 'u1',
      name: 'Ali',
      phoneNumber: '09121111111',
      username: '09121111111',
    },
  } as never)
  vi.mocked(getUserPhoneForPlatformBootstrap).mockResolvedValue(undefined)
})

describe('requirePlatformAdmin', () => {
  it('sets platform admin context for active admins with permission', async () => {
    vi.mocked(getPlatformAdminForUser).mockResolvedValue({
      id: 'pa1',
      userId: 'u1',
      role: 'platform_admin',
      active: true,
    })

    const res = await appWithPlatform('view_salons').request('/admin')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      userId: 'u1',
      role: 'platform_admin',
      name: 'Ali',
    })
  })

  it('rejects platform roles without the requested permission', async () => {
    vi.mocked(getPlatformAdminForUser).mockResolvedValue({
      id: 'pa1',
      userId: 'u1',
      role: 'platform_support',
      active: true,
    })

    const res = await appWithPlatform('manage_platform_admins').request(
      '/admin',
    )

    expect(res.status).toBe(403)
  })

  it.each([
    [
      { name: '  ', email: 'admin@example.com', phoneNumber: '09121111111' },
      'admin@example.com',
    ],
    [{ name: '', email: ' ', phoneNumber: '09121111111' }, '09121111111'],
    [{ name: '', email: '', phoneNumber: '', username: '', id: 'u1' }, 'u1'],
  ])(
    'uses a stable authenticated platform display-name fallback',
    async (user, expectedName) => {
      vi.mocked(adminAuth.api.getSession).mockResolvedValue({
        user: { id: 'u1', ...user },
      } as never)
      vi.mocked(getPlatformAdminForUser).mockResolvedValue({
        id: 'pa1',
        userId: 'u1',
        role: 'platform_admin',
        active: true,
      })

      const response = await appWithPlatform('view_support_tickets').request(
        '/admin',
      )

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(
        expect.objectContaining({ name: expectedName }),
      )
    },
  )

  it('bootstraps the first owner from the env allowlist', async () => {
    vi.mocked(getPlatformAdminForUser).mockResolvedValue(undefined)
    vi.mocked(bootstrapPlatformOwnerIfNeeded).mockResolvedValue({
      id: 'pa1',
      userId: 'u1',
      role: 'platform_owner',
      active: true,
    })

    const res = await appWithPlatform('manage_platform_admins').request(
      '/admin',
    )

    expect(res.status).toBe(200)
    expect(bootstrapPlatformOwnerIfNeeded).toHaveBeenCalledWith({
      userId: 'u1',
      phone: '09121111111',
      allowedPhones: ['09121111111'],
    })
  })
})

describe('requireTenant', () => {
  it('rejects Setup Salons even if a membership is present', async () => {
    vi.mocked(getManagerMemberForUser).mockResolvedValue({
      userId: 'u1',
      organizationId: 's1',
      role: 'owner',
      salonStatus: 'setup',
      name: 'Ali',
      username: '09121111111',
    })

    const res = await appWithTenant().request('/tenant')

    expect(res.status).toBe(403)
  })

  it('rejects suspended salons even when the user has membership', async () => {
    vi.mocked(getManagerMemberForUser).mockResolvedValue({
      userId: 'u1',
      organizationId: 's1',
      role: 'owner',
      salonStatus: 'suspended',
      name: 'Ali',
      username: '09121111111',
    })

    const res = await appWithTenant().request('/tenant')

    expect(res.status).toBe(403)
  })

  it('resolves only the PWA cookie namespace', async () => {
    vi.mocked(getManagerMemberForUser).mockResolvedValue(undefined)
    vi.mocked(resolveStaffTenantContext).mockResolvedValue({
      status: 'rejected',
      reason: 'no_access',
    } as never)

    await appWithTenant().request('/tenant')

    expect(auth.api.getSession).toHaveBeenCalledOnce()
    expect(adminAuth.api.getSession).not.toHaveBeenCalled()
  })

  it('grants staff tenant access from active Staff Profile Access', async () => {
    vi.mocked(getManagerMemberForUser).mockResolvedValue(undefined)
    vi.mocked(resolveStaffTenantContext).mockResolvedValue({
      status: 'ok',
      userId: 'u2',
      salonId: 'salon-b',
      staffProfileId: 'profile-b',
      name: 'Staff',
      phone: '09120000001',
      salonStatus: 'active',
    } as never)

    const res = await appWithTenant().request('/tenant', {
      headers: { 'X-Saluna-Salon-Id': 'salon-b' },
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      userId: 'u2',
      salonId: 'salon-b',
      role: 'staff',
      name: 'Staff',
      phone: '09120000001',
      staffProfileId: 'profile-b',
    })
    expect(resolveStaffTenantContext).toHaveBeenCalledWith({
      userId: 'u1',
      requestedSalonId: 'salon-b',
    })
  })

  it('rejects staff tenant requests for a wrong salon', async () => {
    vi.mocked(getManagerMemberForUser).mockResolvedValue(undefined)
    vi.mocked(resolveStaffTenantContext).mockResolvedValue({
      status: 'rejected',
      reason: 'wrong_salon',
    } as never)

    const res = await appWithTenant().request('/tenant', {
      headers: { 'X-Saluna-Salon-Id': 'salon-other' },
    })

    expect(res.status).toBe(403)
  })

  it('rejects staff with only a pending invite (no Staff Profile Access)', async () => {
    vi.mocked(getManagerMemberForUser).mockResolvedValue(undefined)
    vi.mocked(resolveStaffTenantContext).mockResolvedValue({
      status: 'rejected',
      reason: 'no_access',
    } as never)

    const res = await appWithTenant().request('/tenant')

    expect(res.status).toBe(403)
  })

  it('rejects staff after Staff Profile Access is revoked', async () => {
    vi.mocked(getManagerMemberForUser).mockResolvedValue(undefined)
    vi.mocked(resolveStaffTenantContext).mockResolvedValue({
      status: 'rejected',
      reason: 'no_access',
    } as never)

    const res = await appWithTenant().request('/tenant', {
      headers: { 'X-Saluna-Salon-Id': 'salon-a' },
    })

    expect(res.status).toBe(403)
  })
})
