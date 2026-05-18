import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@repo/database/services', () => ({
  getAllServices: vi.fn(),
  createService: vi.fn(),
  getServiceById: vi.fn(),
  updateService: vi.fn(),
  getActiveServiceAddonsForService: vi.fn(),
  getComboComponents: vi.fn(),
  replaceComboComponents: vi.fn(),
  importStarterServiceTemplates: vi.fn(),
}))

vi.mock('@repo/database/clients', () => ({
  isClientProvidedEntityId: (id: string | undefined) =>
    typeof id === 'string' && id.length > 0,
}))

vi.mock('@repo/auth/auth', () => ({
  verifySession: vi.fn(),
}))

vi.mock('@repo/database/auth-users', () => ({
  getUserById: vi.fn(),
}))

import * as db from '@repo/database/services'
import { verifySession } from '@repo/auth/auth'
import { getUserById } from '@repo/database/auth-users'

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
  familyId: 'fam1',
  duration: 30,
  price: 100000,
  color: 'staff-1',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(verifySession).mockResolvedValue('u1')
  vi.mocked(getUserById).mockResolvedValue(managerUser as never)
})

describe('services router', () => {
  it('returns 401 without auth', async () => {
    const res = await app.request('/api/v1/services')
    expect(res.status).toBe(401)
  })

  it('staff sees active-only with all=1', async () => {
    vi.mocked(getUserById).mockResolvedValue(staffUser as never)
    vi.mocked(db.getAllServices).mockResolvedValue([] as never)
    await app.request('/api/v1/services?all=1', { headers: authHeaders })
    expect(db.getAllServices).toHaveBeenCalledWith('s1', false)
  })

  it('manager includes inactive with all=1', async () => {
    vi.mocked(db.getAllServices).mockResolvedValue([{ id: 's1' }] as never)
    const res = await app.request('/api/v1/services?all=1', { headers: authHeaders })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ services: [{ id: 's1' }] })
    expect(db.getAllServices).toHaveBeenCalledWith('s1', true)
  })

  it('staff is 403 on POST', async () => {
    vi.mocked(getUserById).mockResolvedValue(staffUser as never)
    const res = await app.request('/api/v1/services', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(validCreate),
    })
    expect(res.status).toBe(403)
  })

  it('400 when familyId missing on create', async () => {
    const res = await app.request('/api/v1/services', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validCreate, familyId: undefined }),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'گروه خدمات را انتخاب کنید' })
  })

  it('200 on create', async () => {
    vi.mocked(db.createService).mockResolvedValue({ id: 'svc1', name: 'Haircut' } as never)
    const res = await app.request('/api/v1/services', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(validCreate),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ service: { id: 'svc1', name: 'Haircut' } })
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

  it('400 when active combo missing components on create', async () => {
    vi.mocked(db.createService).mockRejectedValue(
      new Error('active combo service must have at least one component'),
    )
    const res = await app.request('/api/v1/services', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validCreate, kind: 'combo' }),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: 'پکیج فعال باید حداقل یک خدمت در ترکیب خود داشته باشد',
    })
  })

  it('200 on GET /:id', async () => {
    vi.mocked(db.getServiceById).mockResolvedValue({ id: 'svc1' } as never)
    const res = await app.request('/api/v1/services/svc1', { headers: authHeaders })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ service: { id: 'svc1' } })
  })

  it('404 on GET /:id missing', async () => {
    vi.mocked(db.getServiceById).mockResolvedValue(undefined as never)
    const res = await app.request('/api/v1/services/missing', { headers: authHeaders })
    expect(res.status).toBe(404)
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

  it('200 on GET /:id/combo-components', async () => {
    vi.mocked(db.getComboComponents).mockResolvedValue({
      comboServiceId: 'svc1',
      components: [],
      totalDuration: 0,
      totalPrice: 0,
    } as never)
    const res = await app.request('/api/v1/services/svc1/combo-components', {
      headers: authHeaders,
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      combo: {
        comboServiceId: 'svc1',
        components: [],
        totalDuration: 0,
        totalPrice: 0,
      },
    })
  })

  it('404 on GET /:id/combo-components missing', async () => {
    vi.mocked(db.getComboComponents).mockResolvedValue(undefined as never)
    const res = await app.request('/api/v1/services/missing/combo-components', {
      headers: authHeaders,
    })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'پکیج یافت نشد' })
  })

  it('staff is 403 on PUT /:id/combo-components', async () => {
    vi.mocked(getUserById).mockResolvedValue(staffUser as never)
    const res = await app.request('/api/v1/services/svc1/combo-components', {
      method: 'PUT',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ componentServiceIds: ['x'] }),
    })
    expect(res.status).toBe(403)
  })

  it('200 on PUT /:id/combo-components', async () => {
    vi.mocked(db.replaceComboComponents).mockResolvedValue({
      comboServiceId: 'svc1',
      components: [{ id: 'c1' }],
      totalDuration: 30,
      totalPrice: 1000,
    } as never)
    const res = await app.request('/api/v1/services/svc1/combo-components', {
      method: 'PUT',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ componentServiceIds: ['c1'] }),
    })
    expect(res.status).toBe(200)
  })

  it('maps combo-cannot-contain-itself to 400', async () => {
    vi.mocked(db.replaceComboComponents).mockRejectedValue(
      new Error('combo service cannot contain itself'),
    )
    const res = await app.request('/api/v1/services/svc1/combo-components', {
      method: 'PUT',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ componentServiceIds: ['svc1'] }),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'پکیج نمی‌تواند شامل خودش باشد' })
  })

  it('maps combo-duplicates to 400', async () => {
    vi.mocked(db.replaceComboComponents).mockRejectedValue(
      new Error('combo components cannot contain duplicates'),
    )
    const res = await app.request('/api/v1/services/svc1/combo-components', {
      method: 'PUT',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ componentServiceIds: ['a', 'a'] }),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: 'هر خدمت فقط یک بار می‌تواند در پکیج باشد',
    })
  })

  it('staff is 403 on POST /import-starter-templates', async () => {
    vi.mocked(getUserById).mockResolvedValue(staffUser as never)
    const res = await app.request('/api/v1/services/import-starter-templates', {
      method: 'POST',
      headers: authHeaders,
    })
    expect(res.status).toBe(403)
  })

  it('200 on POST /import-starter-templates', async () => {
    vi.mocked(db.importStarterServiceTemplates).mockResolvedValue({
      categories: [],
      families: [],
      services: [],
    } as never)
    const res = await app.request('/api/v1/services/import-starter-templates', {
      method: 'POST',
      headers: authHeaders,
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ categories: [], families: [], services: [] })
  })
})
