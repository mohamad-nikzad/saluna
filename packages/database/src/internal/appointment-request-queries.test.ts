import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  createAppointment: vi.fn(),
  validateCreateAppointmentIntake: vi.fn(),
  getClientByPhone: vi.fn(),
  createClient: vi.fn(),
}))

vi.mock('../client', () => ({
  getDb: mocks.getDb,
}))

vi.mock('./appointment-queries', () => ({
  createAppointment: mocks.createAppointment,
}))

vi.mock('./appointment-intake', () => ({
  validateCreateAppointmentIntake: mocks.validateCreateAppointmentIntake,
}))

vi.mock('./client-queries', () => ({
  getClientByPhone: mocks.getClientByPhone,
  createClient: mocks.createClient,
}))

import { approveAppointmentRequest } from './appointment-request-queries'

const pendingRequest = {
  id: '22222222-2222-2222-2222-222222222222',
  salonId: 'salon-1',
  serviceId: 'service-1',
  staffId: null,
  requestedDate: '2026-07-03',
  requestedStartTime: '10:00',
  requestedEndTime: '10:45',
  customerName: 'سارا',
  customerPhone: '09121234567',
  notes: 'لطفا با همان قیمت ثبت شود',
  bookedServiceName: 'کوتاهی ثبت‌شده',
  bookedServiceDuration: 45,
  bookedServicePrice: 750_000,
  status: 'pending',
}

function setupDb(request = pendingRequest) {
  const selectBuilder = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
  }
  selectBuilder.from.mockReturnValue(selectBuilder)
  selectBuilder.where.mockReturnValue(selectBuilder)
  selectBuilder.limit.mockResolvedValue([request])

  const updateBuilder = {
    set: vi.fn(),
    where: vi.fn(),
    returning: vi.fn(),
  }
  updateBuilder.set.mockReturnValue(updateBuilder)
  updateBuilder.where.mockReturnValue(updateBuilder)
  updateBuilder.returning.mockResolvedValue([{ id: request.id }])

  const db = {
    select: vi.fn(() => selectBuilder),
    update: vi.fn(() => updateBuilder),
  }
  mocks.getDb.mockReturnValue(db)
  return { db, updateBuilder }
}

describe('appointment request approval', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDb()
    mocks.getClientByPhone.mockResolvedValue({
      id: 'client-1',
      name: 'سارا',
      phone: '09121234567',
    })
    mocks.validateCreateAppointmentIntake.mockResolvedValue({
      ok: true,
      command: {
        clientId: 'client-1',
        staffId: 'staff-1',
        serviceId: 'service-1',
        date: '2026-07-03',
        startTime: '10:00',
        endTime: '10:45',
        status: 'scheduled',
        notes: pendingRequest.notes,
      },
      client: { id: 'client-1' },
      staff: { id: 'staff-1' },
      service: {
        id: 'service-1',
        name: 'کوتاهی جدید در کاتالوگ',
        duration: 60,
        price: 900_000,
      },
    })
    mocks.createAppointment.mockResolvedValue({ id: 'appointment-1' })
  })

  it('creates the approved appointment with the request service snapshot', async () => {
    const result = await approveAppointmentRequest({
      id: pendingRequest.id,
      salonId: 'salon-1',
      staffId: 'staff-1',
      reviewedByUserId: 'manager-1',
    })

    expect(result).toEqual({
      ok: true,
      appointmentId: 'appointment-1',
      clientId: 'client-1',
    })
    expect(mocks.validateCreateAppointmentIntake).toHaveBeenCalledWith({
      salonId: 'salon-1',
      clientId: 'client-1',
      staffId: 'staff-1',
      serviceId: 'service-1',
      date: '2026-07-03',
      startTime: '10:00',
      notes: pendingRequest.notes,
    })
    expect(mocks.createAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'client-1',
        staffId: 'staff-1',
        serviceId: 'service-1',
      }),
      'salon-1',
      {
        createdByUserId: 'manager-1',
        serviceSnapshotOverride: {
          name: 'کوتاهی ثبت‌شده',
          duration: 45,
          price: 750_000,
        },
      },
    )
  })
})
