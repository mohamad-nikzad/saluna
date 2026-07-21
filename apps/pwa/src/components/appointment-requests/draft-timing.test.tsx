// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { addDaysYmd, salonTodayYmd } from '@repo/salon-core/salon-local-time'
import { formatJalaliFullDate } from '@repo/salon-core/jalali'
import type { User } from '@repo/salon-core/types'

import type { FlexibleAppointmentRequestListItem } from '#/lib/appointment-requests-queries'
import { ConvertDraftSheet } from './draft-timing'

describe('ConvertDraftSheet', () => {
  it('shows immutable Draft context and only schedules a remaining date', () => {
    const today = salonTodayYmd()
    const elapsedDate = addDaysYmd(today, -1)
    const remainingDate = addDaysYmd(today, 1)
    const draft = {
      id: 'draft-1',
      serviceId: 'service-1',
      customerName: 'سارا',
      existingClient: { id: 'client-1', name: 'سارا احمدی' },
      bookedServiceName: 'کوتاهی ثبت‌شده',
      bookedServiceDuration: 45,
      bookedServicePrice: 750_000,
      acceptableDates: [elapsedDate, remainingDate],
      timePreference: 'afternoon',
      notes: 'لطفاً تماس بگیرید',
      timingMode: 'flexible',
    } as FlexibleAppointmentRequestListItem
    const staff = [
      {
        id: 'staff-1',
        salonId: 'salon-1',
        name: 'مینا',
        role: 'staff',
        serviceIds: ['service-1'],
        color: 'rose',
        phone: '',
        createdAt: new Date(),
      },
    ] satisfies User[]
    const queryClient = new QueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <ConvertDraftSheet
          draft={draft}
          staff={staff}
          open
          onOpenChange={vi.fn()}
        />
      </QueryClientProvider>,
    )

    expect(
      screen.getByRole('dialog', { name: 'تبدیل پیش‌نویس به نوبت' }),
    ).toBeTruthy()
    expect(screen.getByText('سارا احمدی')).toBeTruthy()
    expect(screen.getByText('کوتاهی ثبت‌شده')).toBeTruthy()
    expect(screen.getByText('لطفاً تماس بگیرید')).toBeTruthy()
    expect(screen.getAllByText(formatJalaliFullDate(elapsedDate))).toHaveLength(
      1,
    )
    expect(
      screen.getAllByText(formatJalaliFullDate(remainingDate)).length,
    ).toBeGreaterThan(1)
    expect(screen.getByLabelText('ساعت شروع')).toMatchObject({
      min: '12:00',
      max: '16:59',
      value: '12:00',
    })
  })
})
