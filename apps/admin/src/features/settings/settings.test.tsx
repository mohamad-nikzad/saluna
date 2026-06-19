import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderAdminRoute } from '#/test/render-with-search-route'

const generated = vi.hoisted(() => ({
  listPlatformAdmins: vi.fn(),
  listUsers: vi.fn(),
  createPlatformAdmin: vi.fn(),
  updatePlatformAdmin: vi.fn(),
  authMe: vi.fn(),
}))

function mockAuthMe(
  options: {
    dataSource?: 'local' | 'live'
    role?:
      | 'platform_owner'
      | 'platform_admin'
      | 'platform_support'
      | 'platform_viewer'
  } = {},
) {
  generated.authMe.mockResolvedValue({
    user: {
      id: 'admin-user-id',
      userId: 'admin-user-id',
      name: 'Platform Owner',
      email: 'owner@saluna.test',
      phoneNumber: '+989120000000',
      username: 'owner',
      role: options.role ?? 'platform_owner',
      active: true,
    },
    runtime: { dataSource: options.dataSource ?? 'local' },
  })
}

vi.mock('@repo/api-client/query', () => ({
  getApiV1AdminAuthMeOptions: () => ({
    queryKey: ['admin-auth-me-test'],
    queryFn: () => generated.authMe(),
  }),
  getApiV1AdminPlatformAdminsOptions: (options: unknown) => ({
    queryKey: ['platform-admins', options],
    queryFn: () => generated.listPlatformAdmins(options),
  }),
  getApiV1AdminPlatformAdminsQueryKey: () => [{ _id: 'platform-admins' }],
  getApiV1AdminUsersOptions: (options: unknown) => ({
    queryKey: ['admin-users', options],
    queryFn: () => generated.listUsers(options),
  }),
  patchApiV1AdminPlatformAdminsByIdMutation: () => ({
    mutationFn: generated.updatePlatformAdmin,
  }),
  postApiV1AdminPlatformAdminsMutation: () => ({
    mutationFn: generated.createPlatformAdmin,
  }),
}))

function renderSettings(
  options: {
    dataSource?: 'local' | 'live'
    role?:
      | 'platform_owner'
      | 'platform_admin'
      | 'platform_support'
      | 'platform_viewer'
  } = {},
) {
  mockAuthMe(options)
  return renderAdminRoute('/settings')
}

const platformAdminUserId = '44444444-4444-4444-8444-444444444444'

describe('admin settings platform admins', () => {
  beforeEach(() => {
    generated.listPlatformAdmins.mockReset()
    generated.listUsers.mockReset()
    generated.createPlatformAdmin.mockReset()
    generated.updatePlatformAdmin.mockReset()
    mockAuthMe()
  })

  afterEach(() => {
    cleanup()
  })

  it.each([
    'platform_viewer',
    'platform_support',
    'platform_admin',
  ] as const)('redirects %s away from settings', async (role) => {
    const { router } = await renderSettings({ role })

    expect(router.state.location.pathname).toBe('/overview')
    expect(generated.listPlatformAdmins).not.toHaveBeenCalled()
  })

  it('lists and grants platform admin access from Settings with reason and live confirmation', async () => {
    generated.listPlatformAdmins.mockResolvedValue({
      items: [
        {
          id: 'platform-admin-1',
          userId: 'admin-user-id',
          name: 'Existing Admin',
          email: 'existing@saluna.test',
          phoneNumber: null,
          username: 'existing',
          role: 'platform_owner',
          active: true,
        },
      ],
      pagination: { page: 1, pageSize: 20, total: 1 },
    })
    generated.createPlatformAdmin.mockResolvedValue({
      admin: { id: 'platform-admin-2' },
    })
    generated.listUsers.mockResolvedValue({
      items: [
        {
          id: platformAdminUserId,
          name: 'Support User',
          email: 'support@saluna.test',
          phoneNumber: '+989120000001',
          username: 'support',
        },
      ],
      pagination: { page: 1, pageSize: 20, total: 1 },
    })

    await renderSettings({
      dataSource: 'live',
    })

    expect(await screen.findByText('ادمین‌های پلتفرم')).toBeTruthy()
    expect(await screen.findByText('Existing Admin')).toBeTruthy()
    expect(generated.listPlatformAdmins).toHaveBeenCalledWith({
      query: { page: 1, pageSize: 20, search: undefined },
    })

    fireEvent.click(screen.getByRole('button', { name: /اعطای دسترسی/ }))
    expect(
      screen.getByText(/این تغییر دسترسی روی داده LIVE تولید اعمال می‌شود/),
    ).toBeTruthy()

    fireEvent.change(screen.getByLabelText('کاربر'), {
      target: { value: 'support' },
    })

    await waitFor(() => {
      expect(generated.listUsers).toHaveBeenCalledWith({
        query: { page: 1, pageSize: 20, search: 'support' },
      })
    })

    fireEvent.click(await screen.findByRole('option', { name: /Support User/ }))
    fireEvent.change(screen.getByLabelText('نقش'), {
      target: { value: 'platform_support' },
    })
    fireEvent.change(screen.getByLabelText('دلیل'), {
      target: { value: 'Add support access' },
    })
    fireEvent.change(screen.getByLabelText('تأیید داده LIVE'), {
      target: { value: 'LIVE' },
    })
    fireEvent.click(screen.getByRole('button', { name: /ذخیره دسترسی/ }))

    await waitFor(() => {
      expect(generated.createPlatformAdmin).toHaveBeenCalled()
    })
    expect(generated.createPlatformAdmin.mock.calls[0]?.[0]).toEqual({
      body: {
        userId: platformAdminUserId,
        role: 'platform_support',
        active: true,
        reason: 'Add support access',
        liveConfirmation: 'LIVE',
      },
    })
  })
})
