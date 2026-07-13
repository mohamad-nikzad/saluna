// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Client, Service, User } from '@repo/salon-core/types'

const mutateAsync = vi.fn(async (values: unknown) => values)

vi.mock('#/components/form-sheet', () => ({
  FormSheet: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  FormSheetContent: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  FormSheetHeader: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  FormSheetTitle: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  FormSheetFooter: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))
vi.mock('#/components/calendar/appointment-client-field', () => ({
  AppointmentClientField: ({ clientId }: { clientId: string }) => (
    <output data-testid="client-id">{clientId}</output>
  ),
}))
vi.mock('#/components/calendar/staff-picker', () => ({
  StaffPicker: ({ value }: { value?: string }) => (
    <output data-testid="staff-id">{value}</output>
  ),
}))
vi.mock('#/components/services/service-picker', () => ({
  ServicePicker: ({ value }: { value?: string }) => (
    <output data-testid="service-id">{value}</output>
  ),
}))
vi.mock('#/components/calendar/package-booking-form', () => ({
  PackageBookingForm: () => null,
}))
vi.mock('@repo/ui/jalali-date-picker', () => ({
  JalaliDatePicker: ({ value }: { value: string }) => (
    <output data-testid="date">{value}</output>
  ),
}))
vi.mock('@repo/ui/time-picker', () => ({
  TimePicker: ({ id, value }: { id?: string; value: string }) => (
    <output data-testid={`time-${id}`}>{value}</output>
  ),
}))
vi.mock('#/lib/use-dismiss-guard', () => ({
  useDismissGuard: ({ onClose }: { onClose: () => void }) => ({
    requestClose: onClose,
    confirmDialog: null,
  }),
}))
vi.mock('#/lib/use-service-addons', () => ({
  useServiceAddons: () => ({
    data: [
      {
        id: 'addon-1',
        name: 'رنگ',
        priceDelta: 20_000,
        durationDelta: 10,
        active: true,
        scopes: [],
      },
    ],
    isPending: false,
  }),
}))
vi.mock('#/lib/appointment-surface', () => ({
  tomansFormatter: new Intl.NumberFormat('fa-IR'),
  useStaffBookingAvailability: () => ({ 'staff-1': true }),
}))
vi.mock('#/lib/use-appointment-intake-mutations', () => ({
  useAppointmentIntakeMutations: () => ({
    createAppointment: { mutateAsync, isPending: false },
  }),
}))

const { AppointmentDrawer } = await import('./appointment-drawer')

afterEach(() => {
  cleanup()
  mutateAsync.mockClear()
})

describe('AppointmentDrawer final price', () => {
  it('submits a manager-entered price instead of the calculated default', async () => {
    const service = {
      id: 'service-1',
      name: 'کوتاهی',
      category: 'hair',
      categoryId: 'category-1',
      color: 'rose',
      duration: 45,
      price: 100_000,
      active: true,
    } as Service
    const staff = {
      id: 'staff-1',
      role: 'staff',
      name: 'پرسنل',
      serviceIds: ['service-1'],
    } as User
    const client = { id: 'client-1', name: 'سارا' } as Client

    const props = {
      onOpenChange: vi.fn(),
      initialDate: '2026-06-02',
      initialTime: '10:00',
      initialStaffId: staff.id,
      initialServiceId: service.id,
      initialClientId: client.id,
      staff: [staff],
      services: [service],
      clients: [client],
      onSuccess: vi.fn(),
    }
    const view = render(<AppointmentDrawer {...props} open={false} />)
    view.rerender(<AppointmentDrawer {...props} open />)

    const price = screen.getByLabelText('قیمت نهایی (تومان)')
    expect((price as HTMLInputElement).value).toBe('۱۰۰۰۰۰')
    fireEvent.change(price, { target: { value: '۸۵۰۰۰' } })
    fireEvent.click(screen.getByRole('button', { name: 'رنگ' }))
    fireEvent.click(screen.getByRole('button', { name: 'ثبت نوبت' }))

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ finalPrice: '85000' }),
      ),
    )
  })

  it('prepares fresh defaults while closed before a new form session opens', async () => {
    const service = {
      id: 'service-1',
      name: 'کوتاهی',
      category: 'hair',
      categoryId: 'category-1',
      color: 'rose',
      duration: 60,
      price: 120_000,
      active: true,
    } as Service
    const staff = {
      id: 'staff-1',
      role: 'staff',
      name: 'پرسنل',
      serviceIds: ['service-1'],
    } as User
    const client = { id: 'client-1', name: 'سارا' } as Client
    const props = {
      open: false,
      onOpenChange: vi.fn(),
      initialDate: '2026-06-02',
      initialTime: '10:00',
      initialStaffId: staff.id,
      initialServiceId: service.id,
      initialClientId: client.id,
      staff: [staff],
      services: [service],
      clients: [client],
      onSuccess: vi.fn(),
    }
    const view = render(<AppointmentDrawer {...props} open formRevision={0} />)
    view.rerender(<AppointmentDrawer {...props} formRevision={0} />)

    fireEvent.change(screen.getByLabelText('قیمت نهایی (تومان)'), {
      target: { value: '۸۵۰۰۰' },
    })
    view.rerender(<AppointmentDrawer {...props} formRevision={1} />)

    await waitFor(() =>
      expect(
        (screen.getByLabelText('قیمت نهایی (تومان)') as HTMLInputElement).value,
      ).toBe('۱۲۰۰۰۰'),
    )
    expect(screen.getByTestId('client-id').textContent).toBe(client.id)
    expect(screen.getByTestId('staff-id').textContent).toBe(staff.id)
    expect(screen.getByTestId('service-id').textContent).toBe(service.id)
    expect(screen.getByTestId('date').textContent).toBe(props.initialDate)
    expect(screen.getByTestId('time-time').textContent).toBe(props.initialTime)
  })
})
