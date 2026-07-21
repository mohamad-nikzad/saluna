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
  cancelAppointmentRequest,
  createFlexibleAppointmentRequest,
  renewTerminalAppointmentRequest,
  updateFlexibleAppointmentRequest,
} from './appointment-request-queries'
import { addDaysYmd, salonTodayYmd } from '@repo/salon-core/salon-local-time'

const pendingRequest = {
  id: '22222222-2222-2222-2222-222222222222',
  salonId: 'salon-1',
  serviceId: 'service-1',
  timingMode: 'exact',
  staffId: null,
  requestedDate: '2026-07-03' as string | null,
  requestedStartTime: '10:00' as string | null,
  requestedEndTime: '10:45' as string | null,
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

describe('terminal AppointmentRequest renewal', () => {
  it('creates a distinct Draft with fresh timing and the current ServiceVariant snapshot', async () => {
    const source = {
      ...pendingRequest,
      status: 'cancelled',
      timingMode: 'flexible',
      clientId: 'client-1',
      acceptableDates: ['2026-07-20'],
      timePreference: 'morning',
      bookedServiceName: 'نام قدیمی',
      notes: '',
    }
    const client = {
      id: 'client-1',
      salonId: 'salon-1',
      name: 'سارا',
      phone: '09121234567',
    }
    const service = {
      id: 'service-1',
      salonId: 'salon-1',
      name: 'نام فعلی',
      duration: 60,
      price: 900_000,
      active: true,
      kind: 'standard',
    }
    const selectResults = [[source], [{ id: service.id }], [client], [service]]
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
    values.mockReturnValue({
      returning: vi.fn(async () => [
        { id: 'renewed-request', ...values.mock.calls[0][0] },
      ]),
    })
    mocks.getDb.mockReturnValue({
      select,
      insert: vi.fn(() => ({ values })),
    })
    mocks.getClientById.mockResolvedValue(client)

    const result = await renewTerminalAppointmentRequest({
      id: source.id,
      salonId: source.salonId,
      acceptableDates: ['2026-07-25'],
      timePreference: 'evening',
    })

    expect(result).toMatchObject({
      ok: true,
      request: { id: 'renewed-request' },
    })
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: source.clientId,
        serviceId: source.serviceId,
        notes: source.notes,
        acceptableDates: ['2026-07-25'],
        timePreference: 'evening',
        bookedServiceName: service.name,
        bookedServiceDuration: service.duration,
        bookedServicePrice: service.price,
      }),
    )
  })

  it('requires a replacement Client when the source has none', async () => {
    const source = { ...pendingRequest, status: 'expired', clientId: null }
    const selectBuilder = {
      from: vi.fn(),
      where: vi.fn(),
      limit: vi.fn(),
    }
    selectBuilder.from.mockReturnValue(selectBuilder)
    selectBuilder.where.mockReturnValue(selectBuilder)
    selectBuilder.limit.mockResolvedValue([source])
    mocks.getDb.mockReturnValue({ select: vi.fn(() => selectBuilder) })

    await expect(
      renewTerminalAppointmentRequest({
        id: source.id,
        salonId: source.salonId,
        acceptableDates: ['2026-07-25'],
        timePreference: 'any',
      }),
    ).resolves.toEqual({
      ok: false,
      status: 409,
      error: 'انتخاب مشتری الزامی است',
    })
  })

  it('does not reopen a pending AppointmentRequest', async () => {
    const selectBuilder = {
      from: vi.fn(),
      where: vi.fn(),
      limit: vi.fn(),
    }
    selectBuilder.from.mockReturnValue(selectBuilder)
    selectBuilder.where.mockReturnValue(selectBuilder)
    selectBuilder.limit.mockResolvedValue([pendingRequest])
    mocks.getDb.mockReturnValue({ select: vi.fn(() => selectBuilder) })

    await expect(
      renewTerminalAppointmentRequest({
        id: pendingRequest.id,
        salonId: pendingRequest.salonId,
        acceptableDates: ['2026-07-25'],
        timePreference: 'any',
      }),
    ).resolves.toMatchObject({ ok: false, status: 409 })
  })

  it('does not replace a Client that is still available', async () => {
    const source = {
      ...pendingRequest,
      status: 'rejected',
      clientId: 'client-1',
    }
    const selectBuilder = {
      from: vi.fn(),
      where: vi.fn(),
      limit: vi.fn(),
    }
    selectBuilder.from.mockReturnValue(selectBuilder)
    selectBuilder.where.mockReturnValue(selectBuilder)
    selectBuilder.limit.mockResolvedValue([source])
    mocks.getDb.mockReturnValue({ select: vi.fn(() => selectBuilder) })
    mocks.getClientById.mockResolvedValue({ id: source.clientId })

    await expect(
      renewTerminalAppointmentRequest({
        id: source.id,
        salonId: source.salonId,
        clientId: 'replacement-client',
        acceptableDates: ['2026-07-25'],
        timePreference: 'any',
      }),
    ).resolves.toMatchObject({ ok: false, status: 409 })
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

describe('manager appointment request cancellation', () => {
  it('records customer withdrawal without overwriting request details', async () => {
    const { updateBuilder } = setupDb({
      ...pendingRequest,
      timingMode: 'flexible',
      requestedDate: null,
      requestedStartTime: null,
      requestedEndTime: null,
    })

    await expect(
      cancelAppointmentRequest({
        id: pendingRequest.id,
        salonId: 'salon-1',
        reviewedByUserId: 'manager-1',
        closureNote: 'مشتری منصرف شد',
      }),
    ).resolves.toEqual({ ok: true })

    expect(updateBuilder.set).toHaveBeenCalledWith({
      status: 'cancelled',
      reviewedByUserId: 'manager-1',
      reviewedAt: expect.any(Date),
      rejectionReason: 'مشتری منصرف شد',
      updatedAt: expect.any(Date),
    })
  })
})
