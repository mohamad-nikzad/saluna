import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

import { AdminAuthProvider } from '#/context/admin-auth-provider'

import { AdminPage } from './admin-page'

const generated = vi.hoisted(() => ({
  listPlatformAdmins: vi.fn(),
  createPlatformAdmin: vi.fn(),
  updatePlatformAdmin: vi.fn(),
}))

vi.mock('@repo/api-client/query', () => ({
  getApiV1AdminAuditLogOptions: () => ({
    queryKey: ['audit-log'],
    queryFn: () =>
      Promise.resolve({
        items: [],
        pagination: { page: 1, pageSize: 20, total: 0 },
      }),
  }),
  getApiV1AdminCatalogPresetsOptions: () => ({
    queryKey: ['catalog-presets'],
    queryFn: () =>
      Promise.resolve({
        items: [],
        pagination: { page: 1, pageSize: 20, total: 0 },
      }),
  }),
  getApiV1AdminCatalogPresetsQueryKey: () => [{ _id: 'catalog-presets' }],
  getApiV1AdminMessagingHealthOptions: () => ({
    queryKey: ['messaging-health'],
    queryFn: () => Promise.resolve({}),
  }),
  getApiV1AdminNotificationsDeliveriesOptions: () => ({
    queryKey: ['notification-deliveries'],
    queryFn: () =>
      Promise.resolve({
        items: [],
        pagination: { page: 1, pageSize: 20, total: 0 },
      }),
  }),
  getApiV1AdminOverviewQueryKey: () => [{ _id: 'overview' }],
  getApiV1AdminPlatformAdminsOptions: (options: unknown) => ({
    queryKey: ['platform-admins', options],
    queryFn: () => generated.listPlatformAdmins(options),
  }),
  getApiV1AdminPlatformAdminsQueryKey: () => [{ _id: 'platform-admins' }],
  getApiV1AdminSalonsByIdNotesOptions: () => ({
    queryKey: ['salon-notes'],
    queryFn: () => Promise.resolve({ notes: [] }),
  }),
  getApiV1AdminSalonsByIdNotesQueryKey: () => [{ _id: 'salon-notes' }],
  getApiV1AdminSalonsByIdOptions: () => ({
    queryKey: ['salon-detail'],
    queryFn: () => Promise.resolve({ salon: {}, members: [], stats: {} }),
  }),
  getApiV1AdminSalonsByIdQueryKey: () => [{ _id: 'salon-detail' }],
  getApiV1AdminSalonsOptions: () => ({
    queryKey: ['salons'],
    queryFn: () =>
      Promise.resolve({
        items: [],
        pagination: { page: 1, pageSize: 20, total: 0 },
      }),
  }),
  getApiV1AdminSalonsQueryKey: () => [{ _id: 'salons' }],
  getApiV1AdminSupportAppointmentRequestsOptions: () => ({
    queryKey: ['support-appointment-requests'],
    queryFn: () =>
      Promise.resolve({
        items: [],
        pagination: { page: 1, pageSize: 20, total: 0 },
      }),
  }),
  getApiV1AdminSupportAppointmentsOptions: () => ({
    queryKey: ['support-appointments'],
    queryFn: () =>
      Promise.resolve({
        items: [],
        pagination: { page: 1, pageSize: 20, total: 0 },
      }),
  }),
  getApiV1AdminUsersByIdNotesOptions: () => ({
    queryKey: ['user-notes'],
    queryFn: () => Promise.resolve({ notes: [] }),
  }),
  getApiV1AdminUsersByIdOptions: () => ({
    queryKey: ['user-detail'],
    queryFn: () => Promise.resolve({ user: {}, salons: [] }),
  }),
  getApiV1AdminUsersOptions: () => ({
    queryKey: ['users'],
    queryFn: () =>
      Promise.resolve({
        items: [],
        pagination: { page: 1, pageSize: 20, total: 0 },
      }),
  }),
  patchApiV1AdminCatalogPresetsByIdMutation: () => ({
    mutationFn: vi.fn(),
  }),
  patchApiV1AdminPlatformAdminsByIdMutation: () => ({
    mutationFn: generated.updatePlatformAdmin,
  }),
  patchApiV1AdminSalonsByIdStatusMutation: () => ({
    mutationFn: vi.fn(),
  }),
  postApiV1AdminCatalogPresetsMutation: () => ({
    mutationFn: vi.fn(),
  }),
  postApiV1AdminPlatformAdminsMutation: () => ({
    mutationFn: generated.createPlatformAdmin,
  }),
  postApiV1AdminSalonsByIdNotesMutation: () => ({
    mutationFn: vi.fn(),
  }),
  postApiV1AdminUsersByIdNotesMutation: () => ({
    mutationFn: vi.fn(),
  }),
}))

function renderWithProviders(
  children: ReactNode,
  options: {
    dataSource?: 'local' | 'live'
    role?:
      | 'platform_owner'
      | 'platform_admin'
      | 'platform_support'
      | 'platform_viewer'
  } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <AdminAuthProvider
        me={{
          id: 'admin-user-id',
          userId: 'admin-user-id',
          name: 'Platform Owner',
          email: 'owner@saluna.test',
          phoneNumber: '+989120000000',
          username: 'owner',
          role: options.role ?? 'platform_owner',
          active: true,
        }}
        runtime={{ dataSource: options.dataSource ?? 'local' }}
      >
        {children}
      </AdminAuthProvider>
    </QueryClientProvider>,
  )
}

const platformAdminUserId = '44444444-4444-4444-8444-444444444444'

describe('admin settings platform admins', () => {
  beforeEach(() => {
    generated.listPlatformAdmins.mockReset()
    generated.createPlatformAdmin.mockReset()
    generated.updatePlatformAdmin.mockReset()
    window.history.replaceState(null, '', '/settings')
  })

  afterEach(() => {
    cleanup()
  })

  it('shows Platform Admins only to platform owners', async () => {
    generated.listPlatformAdmins.mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 20, total: 0 },
    })

    renderWithProviders(<AdminPage pageId="settings" />, {
      role: 'platform_admin',
    })

    expect(screen.queryByText('Platform Admins')).toBeNull()
    expect(generated.listPlatformAdmins).not.toHaveBeenCalled()
    expect(
      screen.getByText(/PLATFORM_ADMIN_BOOTSTRAP_PHONES/),
    ).toBeTruthy()
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

    renderWithProviders(<AdminPage pageId="settings" />, {
      dataSource: 'live',
    })

    expect(await screen.findByText('Platform Admins')).toBeTruthy()
    expect(await screen.findByText('Existing Admin')).toBeTruthy()
    expect(generated.listPlatformAdmins).toHaveBeenCalledWith({
      query: { page: 1, pageSize: 20, search: undefined },
    })

    fireEvent.click(screen.getByRole('button', { name: /اعطای دسترسی/ }))
    expect(
      screen.getByText(/این تغییر دسترسی ادمین روی داده زنده تولید اعمال می‌شود/),
    ).toBeTruthy()

    fireEvent.change(screen.getByLabelText('شناسه کاربر'), {
      target: { value: platformAdminUserId },
    })
    fireEvent.change(screen.getByLabelText('نقش'), {
      target: { value: 'platform_support' },
    })
    fireEvent.change(screen.getByLabelText('دلیل'), {
      target: { value: 'افزودن دسترسی پشتیبانی' },
    })
    fireEvent.change(screen.getByLabelText('تأیید داده زنده'), {
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
        reason: 'افزودن دسترسی پشتیبانی',
        liveConfirmation: 'LIVE',
      },
    })
  })
})
