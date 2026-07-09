import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@repo/database/catalog-presets', () => ({
  applyCatalogPreset: vi.fn(),
  listActiveCatalogPresets: vi.fn(),
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

import {
  applyCatalogPreset,
  listActiveCatalogPresets,
} from '@repo/database/catalog-presets'
import { auth as authServer } from '@repo/auth/server'
import { getManagerMemberForUser, getMemberForUser } from '@repo/database/members'
import { resolveStaffTenantContext } from '@repo/database/staff'

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
    organizationId: 'salon-1',
    role: 'owner',
    name: 'Manager',
    username: '09120000000',
  } as never)
  vi.mocked(getManagerMemberForUser).mockResolvedValue({
    userId: 'u1',
    organizationId: 'salon-1',
    role: 'owner',
    name: 'Manager',
    username: '09120000000',
  } as never)
})

describe('catalog presets router', () => {
  it('lists flattened categories and services without families', async () => {
    vi.mocked(listActiveCatalogPresets).mockResolvedValue([
      {
        id: 'preset-1',
        slug: 'hair',
        name: 'مو',
        description: null,
        tree: [
          {
            name: 'مو',
            services: [
              {
                name: 'کوتاهی مو',
                duration: 45,
                price: 450_000,
                color: 'coral',
              },
            ],
          },
        ],
        sortOrder: 10,
        disabled: false,
        disabledReason: null,
      },
    ] as never)

    const res = await app.request('/api/v1/catalog-presets', {
      headers: authHeaders,
    })

    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload).toEqual({
      presets: [
        expect.objectContaining({
          tree: [
            {
              name: 'مو',
              services: [
                {
                  name: 'کوتاهی مو',
                  duration: 45,
                  price: 450_000,
                  color: 'coral',
                },
              ],
            },
          ],
        }),
      ],
    })
    expect('families' in payload.presets[0].tree[0]).toBe(false)
  })

  it('applies flattened service-index selections', async () => {
    vi.mocked(applyCatalogPreset).mockResolvedValue({
      importedCategoryIds: ['category-1'],
      importedVariantIds: ['service-1'],
    })

    const res = await app.request('/api/v1/catalog-presets/preset-1/apply', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selection: [{ categoryIndex: 0, serviceIndices: [0] }],
      }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      importedCategoryIds: ['category-1'],
      importedVariantIds: ['service-1'],
    })
    expect(applyCatalogPreset).toHaveBeenCalledWith({
      salonId: 'salon-1',
      presetId: 'preset-1',
      selection: [{ categoryIndex: 0, serviceIndices: [0] }],
    })
  })

  it('rejects legacy family selections before apply', async () => {
    const res = await app.request('/api/v1/catalog-presets/preset-1/apply', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selection: [
          {
            categoryIndex: 0,
            families: [{ familyIndex: 0, variantIndices: [0] }],
          },
        ],
      }),
    })

    expect(res.status).toBe(400)
    expect(applyCatalogPreset).not.toHaveBeenCalled()
  })

  it('maps duplicate preset imports to conflict responses', async () => {
    vi.mocked(applyCatalogPreset).mockRejectedValue(
      new Error('catalog preset selection contains duplicate services'),
    )

    const res = await app.request('/api/v1/catalog-presets/preset-1/apply', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selection: [{ categoryIndex: 0, serviceIndices: [0] }],
      }),
    })

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      error: 'برخی از خدمات این قالب در سالن قبلاً ثبت شده‌اند',
    })
  })
})
