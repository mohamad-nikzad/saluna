import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderAdminRoute } from '#/test/render-with-search-route'

const authMe = vi.hoisted(() => vi.fn())

vi.mock('@repo/api-client/query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@repo/api-client/query')>()

  return {
    ...actual,
    getApiV1AdminAuthMeOptions: () => ({
      queryKey: ['admin-auth-me-route-guard-test'],
      queryFn: () => authMe(),
    }),
  }
})

function mockAuthRole(
  role:
    | 'platform_owner'
    | 'platform_admin'
    | 'platform_support'
    | 'platform_viewer',
) {
  authMe.mockResolvedValue({
    user: {
      id: 'admin-user-id',
      userId: 'admin-user-id',
      name: 'Admin User',
      email: 'admin@saluna.test',
      phoneNumber: null,
      username: 'admin',
      role,
      active: true,
    },
    runtime: { dataSource: 'local' },
  })
}

describe('admin route guards', () => {
  beforeEach(() => {
    authMe.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('redirects platform viewers away from settings', async () => {
    mockAuthRole('platform_viewer')

    const { router } = await renderAdminRoute('/settings')

    expect(router.state.location.pathname).toBe('/overview')
  })

  it('redirects platform admins away from settings', async () => {
    mockAuthRole('platform_admin')

    const { router } = await renderAdminRoute('/settings')

    expect(router.state.location.pathname).toBe('/overview')
  })

  it('redirects platform viewers away from catalog presets', async () => {
    mockAuthRole('platform_viewer')

    const { router } = await renderAdminRoute('/catalog-presets')

    expect(router.state.location.pathname).toBe('/overview')
  })

  it('allows platform owners to open settings', async () => {
    mockAuthRole('platform_owner')

    const { router } = await renderAdminRoute('/settings')

    expect(router.state.location.pathname).toBe('/settings')
  })

  it('allows platform admins to open catalog presets', async () => {
    mockAuthRole('platform_admin')

    const { router } = await renderAdminRoute('/catalog-presets')

    expect(router.state.location.pathname).toBe('/catalog-presets')
  })
})
