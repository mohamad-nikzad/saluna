import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  createAppointment: vi.fn(),
  validateCreateAppointmentIntake: vi.fn(),
  getClientById: vi.fn(),
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
  getClientById: mocks.getClientById,
  getClientByPhone: mocks.getClientByPhone,
  createClient: mocks.createClient,
}))

import {
  approveAppointmentRequest,
  convertFlexibleAppointmentRequest,
  createFlexibleAppointmentRequest,
  updateFlexibleAppointmentRequest,
} from './appointment-request-queries'
import { addDaysYmd, salonTodayYmd } from '@repo/salon-core/salon-local-time'

const pendingRequest = {
  id: '22222222-2222-2222-2222-222222222222',
  salonId: 'salon-1',
  serviceId: 'service-1',
  timingMode: 'exact',
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

function setupDb(
  request: { id: string } & Record<string, unknown> = pendingRequest,
) {
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
    transaction: vi.fn(),
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

describe('flexible appointment request conversion', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates an Appointment from the saved Draft agreement and snapshot', async () => {
    const finalDate = addDaysYmd(salonTodayYmd(), 1)
    const request = {
      ...pendingRequest,
      timingMode: 'flexible',
      clientId: 'client-1',
      requestedDate: null,
      requestedStartTime: null,
      requestedEndTime: null,
      acceptableDates: [finalDate],
      timePreference: 'afternoon',
    }
    const { db } = setupDb(request)
    const tx = { id: 'transaction', update: db.update }
    db.transaction = vi.fn(async (work) => work(tx))
    mocks.validateCreateAppointmentIntake.mockResolvedValue({
      ok: true,
      command: {
        clientId: 'client-1',
        staffId: 'staff-1',
        serviceId: 'service-1',
        date: finalDate,
        startTime: '13:30',
        endTime: '14:15',
        status: 'scheduled',
        notes: request.notes,
      },
      client: { id: 'client-1' },
      staff: { id: 'staff-1' },
      service: { id: 'service-1', duration: 90 },
    })
    mocks.createAppointment.mockResolvedValue({ id: 'appointment-1' })

    const result = await convertFlexibleAppointmentRequest({
      id: request.id,
      salonId: request.salonId,
      finalDate,
      startTime: '13:30',
      staffId: 'staff-1',
      reviewedByUserId: 'manager-1',
    })

    expect(result).toEqual({
      ok: true,
      appointmentId: 'appointment-1',
      clientId: 'client-1',
    })
    expect(mocks.validateCreateAppointmentIntake).toHaveBeenCalledWith({
      salonId: request.salonId,
      clientId: request.clientId,
      staffId: 'staff-1',
      serviceId: request.serviceId,
      date: finalDate,
      startTime: '13:30',
      durationMinutes: request.bookedServiceDuration,
      notes: request.notes,
    })
    expect(mocks.createAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: request.clientId,
        staffId: 'staff-1',
        serviceId: request.serviceId,
      }),
      request.salonId,
      expect.objectContaining({
        createdByUserId: 'manager-1',
        transaction: tx,
        serviceSnapshotOverride: {
          name: request.bookedServiceName,
          duration: request.bookedServiceDuration,
          price: request.bookedServicePrice,
        },
      }),
    )
  })

  it('rejects a final date outside the remaining acceptable dates', async () => {
    const finalDate = addDaysYmd(salonTodayYmd(), 2)
    setupDb({
      ...pendingRequest,
      timingMode: 'flexible',
      clientId: 'client-1',
      requestedDate: null,
      requestedStartTime: null,
      requestedEndTime: null,
      acceptableDates: [addDaysYmd(salonTodayYmd(), 1)],
      timePreference: 'any',
    })

    const result = await convertFlexibleAppointmentRequest({
      id: pendingRequest.id,
      salonId: pendingRequest.salonId,
      finalDate,
      startTime: '13:30',
      staffId: 'staff-1',
      reviewedByUserId: 'manager-1',
    })

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: 'تاریخ انتخاب‌شده قابل قبول نیست',
    })
    expect(mocks.validateCreateAppointmentIntake).not.toHaveBeenCalled()
    expect(mocks.createAppointment).not.toHaveBeenCalled()
  })

  it('rejects a start time outside the saved Time Preference', async () => {
    const finalDate = addDaysYmd(salonTodayYmd(), 1)
    setupDb({
      ...pendingRequest,
      timingMode: 'flexible',
      clientId: 'client-1',
      requestedDate: null,
      requestedStartTime: null,
      requestedEndTime: null,
      acceptableDates: [finalDate],
      timePreference: 'afternoon',
    })

    const result = await convertFlexibleAppointmentRequest({
      id: pendingRequest.id,
      salonId: pendingRequest.salonId,
      finalDate,
      startTime: '17:00',
      staffId: 'staff-1',
      reviewedByUserId: 'manager-1',
    })

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: 'ساعت انتخاب‌شده قابل قبول نیست',
    })
    expect(mocks.validateCreateAppointmentIntake).not.toHaveBeenCalled()
  })

  it('does not create an Appointment after losing the pending transition', async () => {
    const finalDate = addDaysYmd(salonTodayYmd(), 1)
    const request = {
      ...pendingRequest,
      timingMode: 'flexible',
      clientId: 'client-1',
      requestedDate: null,
      requestedStartTime: null,
      requestedEndTime: null,
      acceptableDates: [finalDate],
      timePreference: 'any',
    }
    const { db } = setupDb(request)
    const returning = vi.fn().mockResolvedValue([])
    const updateBuilder = { set: vi.fn(), where: vi.fn(), returning }
    updateBuilder.set.mockReturnValue(updateBuilder)
    updateBuilder.where.mockReturnValue(updateBuilder)
    const tx = { update: vi.fn(() => updateBuilder) }
    db.transaction.mockImplementation(async (work) => work(tx))
    mocks.validateCreateAppointmentIntake.mockResolvedValue({
      ok: true,
      command: {
        clientId: 'client-1',
        staffId: 'staff-1',
        serviceId: 'service-1',
        date: finalDate,
        startTime: '13:30',
        endTime: '14:15',
        status: 'scheduled',
      },
      client: { id: 'client-1' },
      staff: { id: 'staff-1' },
      service: { id: 'service-1' },
    })

    const result = await convertFlexibleAppointmentRequest({
      id: request.id,
      salonId: request.salonId,
      finalDate,
      startTime: '13:30',
      staffId: 'staff-1',
      reviewedByUserId: 'manager-1',
    })

    expect(result).toEqual({
      ok: false,
      status: 409,
      error: 'این پیش‌نویس قابل تبدیل نیست',
    })
    expect(mocks.createAppointment).not.toHaveBeenCalled()
  })
})

describe('flexible appointment request creation', () => {
  it('binds the active tenant ServiceVariant snapshot and Client', async () => {
    const client = {
      id: 'client-1',
      salonId: 'salon-1',
      name: 'سارا',
      phone: '09121234567',
    }
    const service = {
      id: 'service-1',
      salonId: 'salon-1',
      name: 'کوتاهی',
      duration: 45,
      price: 750_000,
      active: true,
      kind: 'standard',
    }
    const selectResults = [[client], [service]]
    const select = vi.fn(() => {
      const builder = {
        from: vi.fn(),
        where: vi.fn(),
        limit: vi.fn(),
      }
      builder.from.mockReturnValue(builder)
      builder.where.mockReturnValue(builder)
      builder.limit.mockResolvedValue(selectResults.shift())
      return builder
    })
    const values = vi.fn()
    const returning = vi
      .fn()
      .mockImplementation(async () => [values.mock.calls[0][0]])
    values.mockReturnValue({ returning })
    mocks.getDb.mockReturnValue({
      select,
      insert: vi.fn(() => ({ values })),
    })

    const result = await createFlexibleAppointmentRequest({
      salonId: 'salon-1',
      clientId: client.id,
      serviceId: service.id,
      acceptableDates: ['2026-07-23'],
      timePreference: 'afternoon',
      notes: 'تماس بگیرید',
    })

    expect(result.ok).toBe(true)
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: client.id,
        serviceId: service.id,
        timingMode: 'flexible',
        acceptableDates: ['2026-07-23'],
        timePreference: 'afternoon',
        bookedServiceName: service.name,
        bookedServiceDuration: service.duration,
        bookedServicePrice: service.price,
      }),
    )
    expect(values.mock.calls[0][0]).not.toHaveProperty('requestedDate')
  })
})

describe('flexible appointment request editing', () => {
  it('replaces the current agreement while retaining elapsed acceptable dates', async () => {
    const today = salonTodayYmd()
    const elapsedDate = addDaysYmd(today, -1)
    const removedFutureDate = addDaysYmd(today, 2)
    const newFutureDate = addDaysYmd(today, 3)
    const request = {
      ...pendingRequest,
      timingMode: 'flexible',
      acceptableDates: [elapsedDate, removedFutureDate],
      timePreference: 'morning',
      clientId: 'client-1',
    }
    const selectBuilder = {
      from: vi.fn(),
      where: vi.fn(),
      limit: vi.fn(),
    }
    selectBuilder.from.mockReturnValue(selectBuilder)
    selectBuilder.where.mockReturnValue(selectBuilder)
    selectBuilder.limit.mockResolvedValue([request])
    const set = vi.fn()
    const returning = vi.fn().mockImplementation(async () => [
      {
        ...request,
        ...set.mock.calls[0][0],
      },
    ])
    const updateBuilder = { set, where: vi.fn(), returning }
    set.mockReturnValue(updateBuilder)
    updateBuilder.where.mockReturnValue(updateBuilder)
    mocks.getDb.mockReturnValue({
      select: vi.fn(() => selectBuilder),
      update: vi.fn(() => updateBuilder),
    })
    mocks.getClientById.mockResolvedValue({ id: 'client-1', name: 'سارا' })

    const result = await updateFlexibleAppointmentRequest({
      id: request.id,
      salonId: request.salonId,
      acceptableDates: [newFutureDate],
      timePreference: 'evening',
      notes: 'زمان تازه',
    })

    expect(result.ok).toBe(true)
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        acceptableDates: [elapsedDate, newFutureDate],
        timePreference: 'evening',
      }),
    )
  })

  it('does not edit a terminal AppointmentRequest', async () => {
    const terminalRequest = {
      ...pendingRequest,
      timingMode: 'flexible',
      acceptableDates: [addDaysYmd(salonTodayYmd(), 1)],
      timePreference: 'any',
      status: 'approved',
    }
    const selectBuilder = {
      from: vi.fn(),
      where: vi.fn(),
      limit: vi.fn(),
    }
    selectBuilder.from.mockReturnValue(selectBuilder)
    selectBuilder.where.mockReturnValue(selectBuilder)
    selectBuilder.limit.mockResolvedValue([terminalRequest])
    const update = vi.fn()
    mocks.getDb.mockReturnValue({
      select: vi.fn(() => selectBuilder),
      update,
    })

    const result = await updateFlexibleAppointmentRequest({
      id: terminalRequest.id,
      salonId: terminalRequest.salonId,
      acceptableDates: [addDaysYmd(salonTodayYmd(), 2)],
      timePreference: 'afternoon',
      notes: null,
    })

    expect(result).toEqual({
      ok: false,
      status: 409,
      error: 'این پیش‌نویس قابل ویرایش نیست',
    })
    expect(update).not.toHaveBeenCalled()
  })
})
