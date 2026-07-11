import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getClientSummary } from './client-followup-queries'

const mocks = vi.hoisted(() => ({
  getClientAppointmentsWithDetails: vi.fn(),
  getClientById: vi.fn(),
  getClientTags: vi.fn(),
  getClientFollowUpsDb: vi.fn(),
  salonTodayYmd: vi.fn(),
}))

vi.mock('./appointment-queries', () => ({
  getClientAppointmentsWithDetails: mocks.getClientAppointmentsWithDetails,
}))

vi.mock('./client-queries', () => ({
  getClientById: mocks.getClientById,
  getClientTags: mocks.getClientTags,
}))

vi.mock('../client', () => ({
  getDb: mocks.getClientFollowUpsDb,
}))

vi.mock('@repo/salon-core/salon-local-time', () => ({
  salonTodayYmd: mocks.salonTodayYmd,
}))

function completedComboAppointment() {
  return {
    id: 'appointment-1',
    clientId: 'client-1',
    staffId: 'staff-1',
    serviceId: 'combo-1',
    bookedServiceName: 'پکیج عروس',
    bookedServiceDuration: 180,
    bookedServicePrice: 9000000,
    date: '2026-04-10',
    startTime: '10:00',
    endTime: '13:00',
    status: 'completed' as const,
    notes: undefined,
    createdAt: new Date('2026-04-01T08:00:00Z'),
    updatedAt: new Date('2026-04-10T13:00:00Z'),
    client: {
      id: 'client-1',
      name: 'مینا',
      phone: '09120000000',
      isPlaceholder: false,
      createdAt: new Date('2026-04-01T08:00:00Z'),
    },
    staff: {
      id: 'staff-1',
      salonId: 'salon-1',
      name: 'سارا',
      role: 'staff' as const,
      color: 'rose',
      phone: '09121111111',
      createdAt: new Date('2026-01-01T08:00:00Z'),
    },
    service: {
      id: 'combo-1',
      name: 'پکیج عروس جدید',
      category: 'hair' as const,
      categoryId: 'category-1',
      categoryName: 'مو',
      familyId: 'family-1',
      familyName: 'پکیج‌ها',
      duration: 240,
      price: 12000000,
      color: 'rose',
      active: true,
      kind: 'combo' as const,
    },
  }
}

describe('client summary combo snapshots', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.salonTodayYmd.mockReturnValue('2026-05-01')
    mocks.getClientById.mockResolvedValue({
      id: 'client-1',
      name: 'مینا',
      phone: '09120000000',
      isPlaceholder: false,
      createdAt: new Date('2026-04-01T08:00:00Z'),
    })
    mocks.getClientTags.mockResolvedValue([])
    mocks.getClientAppointmentsWithDetails.mockResolvedValue([
      completedComboAppointment(),
    ])
    mocks.getClientFollowUpsDb.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => Promise.resolve([]),
          }),
        }),
      }),
    })
  })

  it('uses booked combo snapshots for retention spend and favorite service after catalog changes', async () => {
    const summary = await getClientSummary('salon-1', 'client-1')

    expect(summary?.stats.estimatedSpend).toBe(9000000)
    expect(summary?.stats.favoriteServiceName).toBe('پکیج عروس')
    expect(summary?.history[0]).toMatchObject({
      serviceId: 'combo-1',
      bookedServiceName: 'پکیج عروس',
      bookedServiceDuration: 180,
      bookedServicePrice: 9000000,
      service: {
        name: 'پکیج عروس جدید',
        duration: 240,
        price: 12000000,
      },
    })
  })
})
