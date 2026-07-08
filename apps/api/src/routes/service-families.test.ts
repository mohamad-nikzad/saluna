import { describe, expect, it, vi } from 'vitest'

vi.mock('@repo/auth/server', () => ({
  auth: { api: { getSession: vi.fn() } },
}))

vi.mock('@repo/database/members', () => ({
  getMemberForUser: vi.fn(),
}))

vi.mock('@repo/database/services', () => ({
  getAllServiceFamilies: vi.fn(),
  getAllServiceCategories: vi.fn(),
  getAllServices: vi.fn(),
  getAllServiceAddons: vi.fn(),
  getAllServicePackages: vi.fn(),
  createServiceFamily: vi.fn(),
  updateServiceFamily: vi.fn(),
}))

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgres://stub'
process.env.JWT_SECRET = 'test-secret'

const { app } = await import('../app')

describe('service-families route removal', () => {
  it('does not mount /api/v1/service-families', async () => {
    const res = await app.request('/api/v1/service-families', {
      headers: { Authorization: 'Bearer testtoken' },
    })

    expect(res.status).toBe(404)
  })

  it('does not mount service-family mutations', async () => {
    const res = await app.request('/api/v1/service-families/fam1', {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer testtoken',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Legacy group' }),
    })

    expect(res.status).toBe(404)
  })
})
