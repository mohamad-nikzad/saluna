import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@repo/database/services', () => ({
  getAllServices: vi.fn(),
  createService: vi.fn(),
  getServiceById: vi.fn(),
  updateService: vi.fn(),
  getActiveServiceAddonsForService: vi.fn(),
  importStarterServiceTemplates: vi.fn(),
}))

vi.mock('@repo/database/clients', () => ({
  isClientProvidedEntityId: (id: string | undefined) =>
    typeof id === 'string' && id.length > 0,
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

const managerUser = {
  id: 'u1',
  salonId: 's1',
  role: 'manager' as const,
  name: 'Manager',
  phone: '09120000000',
  createdAt: new Date(),
}

const staffUser = { ...managerUser, id: 'u2', role: 'staff' as const }

const authHeaders = { Authorization: 'Bearer testtoken' }

const validCreate = {
  name: 'Haircut',
  categoryId: 'cat1',
  duration: 30,
  price: 100000,
  color: 'staff-1',
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
})

describe('services router', () => {
  it('returns 401 without auth', async () => {
    const res = await app.request('/api/v1/services')
    expect(res.status).toBe(401)
  })

  it('staff sees active-only with all=1', async () => {
    vi.mocked(getMemberForUser).mockResolvedValue({
      userId: 'u2',
      organizationId: 's1',
      role: 'member',
      name: 'Staff',
      username: '09120000001',
    } as never)
    vi.mocked(db.getAllServices).mockResolvedValue([] as never)
    await app.request('/api/v1/services?all=1', { headers: authHeaders })
    expect(db.getAllServices).toHaveBeenCalledWith('s1', false)
  })

  it('manager includes inactive with all=1', async () => {
    vi.mocked(db.getAllServices).mockResolvedValue([{ id: 's1' }] as never)
    const res = await app.request('/api/v1/services?all=1', {
      headers: authHeaders,
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ services: [{ id: 's1' }] })
    expect(db.getAllServices).toHaveBeenCalledWith('s1', true)
  })

  it('staff is 403 on POST', async () => {
    vi.mocked(getMemberForUser).mockResolvedValue({
      userId: 'u2',
      organizationId: 's1',
      role: 'member',
      name: 'Staff',
      username: '09120000001',
    } as never)
    const res = await app.request('/api/v1/services', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(validCreate),
    })
    expect(res.status).toBe(403)
  })

  it('400 when categoryId missing on create', async () => {
    const res = await app.request('/api/v1/services', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validCreate, categoryId: undefined }),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'بخش خدمات را انتخاب کنید' })
  })

  it('200 on create', async () => {
    vi.mocked(db.createService).mockResolvedValue({
      id: 'svc1',
      name: 'Haircut',
    } as never)
    const res = await app.request('/api/v1/services', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(validCreate),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      service: { id: 'svc1', name: 'Haircut' },
    })
  })

  it('strips legacy familyId and kind on create', async () => {
    vi.mocked(db.createService).mockResolvedValue({
      id: 'svc1',
      name: 'Haircut',
    } as never)
    const res = await app.request('/api/v1/services', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validCreate, familyId: 'fam1', kind: 'combo' }),
    })
    expect(res.status).toBe(200)
    expect(db.createService).toHaveBeenCalledWith(
      expect.not.objectContaining({
        familyId: expect.anything(),
        kind: expect.anything(),
      }),
    )
  })

  it('409 on duplicate name', async () => {
    vi.mocked(db.createService).mockRejectedValue(new Error('unique violation'))
    const res = await app.request('/api/v1/services', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(validCreate),
    })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      error: 'این نام خدمت برای این سالن قبلاً ثبت شده است',
    })
  })

  it('200 on GET /:id', async () => {
    vi.mocked(db.getServiceById).mockResolvedValue({ id: 'svc1' } as never)
    const res = await app.request('/api/v1/services/svc1', {
      headers: authHeaders,
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ service: { id: 'svc1' } })
  })

  it('404 on GET /:id missing', async () => {
    vi.mocked(db.getServiceById).mockResolvedValue(undefined as never)
    const res = await app.request('/api/v1/services/missing', {
      headers: authHeaders,
    })
    expect(res.status).toBe(404)
  })

  it('PATCH strips legacy familyId and kind from the patch', async () => {
    vi.mocked(db.updateService).mockResolvedValue({ id: 'svc1' } as never)
    const res = await app.request('/api/v1/services/svc1', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ familyId: null, kind: 'combo', name: 'Renamed' }),
    })
    expect(res.status).toBe(200)
    const patch = vi.mocked(db.updateService).mock.calls[0]?.[2] as Record<
      string,
      unknown
    >
    expect('familyId' in patch).toBe(false)
    expect('kind' in patch).toBe(false)
    expect(patch.name).toBe('Renamed')
  })

  it('404 on PATCH missing', async () => {
    vi.mocked(db.updateService).mockResolvedValue(undefined as never)
    const res = await app.request('/api/v1/services/missing', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New' }),
    })
    expect(res.status).toBe(404)
  })

  it('200 on GET /:id/addons', async () => {
    vi.mocked(db.getActiveServiceAddonsForService).mockResolvedValue([
      { id: 'a1' },
    ] as never)
    const res = await app.request('/api/v1/services/svc1/addons', {
      headers: authHeaders,
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ addons: [{ id: 'a1' }] })
  })

  it('404 on GET /:id/combo-components because combo contracts are removed', async () => {
    const res = await app.request('/api/v1/services/svc1/combo-components', {
      headers: authHeaders,
    })
    expect(res.status).toBe(404)
  })

  it('404 on PUT /:id/combo-components because combo contracts are removed', async () => {
    const res = await app.request('/api/v1/services/svc1/combo-components', {
      method: 'PUT',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ componentServiceIds: ['x'] }),
    })
    expect(res.status).toBe(404)
  })

  it('staff is 403 on POST /import-starter-templates', async () => {
    vi.mocked(getMemberForUser).mockResolvedValue({
      userId: 'u2',
      organizationId: 's1',
      role: 'member',
      name: 'Staff',
      username: '09120000001',
    } as never)
    const res = await app.request('/api/v1/services/import-starter-templates', {
      method: 'POST',
      headers: authHeaders,
    })
    expect(res.status).toBe(403)
  })

  it('200 on POST /import-starter-templates', async () => {
    vi.mocked(db.importStarterServiceTemplates).mockResolvedValue({
      categories: [],
      services: [],
    } as never)
    const res = await app.request('/api/v1/services/import-starter-templates', {
      method: 'POST',
      headers: authHeaders,
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ categories: [], services: [] })
  })
})
