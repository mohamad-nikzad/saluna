import { describe, it, expect } from 'vitest'

import type {
  AppointmentWithDetails,
  Service,
  ServiceAddon,
  User,
} from '@repo/salon-core/types'

import {
  appointmentEditFormDefaults,
  buildAppointmentDetailEditViewModel,
  clientsForAppointmentEdit,
  computeEditPreview,
  formatTomans,
  historicalAddonsFromAppointment,
  mergeAddonOptions,
  statusChangeFeedbackMessage,
} from './appointment-detail-view-model'

function appt(
  overrides: Partial<AppointmentWithDetails> &
    Pick<AppointmentWithDetails, 'id' | 'date' | 'startTime' | 'endTime'>,
): AppointmentWithDetails {
  return {
    clientId: 'c1',
    staffId: 's1',
    serviceId: 'svc1',
    bookedServiceName: 'کوتاهی',
    bookedServiceDuration: 30,
    bookedServicePrice: 100_000,
    bookedTotalDuration: 30,
    bookedTotalPrice: 100_000,
    bookedAddonCount: 0,
    status: 'scheduled',
    createdAt: new Date(),
    updatedAt: new Date(),
    client: {
      id: 'c1',
      name: 'مشتری',
      phone: null,
      isPlaceholder: false,
      createdAt: new Date(),
    },
    staff: { id: 's1', name: 'کارمند' } as User,
    service: { id: 'svc1' } as AppointmentWithDetails['service'],
    ...overrides,
  }
}

const baseAddon: ServiceAddon = {
  id: 'addon-a',
  salonId: 'salon',
  name: 'رنگ',
  priceDelta: 50_000,
  durationDelta: 15,
  active: true,
  sortOrder: 1,
  scopes: [],
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('mergeAddonOptions', () => {
  it('dedupes by id and prefers the later list entry', () => {
    const historical = [{ ...baseAddon, name: 'قدیمی', active: false }]
    const available = [{ ...baseAddon, name: 'فعال' }]

    const merged = mergeAddonOptions(available, historical)

    expect(merged).toHaveLength(1)
    expect(merged[0].name).toBe('فعال')
  })

  it('sorts by sortOrder then Persian name', () => {
    const merged = mergeAddonOptions(
      [
        { ...baseAddon, id: 'b', sortOrder: 2, name: 'ب' },
        { ...baseAddon, id: 'a', sortOrder: 1, name: 'الف' },
      ],
      [],
    )

    expect(merged.map((a) => a.id)).toEqual(['a', 'b'])
  })
})

describe('computeEditPreview', () => {
  it('sums service and addon deltas', () => {
    expect(
      computeEditPreview({
        serviceDuration: 45,
        servicePrice: 200_000,
        fallbackBookedPrice: 0,
        durationMinutes: 30,
        selectedAddons: [
          { ...baseAddon, durationDelta: 10, priceDelta: 20_000 },
          { ...baseAddon, id: 'addon-b', durationDelta: 5, priceDelta: 5_000 },
        ],
      }),
    ).toEqual({ previewDuration: 60, previewPrice: 225_000 })
  })

  it('falls back to form duration and booked price', () => {
    expect(
      computeEditPreview({
        fallbackBookedPrice: 80_000,
        durationMinutes: 50,
        selectedAddons: [],
      }),
    ).toEqual({ previewDuration: 50, previewPrice: 80_000 })
  })
})

describe('appointmentEditFormDefaults', () => {
  it('maps a placeholder client to temporary-client fields', () => {
    const appointment = appt({
      id: 'a1',
      date: '2026-06-02',
      startTime: '10:00',
      endTime: '10:45',
      client: {
        id: 'ph1',
        name: 'دوست سارا',
        phone: null,
        isPlaceholder: true,
        notes: 'بعدا تماس',
        createdAt: new Date(),
      },
      bookedAddons: [
        {
          id: 'line1',
          appointmentId: 'a1',
          serviceAddonId: 'addon-a',
          bookedAddonName: 'رنگ',
          bookedAddonPriceDelta: 0,
          bookedAddonDurationDelta: 0,
          sortOrder: 0,
          createdAt: new Date(),
        },
      ],
    })

    expect(appointmentEditFormDefaults(appointment)).toEqual({
      useTemporaryClient: true,
      temporaryClientName: 'دوست سارا',
      temporaryClientNotes: 'بعدا تماس',
      clientId: '',
      staffId: 's1',
      serviceId: 'svc1',
      date: '2026-06-02',
      startTime: '10:00',
      endTime: '10:45',
      durationMinutes: 45,
      notes: '',
      addonIds: ['addon-a'],
    })
  })
})

describe('clientsForAppointmentEdit', () => {
  it('prepends a missing placeholder client', () => {
    const appointment = appt({
      id: 'a1',
      date: '2026-06-02',
      startTime: '10:00',
      endTime: '10:45',
      client: {
        id: 'ph1',
        name: 'موقت',
        phone: null,
        isPlaceholder: true,
        createdAt: new Date(),
      },
    })

    expect(
      clientsForAppointmentEdit(appointment, [
        { id: 'c2', name: 'دیگر' } as never,
      ]),
    ).toEqual([appointment.client, { id: 'c2', name: 'دیگر' }])
  })
})

describe('statusChangeFeedbackMessage', () => {
  it('uses queued copy when offline with a data client', () => {
    expect(
      statusChangeFeedbackMessage({
        hasDataClient: true,
        isOnline: false,
        changeType: 'updated',
      }),
    ).toBe('وضعیت نوبت آفلاین ثبت شد و بعدا همگام می‌شود.')
  })

  it('uses deleted copy when online', () => {
    expect(
      statusChangeFeedbackMessage({
        hasDataClient: true,
        isOnline: true,
        changeType: 'deleted',
      }),
    ).toBe('رزرو موقت لغو و حذف شد.')
  })
})

describe('buildAppointmentDetailEditViewModel', () => {
  it('includes inactive services when currently selected', () => {
    const inactive: Service = {
      id: 'svc-old',
      name: 'قدیمی',
      active: false,
    } as Service

    const vm = buildAppointmentDetailEditViewModel({
      staff: [{ id: 's1', role: 'staff' } as User],
      services: [inactive],
      serviceId: 'svc-old',
      availableAddons: [],
      appointment: null,
      addonIds: [],
      durationMinutes: 45,
    })

    expect(vm.editableServices).toEqual([inactive])
    expect(vm.staffRoleOnly).toHaveLength(1)
  })
})

describe('formatTomans', () => {
  it('appends the currency suffix', () => {
    expect(formatTomans(1200)).toContain('تومان')
  })
})

describe('historicalAddonsFromAppointment', () => {
  it('returns an empty list when booked addons are missing', () => {
    expect(historicalAddonsFromAppointment(undefined)).toEqual([])
  })
})
