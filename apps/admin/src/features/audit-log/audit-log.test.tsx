import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  locationSearch,
  renderAdminRoute,
} from '#/test/render-with-search-route'

const generated = vi.hoisted(() => ({
  listAuditLog: vi.fn(),
  authMe: vi.fn(),
}))

function mockAuthMe() {
  generated.authMe.mockResolvedValue({
    user: {
      id: 'admin-user-id',
      userId: 'admin-user-id',
      name: 'Platform Owner',
      email: 'owner@saluna.test',
      phoneNumber: '+989120000000',
      username: 'owner',
      role: 'platform_owner',
      active: true,
    },
    runtime: { dataSource: 'local' },
  })
}

vi.mock('@repo/api-client/query', () => ({
  getApiV1AdminAuthMeOptions: () => ({
    queryKey: ['admin-auth-me-test'],
    queryFn: () => generated.authMe(),
  }),
  getApiV1AdminAuditLogOptions: (options: unknown) => ({
    queryKey: ['audit-log', options],
    queryFn: () => generated.listAuditLog(options),
  }),
}))

describe('AuditLogScreen', () => {
  beforeEach(() => {
    generated.listAuditLog.mockReset()
    mockAuthMe()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders audit events from generated audit-log query options', async () => {
    generated.listAuditLog.mockResolvedValue({
      items: [
        {
          id: 'audit-1',
          actorName: 'Platform Owner',
          actorUserId: 'user-123456789',
          actorPlatformRole: 'platform_owner',
          action: 'salon.status.updated',
          targetType: 'salon',
          targetId: 'salon-123456789',
          salonId: 'salon-123456789',
          reason: 'Policy review',
          createdAt: '2026-06-18T10:30:00.000Z',
        },
      ],
      pagination: { page: 1, pageSize: 20, total: 1 },
    })

    await renderAdminRoute('/audit-log')

    expect(await screen.findByText('salon.status.updated')).toBeTruthy()
    expect(screen.getByText('Policy review')).toBeTruthy()
    expect(screen.getAllByText('Platform Owner').length).toBeGreaterThan(0)
    expect(screen.getByText('مالک')).toBeTruthy()
    expect(screen.getAllByText('salon-12').length).toBeGreaterThan(0)
    expect(generated.listAuditLog).toHaveBeenCalledWith({
      query: { page: 1, pageSize: 20 },
    })
  })

  it('syncs search and precise filters into generated query options and URL state', async () => {
    generated.listAuditLog.mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 20, total: 0 },
    })

    const { router } = await renderAdminRoute('/audit-log')

    await screen.findByText('نتیجه‌ای یافت نشد.')

    fireEvent.change(screen.getByPlaceholderText('جستجو در جدول...'), {
      target: { value: 'status' },
    })
    await waitFor(
      () => {
        expect(locationSearch(router)).toContain('q=status')
      },
      { timeout: 1000 },
    )
    fireEvent.change(screen.getByLabelText('عمل'), {
      target: { value: 'salon.status.updated' },
    })
    fireEvent.change(screen.getByLabelText('نوع هدف'), {
      target: { value: 'salon' },
    })
    fireEvent.change(screen.getByLabelText('شناسه هدف'), {
      target: { value: 'salon-1' },
    })
    fireEvent.change(screen.getByLabelText('شناسه سالن'), {
      target: { value: 'salon-1' },
    })

    await waitFor(
      () => {
        expect(generated.listAuditLog).toHaveBeenLastCalledWith({
          query: {
            page: 1,
            pageSize: 20,
            search: 'status',
            action: 'salon.status.updated',
            targetType: 'salon',
            targetId: 'salon-1',
            salonId: 'salon-1',
          },
        })
      },
      { timeout: 2000 },
    )
    const search = locationSearch(router)
    expect(search).toContain('q=status')
    expect(search).toContain('action=salon.status.updated')
    expect(search).toContain('targetType=salon')
    expect(search).toContain('targetId=salon-1')
    expect(search).toContain('salonId=salon-1')
  })

  it('uses URL pagination state and updates it from table pagination controls', async () => {
    generated.listAuditLog.mockResolvedValue({
      items: [],
      pagination: { page: 2, pageSize: 10, total: 25 },
    })

    const { router } = await renderAdminRoute('/audit-log?page=2&pageSize=10')

    expect(await screen.findByText('نمایش 11 تا 20 از 25')).toBeTruthy()
    expect(generated.listAuditLog).toHaveBeenCalledWith({
      query: { page: 2, pageSize: 10 },
    })

    fireEvent.click(screen.getByRole('button', { name: /بعدی/ }))

    await waitFor(() => {
      expect(generated.listAuditLog).toHaveBeenLastCalledWith({
        query: { page: 3, pageSize: 10 },
      })
    })
    const search = locationSearch(router)
    expect(search).toContain('page=3')
    expect(search).toContain('pageSize=10')
  })

  it('renders loading and error states', async () => {
    generated.listAuditLog.mockReturnValueOnce(new Promise(() => undefined))
    const { unmount } = await renderAdminRoute('/audit-log')

    expect(screen.getByLabelText('در حال بارگذاری گزارش ممیزی')).toBeTruthy()
    unmount()

    generated.listAuditLog.mockReset()
    generated.listAuditLog.mockRejectedValue(new Error('network failed'))
    await renderAdminRoute('/audit-log')

    await waitFor(() => {
      expect(screen.getByText('بارگذاری گزارش ممیزی ناموفق بود.')).toBeTruthy()
    })
  })
})
