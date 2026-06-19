import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { AppEnv } from '../factory'

vi.mock('@repo/auth/server', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

vi.mock('@repo/database/members', () => ({
  getMemberForUser: vi.fn(),
}))

vi.mock('@repo/database/admin', () => ({
  getPlatformAdminForUser: vi.fn(),
  bootstrapPlatformOwnerIfNeeded: vi.fn(),
  getUserPhoneForPlatformBootstrap: vi.fn(),
}))

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgres://stub'
process.env.PLATFORM_ADMIN_BOOTSTRAP_PHONES = '09121111111'

const { auth } = await import('@repo/auth/server')
const { getMemberForUser } = await import('@repo/database/members')
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
  it('rejects suspended salons even when the user has membership', async () => {
    vi.mocked(getMemberForUser).mockResolvedValue({
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
})
