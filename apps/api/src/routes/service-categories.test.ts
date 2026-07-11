import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@repo/database/services', () => ({
  getAllServiceCategories: vi.fn(),
  createServiceCategory: vi.fn(),
  updateServiceCategory: vi.fn(),
  getAllServiceFamilies: vi.fn(),
  createServiceFamily: vi.fn(),
  updateServiceFamily: vi.fn(),
  getAllServiceAddons: vi.fn(),
  getAllServicePackages: vi.fn(),
  getAllServices: vi.fn(),
  createServiceAddon: vi.fn(),
  updateServiceAddon: vi.fn(),
}))

vi.mock('@repo/database/clients', () => ({
  isClientProvidedEntityId: (id: string | undefined) =>
    typeof id === 'string' && id.length > 0,
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

import * as db from '@repo/database/services'
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

const managerUser = {
  id: 'u1',
  salonId: 's1',
  role: 'manager' as const,
  name: 'Manager',
  phone: '09120000000',
  createdAt: new Date(),
}

const staffUser = {
  ...managerUser,
  id: 'u2',
  role: 'staff' as const,
}

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
  vi.mocked(getManagerMemberForUser).mockResolvedValue({
    userId: 'u1',
    organizationId: 's1',
    role: 'owner',
    name: 'Manager',
    username: '09120000000',
  } as never)
})

describe('service-categories router', () => {
  it('returns 401 without auth', async () => {
    const res = await app.request('/api/v1/service-categories')
    expect(res.status).toBe(401)
  })

  it('returns active-only list for staff even with all=1', async () => {
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
    vi.mocked(db.getAllServiceCategories).mockResolvedValue([] as never)
    const res = await app.request('/api/v1/service-categories?all=1', {
      headers: authHeaders,
    })
    expect(res.status).toBe(200)
    expect(db.getAllServiceCategories).toHaveBeenCalledWith('s1', false)
  })

  it('includes inactive for manager with all=1', async () => {
    vi.mocked(db.getAllServiceCategories).mockResolvedValue([
      { id: 'c1' },
    ] as never)
    const res = await app.request('/api/v1/service-categories?all=1', {
      headers: authHeaders,
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ categories: [{ id: 'c1' }] })
    expect(db.getAllServiceCategories).toHaveBeenCalledWith('s1', true)
  })

  it('returns 403 for staff on POST', async () => {
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
    const res = await app.request('/api/v1/service-categories', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hair' }),
    })
    expect(res.status).toBe(403)
  })

  it('returns 400 on invalid create body', async () => {
    const res = await app.request('/api/v1/service-categories', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 200 on successful create', async () => {
    vi.mocked(db.createServiceCategory).mockResolvedValue({
      id: 'c1',
      name: 'Hair',
    } as never)
    const res = await app.request('/api/v1/service-categories', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hair' }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ category: { id: 'c1', name: 'Hair' } })
  })

  it('returns 409 on duplicate name', async () => {
    vi.mocked(db.createServiceCategory).mockRejectedValue(
      new Error('duplicate key value'),
    )
    const res = await app.request('/api/v1/service-categories', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hair' }),
    })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      error: 'این نام بخش برای این سالن قبلاً ثبت شده است',
    })
  })

  it('returns 404 on PATCH of missing category', async () => {
    vi.mocked(db.updateServiceCategory).mockResolvedValue(undefined as never)
    const res = await app.request('/api/v1/service-categories/missing', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New' }),
    })
    expect(res.status).toBe(404)
  })
})
