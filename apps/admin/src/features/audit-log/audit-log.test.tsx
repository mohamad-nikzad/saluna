import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AuditLogScreen } from './index'

const generated = vi.hoisted(() => ({
  listAuditLog: vi.fn(),
}))

vi.mock('@repo/api-client/query', () => ({
  getApiV1AdminAuditLogOptions: (options: unknown) => ({
    queryKey: ['audit-log', options],
    queryFn: () => generated.listAuditLog(options),
  }),
}))

function renderWithQueryClient(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
  )
}

describe('AuditLogScreen', () => {
  beforeEach(() => {
    generated.listAuditLog.mockReset()
    window.history.replaceState(null, '', '/audit-log')
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
          reason: 'بررسی تخلف',
          createdAt: '2026-06-18T10:30:00.000Z',
        },
      ],
      pagination: { page: 1, pageSize: 20, total: 1 },
    })

    renderWithQueryClient(<AuditLogScreen />)

    expect(await screen.findByText('salon.status.updated')).toBeTruthy()
    expect(screen.getByText('بررسی تخلف')).toBeTruthy()
    expect(screen.getByText('Platform Owner')).toBeTruthy()
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

    renderWithQueryClient(<AuditLogScreen />)

    await screen.findByText('موردی پیدا نشد.')

    fireEvent.change(screen.getByPlaceholderText('جستجو در جدول...'), {
      target: { value: 'status' },
    })
    fireEvent.change(screen.getByLabelText('Action'), {
      target: { value: 'salon.status.updated' },
    })
    fireEvent.change(screen.getByLabelText('Target type'), {
      target: { value: 'salon' },
    })
    fireEvent.change(screen.getByLabelText('Target ID'), {
      target: { value: 'salon-1' },
    })
    fireEvent.change(screen.getByLabelText('Salon ID'), {
      target: { value: 'salon-1' },
    })

    await waitFor(() => {
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
    })
    expect(window.location.search).toContain('q=status')
    expect(window.location.search).toContain('action=salon.status.updated')
    expect(window.location.search).toContain('targetType=salon')
    expect(window.location.search).toContain('targetId=salon-1')
    expect(window.location.search).toContain('salonId=salon-1')
  })

  it('uses URL pagination state and updates it from table pagination controls', async () => {
    window.history.replaceState(null, '', '/audit-log?page=2&pageSize=10')
    generated.listAuditLog.mockResolvedValue({
      items: [],
      pagination: { page: 2, pageSize: 10, total: 25 },
    })

    renderWithQueryClient(<AuditLogScreen />)

    expect(await screen.findByText('صفحه 2 از 3')).toBeTruthy()
    expect(generated.listAuditLog).toHaveBeenCalledWith({
      query: { page: 2, pageSize: 10 },
    })

    fireEvent.click(screen.getByRole('button', { name: /بعدی/ }))

    await waitFor(() => {
      expect(generated.listAuditLog).toHaveBeenLastCalledWith({
        query: { page: 3, pageSize: 10 },
      })
    })
    expect(window.location.search).toContain('page=3')
    expect(window.location.search).toContain('pageSize=10')
  })

  it('renders loading and error states', async () => {
    generated.listAuditLog.mockReturnValueOnce(new Promise(() => undefined))
    const { unmount } = renderWithQueryClient(<AuditLogScreen />)

    expect(screen.getByLabelText('در حال دریافت لاگ ممیزی')).toBeTruthy()
    unmount()

    generated.listAuditLog.mockReset()
    generated.listAuditLog.mockRejectedValue(new Error('network failed'))
    renderWithQueryClient(<AuditLogScreen />)

    await waitFor(() => {
      expect(screen.getByText('بارگذاری لاگ ممیزی انجام نشد.')).toBeTruthy()
    })
  })
})
