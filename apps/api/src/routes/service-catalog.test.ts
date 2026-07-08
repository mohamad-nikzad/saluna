import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@repo/database/services', () => ({
  getAllServiceCategories: vi.fn(),
  getAllServices: vi.fn(),
  getAllServiceAddons: vi.fn(),
  getAllServicePackages: vi.fn(),
}))

vi.mock('@repo/auth/server', () => ({
  auth: { api: { getSession: vi.fn() } },
}))

vi.mock('@repo/database/members', () => ({
  getMemberForUser: vi.fn(),
}))

import * as db from '@repo/database/services'
import { auth as authServer } from '@repo/auth/server'
import { getMemberForUser } from '@repo/database/members'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgres://stub'
process.env.JWT_SECRET = 'test-secret'

const { app } = await import('../app')

const authHeaders = { Authorization: 'Bearer testtoken' }

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
})

describe('service-catalog router', () => {
  it('returns a combined manager catalog', async () => {
    vi.mocked(db.getAllServiceCategories).mockResolvedValue([
      { id: 'cat-1' },
    ] as never)
    vi.mocked(db.getAllServices).mockResolvedValue([{ id: 'svc-1' }] as never)
    vi.mocked(db.getAllServiceAddons).mockResolvedValue([
      { id: 'addon-1' },
    ] as never)
    vi.mocked(db.getAllServicePackages).mockResolvedValue([
      { id: 'pkg-1', staffIds: ['staff-1'] },
    ] as never)

    const res = await app.request('/api/v1/service-catalog?all=1', {
      headers: authHeaders,
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      categories: [{ id: 'cat-1' }],
      services: [{ id: 'svc-1' }],
      addons: [{ id: 'addon-1' }],
      packages: [{ id: 'pkg-1', staffIds: ['staff-1'] }],
    })
    expect(db.getAllServiceCategories).toHaveBeenCalledWith('s1', true)
    expect(db.getAllServices).toHaveBeenCalledWith('s1', true)
    expect(db.getAllServiceAddons).toHaveBeenCalledWith('s1', true)
    expect(db.getAllServicePackages).toHaveBeenCalledWith('s1', true)
  })

  it('keeps staff on active service catalog data without package exposure', async () => {
    vi.mocked(getMemberForUser).mockResolvedValue({
      userId: 'u2',
      organizationId: 's1',
      role: 'member',
      name: 'Staff',
      username: '09120000001',
    } as never)
    vi.mocked(db.getAllServiceCategories).mockResolvedValue([] as never)
    vi.mocked(db.getAllServices).mockResolvedValue([] as never)
    vi.mocked(db.getAllServiceAddons).mockResolvedValue([] as never)

    const res = await app.request('/api/v1/service-catalog?all=1', {
      headers: authHeaders,
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      categories: [],
      services: [],
      addons: [],
      packages: [],
    })
    expect(db.getAllServiceCategories).toHaveBeenCalledWith('s1', false)
    expect(db.getAllServices).toHaveBeenCalledWith('s1', false)
    expect(db.getAllServiceAddons).toHaveBeenCalledWith('s1', false)
    expect(db.getAllServicePackages).not.toHaveBeenCalled()
  })
})
