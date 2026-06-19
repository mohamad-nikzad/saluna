import { QueryClient } from '@tanstack/react-query'
import { redirect } from '@tanstack/react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { requirePermission } from '#/lib/platform-rbac'

const authMe = vi.hoisted(() => vi.fn())

vi.mock('@repo/api-client/query', () => ({
  getApiV1AdminAuthMeOptions: () => ({
    queryKey: ['admin-auth-me-rbac-test'],
    queryFn: () => authMe(),
  }),
}))

function mockAuthRole(
  role:
    | 'platform_owner'
    | 'platform_admin'
    | 'platform_support'
    | 'platform_viewer',
) {
  authMe.mockResolvedValue({
    user: {
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

describe('requirePermission', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    authMe.mockReset()
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
  })

  it('allows owners to manage platform admins', async () => {
    mockAuthRole('platform_owner')

    await expect(
      requirePermission(queryClient, 'manage_platform_admins'),
    ).resolves.toBeUndefined()
  })

  it('redirects viewers away from owner-only settings access', async () => {
    mockAuthRole('platform_viewer')

    await expect(
      requirePermission(queryClient, 'manage_platform_admins'),
    ).rejects.toEqual(redirect({ to: '/overview' }))
  })

  it('redirects viewers away from catalog preset management', async () => {
    mockAuthRole('platform_viewer')

    await expect(
      requirePermission(queryClient, 'manage_catalog_presets'),
    ).rejects.toEqual(redirect({ to: '/overview' }))
  })

  it('allows admins to manage catalog presets', async () => {
    mockAuthRole('platform_admin')

    await expect(
      requirePermission(queryClient, 'manage_catalog_presets'),
    ).resolves.toBeUndefined()
  })
})
