// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { addDaysYmd, salonTodayYmd } from '@repo/salon-core/salon-local-time'
import { formatPersianTime } from '@repo/salon-core/persian-digits'
import type { User } from '@repo/salon-core/types'

import type { FlexibleAppointmentRequestListItem } from '#/lib/appointment-requests-queries'
import { ConvertDraftSheet, formatAcceptableDateChip } from './draft-timing'

describe('ConvertDraftSheet', () => {
  it('shows immutable Draft context and compact day choices plus manual date', () => {
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
    expect(
      screen.getAllByText(formatAcceptableDateChip(elapsedDate)),
    ).toHaveLength(1)
    expect(
      screen
        .getByRole('radio', { name: formatAcceptableDateChip(remainingDate) })
        .getAttribute('aria-checked'),
    ).toBe('true')
    expect(screen.getByLabelText('تاریخ نهایی')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'ساعت شروع' }).textContent,
    ).toContain(formatPersianTime('12:00'))
  })
})
