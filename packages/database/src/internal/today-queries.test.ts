import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getTodayData } from './today-queries'

const mocks = vi.hoisted(() => ({
  getAppointmentsWithDetailsByDateRange: vi.fn(),
  getClientTagsForClients: vi.fn(),
  getBusinessSettings: vi.fn(),
  getAllStaff: vi.fn(),
  getStaffSchedules: vi.fn(),
  salonTodayYmd: vi.fn(),
  salonCurrentHm: vi.fn(),
  salonHmAfterMinutes: vi.fn(),
}))

vi.mock('./appointment-queries', () => ({
  getAppointmentsWithDetailsByDateRange:
    mocks.getAppointmentsWithDetailsByDateRange,
}))

vi.mock('./client-queries', () => ({
  getClientTagsForClients: mocks.getClientTagsForClients,
}))

vi.mock('./settings-queries', () => ({
  getBusinessSettings: mocks.getBusinessSettings,
}))

vi.mock('./staff-queries', () => ({
  getAllStaff: mocks.getAllStaff,
  getStaffSchedules: mocks.getStaffSchedules,
}))

vi.mock('@repo/salon-core/salon-local-time', () => ({
  salonTodayYmd: mocks.salonTodayYmd,
  salonCurrentHm: mocks.salonCurrentHm,
  salonHmAfterMinutes: mocks.salonHmAfterMinutes,
}))

describe('today placeholder attention', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.salonTodayYmd.mockReturnValue('2026-05-01')
    mocks.salonCurrentHm.mockReturnValue('10:00')
    mocks.salonHmAfterMinutes.mockReturnValue('12:00')
    mocks.getClientTagsForClients.mockResolvedValue(new Map())
    mocks.getBusinessSettings.mockResolvedValue({
      workingStart: '09:00',
      workingEnd: '19:00',
      slotDurationMinutes: 30,
    })
    mocks.getAllStaff.mockResolvedValue([
      {
        id: 'staff-1',
        salonId: 'salon-1',
        role: 'staff',
        name: 'سارا',
        color: 'bg-staff-1',
        phone: '09120000000',
        createdAt: new Date(),
      },
    ])
    mocks.getStaffSchedules.mockResolvedValue([])
  })

  it('adds a manager-only incomplete-client reminder for same-day placeholder appointments', async () => {
    const appointment = {
      id: 'appointment-1',
      clientId: 'placeholder-1',
      staffId: 'staff-1',
      serviceId: 'service-1',
      date: '2026-05-01',
      startTime: '11:00',
      endTime: '11:45',
      status: 'scheduled',
      createdAt: new Date(),
      updatedAt: new Date(),
      client: {
        id: 'placeholder-1',
        name: 'دوست سارا',
        phone: null,
        isPlaceholder: true,
        createdAt: new Date(),
      },
      staff: {
        id: 'staff-1',
        salonId: 'salon-1',
        role: 'staff',
        name: 'سارا',
        color: 'bg-staff-1',
        phone: '09120000000',
        createdAt: new Date(),
      },
      service: {
        id: 'service-1',
        name: 'کات',
        category: 'hair',
        duration: 45,
        price: 100,
        color: 'bg-staff-1',
        active: true,
      },
    }

    mocks.getAppointmentsWithDetailsByDateRange
      .mockResolvedValueOnce([appointment])
      .mockResolvedValueOnce([appointment])

    const data = await getTodayData('salon-1', '2026-05-01')

    expect(data.attentionItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'incomplete-client',
          appointmentId: 'appointment-1',
          priority: 1,
        }),
      ]),
    )
  })

  it('does not add manager-only placeholder reminders to staff-filtered Today data', async () => {
    const appointment = {
      id: 'appointment-1',
      clientId: 'placeholder-1',
      staffId: 'staff-1',
      serviceId: 'service-1',
      date: '2026-05-01',
      startTime: '15:00',
      endTime: '15:45',
      status: 'confirmed',
      createdAt: new Date(),
      updatedAt: new Date(),
      client: {
        id: 'placeholder-1',
        name: 'دوست سارا',
        phone: null,
        isPlaceholder: true,
        createdAt: new Date(),
      },
      staff: {
        id: 'staff-1',
        salonId: 'salon-1',
        role: 'staff',
        name: 'سارا',
        color: 'bg-staff-1',
        phone: '09120000000',
        createdAt: new Date(),
      },
      service: {
        id: 'service-1',
        name: 'کات',
        category: 'hair',
        duration: 45,
        price: 100,
        color: 'bg-staff-1',
        active: true,
      },
    }

    mocks.getAppointmentsWithDetailsByDateRange
      .mockResolvedValueOnce([appointment])
      .mockResolvedValueOnce([appointment])

    const data = await getTodayData('salon-1', '2026-05-01', 'staff-1')

    expect(
      data.attentionItems.find((item) => item.type === 'incomplete-client'),
    ).toBeUndefined()
  })
})
