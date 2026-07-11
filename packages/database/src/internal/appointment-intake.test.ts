import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  validateCreateAppointmentIntake,
  validateUpdateAppointmentIntake,
} from './appointment-intake'

const mocks = vi.hoisted(() => ({
  getClientById: vi.fn(),
  getServiceById: vi.fn(),
  getActiveServiceAddonsForService: vi.fn(),
  validateComboServiceIsBookable: vi.fn(),
  getAllStaff: vi.fn(),
  staffMayPerformService: vi.fn(),
  getUserById: vi.fn(),
  checkStaffAvailabilityForAppointment: vi.fn(),
  getScheduleOverlapFlags: vi.fn(),
  validatePlaceholderClientUsage: vi.fn(),
}))

vi.mock('./client-queries', () => ({
  getClientById: mocks.getClientById,
  isClientProvidedEntityId: (id: string | undefined) => typeof id === 'string',
}))

vi.mock('./service-queries', () => ({
  getServiceById: mocks.getServiceById,
  getActiveServiceAddonsForService: mocks.getActiveServiceAddonsForService,
  validateComboServiceIsBookable: mocks.validateComboServiceIsBookable,
}))

vi.mock('./staff-queries', () => ({
  checkStaffAvailabilityForAppointment:
    mocks.checkStaffAvailabilityForAppointment,
  getAllStaff: mocks.getAllStaff,
  staffMayPerformService: mocks.staffMayPerformService,
}))

vi.mock('./user-queries', () => ({
  getUserById: mocks.getUserById,
}))

vi.mock('./appointment-queries', () => ({
  getScheduleOverlapFlags: mocks.getScheduleOverlapFlags,
  validateAppointmentAddonIds: (addonIds: string[]) => {
    if (new Set(addonIds).size !== addonIds.length) {
      throw new Error('appointment add-ons cannot contain duplicates')
    }
  },
}))

vi.mock('./placeholder-client-queries', () => ({
  validatePlaceholderClientUsage: mocks.validatePlaceholderClientUsage,
}))

describe('appointment intake placeholder rules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getClientById.mockResolvedValue({
      id: 'placeholder-1',
      name: 'دوست سارا',
      phone: null,
      isPlaceholder: true,
      createdAt: new Date(),
    })
    mocks.getServiceById.mockResolvedValue({
      id: 'service-1',
      name: 'کات',
      active: true,
      duration: 45,
    })
    mocks.validateComboServiceIsBookable.mockResolvedValue(true)
    mocks.getActiveServiceAddonsForService.mockResolvedValue([])
    mocks.getAllStaff.mockResolvedValue([
      {
        id: 'staff-1',
        salonId: 'salon-1',
        role: 'staff',
        name: 'پرسنل',
        color: 'bg-staff-1',
        phone: '09120000000',
        createdAt: new Date(),
      },
    ])
    mocks.staffMayPerformService.mockResolvedValue(true)
    mocks.getUserById.mockResolvedValue({
      id: 'staff-1',
      salonId: 'salon-1',
      role: 'staff',
      name: 'پرسنل',
      color: 'bg-staff-1',
      phone: '09120000000',
      createdAt: new Date(),
    })
    mocks.checkStaffAvailabilityForAppointment.mockResolvedValue({ ok: true })
    mocks.getScheduleOverlapFlags.mockResolvedValue({
      staffConflict: false,
      clientConflict: false,
    })
    mocks.validatePlaceholderClientUsage.mockResolvedValue({
      ok: true,
      client: {
        id: 'placeholder-1',
        name: 'دوست سارا',
        phone: null,
        isPlaceholder: true,
        createdAt: new Date(),
      },
    })
  })

  it('rejects creating a second appointment with the same placeholder client', async () => {
    mocks.validatePlaceholderClientUsage.mockResolvedValue({
      ok: false,
      status: 409,
      error: 'این مشتری موقت قبلاً به نوبت دیگری وصل شده است',
      code: 'placeholder-reuse',
    })

    const result = await validateCreateAppointmentIntake({
      salonId: 'salon-1',
      clientId: 'placeholder-1',
      staffId: 'staff-1',
      serviceId: 'service-1',
      date: '2026-05-01',
      startTime: '10:00',
    })

    expect(result).toMatchObject({
      ok: false,
      status: 409,
      code: 'placeholder-reuse',
    })
    expect(mocks.validatePlaceholderClientUsage).toHaveBeenCalledWith({
      salonId: 'salon-1',
      clientId: 'placeholder-1',
    })
  })

  it('allows editing the same appointment without tripping placeholder reuse', async () => {
    const result = await validateUpdateAppointmentIntake({
      salonId: 'salon-1',
      appointmentId: 'appointment-1',
      existing: {
        id: 'appointment-1',
        clientId: 'placeholder-1',
        staffId: 'staff-1',
        serviceId: 'service-1',
        bookedServiceName: 'Cut',
        bookedServiceDuration: 45,
        bookedServicePrice: 100,
        bookedTotalDuration: 45,
        bookedTotalPrice: 100,
        bookedAddonCount: 0,
        date: '2026-05-01',
        startTime: '10:00',
        endTime: '10:45',
        status: 'scheduled',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      body: {
        notes: 'ویرایش شد',
      },
    })

    expect(result).toMatchObject({
      ok: true,
      patch: {
        endTime: '10:45',
        notes: 'ویرایش شد',
      },
    })
    expect(mocks.validatePlaceholderClientUsage).toHaveBeenCalledWith({
      salonId: 'salon-1',
      clientId: 'placeholder-1',
      appointmentId: 'appointment-1',
    })
  })

  it('rejects booking an active combo that has no valid components', async () => {
    mocks.getServiceById.mockResolvedValue({
      id: 'combo-1',
      name: 'پکیج عروس',
      active: true,
      kind: 'combo',
      duration: 180,
    })
    mocks.validateComboServiceIsBookable.mockResolvedValue(false)

    const result = await validateCreateAppointmentIntake({
      salonId: 'salon-1',
      clientId: 'placeholder-1',
      staffId: 'staff-1',
      serviceId: 'combo-1',
      date: '2026-05-01',
      startTime: '10:00',
    })

    expect(result).toMatchObject({
      ok: false,
      status: 400,
      error: 'پکیج انتخاب‌شده هنوز ترکیب خدمات ندارد.',
    })
    expect(mocks.staffMayPerformService).not.toHaveBeenCalled()
  })

  it('allows booking a complete combo as one selected service', async () => {
    mocks.getServiceById.mockResolvedValue({
      id: 'combo-1',
      name: 'پکیج عروس',
      active: true,
      kind: 'combo',
      duration: 180,
      price: 9000000,
    })
    mocks.validateComboServiceIsBookable.mockResolvedValue(true)

    const result = await validateCreateAppointmentIntake({
      salonId: 'salon-1',
      clientId: 'placeholder-1',
      staffId: 'staff-1',
      serviceId: 'combo-1',
      date: '2026-05-01',
      startTime: '10:00',
    })

    expect(result).toMatchObject({
      ok: true,
      command: {
        serviceId: 'combo-1',
        startTime: '10:00',
        endTime: '13:00',
      },
      service: {
        id: 'combo-1',
        name: 'پکیج عروس',
        price: 9000000,
      },
    })
    expect(mocks.staffMayPerformService).toHaveBeenCalledWith(
      'staff-1',
      'combo-1',
      'salon-1',
    )
  })

  it('requires explicit staff capability for a combo service', async () => {
    mocks.getServiceById.mockResolvedValue({
      id: 'combo-1',
      name: 'پکیج عروس',
      active: true,
      kind: 'combo',
      duration: 180,
      price: 9000000,
    })
    mocks.validateComboServiceIsBookable.mockResolvedValue(true)
    mocks.staffMayPerformService.mockResolvedValue(false)

    const result = await validateCreateAppointmentIntake({
      salonId: 'salon-1',
      clientId: 'placeholder-1',
      staffId: 'staff-1',
      serviceId: 'combo-1',
      date: '2026-05-01',
      startTime: '10:00',
    })

    expect(result).toMatchObject({
      ok: false,
      status: 400,
      error: 'این پرسنل برای خدمت انتخاب‌شده تعریف نشده است.',
    })
    expect(mocks.staffMayPerformService).toHaveBeenCalledWith(
      'staff-1',
      'combo-1',
      'salon-1',
    )
  })

  it('uses explicit create end time instead of base service plus selected add-ons', async () => {
    mocks.getServiceById.mockResolvedValue({
      id: 'service-1',
      name: 'کات',
      active: true,
      duration: 45,
      price: 100,
    })
    mocks.getActiveServiceAddonsForService.mockResolvedValue([
      {
        id: 'addon-1',
        name: 'فرنچ',
        durationDelta: 15,
        priceDelta: 50,
        active: true,
      },
    ])

    const result = await validateCreateAppointmentIntake({
      salonId: 'salon-1',
      clientId: 'placeholder-1',
      staffId: 'staff-1',
      serviceId: 'service-1',
      addonIds: ['addon-1'],
      date: '2026-05-01',
      startTime: '10:00',
      endTime: '10:20',
      durationMinutes: 20,
    })

    expect(result).toMatchObject({
      ok: true,
      command: {
        addonIds: ['addon-1'],
        endTime: '10:20',
      },
    })
  })

  it('uses explicit create duration when no end time is provided', async () => {
    mocks.getServiceById.mockResolvedValue({
      id: 'service-1',
      name: 'کات',
      active: true,
      duration: 45,
      price: 100,
    })

    const result = await validateCreateAppointmentIntake({
      salonId: 'salon-1',
      clientId: 'placeholder-1',
      staffId: 'staff-1',
      serviceId: 'service-1',
      date: '2026-05-01',
      startTime: '10:00',
      durationMinutes: 90,
    })

    expect(result).toMatchObject({
      ok: true,
      command: {
        endTime: '11:30',
      },
    })
  })

  it('rejects duplicate add-ons', async () => {
    const result = await validateCreateAppointmentIntake({
      salonId: 'salon-1',
      clientId: 'placeholder-1',
      staffId: 'staff-1',
      serviceId: 'service-1',
      addonIds: ['addon-1', 'addon-1'],
      date: '2026-05-01',
      startTime: '10:00',
    })

    expect(result).toMatchObject({
      ok: false,
      status: 400,
      error: 'افزودنی تکراری انتخاب شده است',
    })
  })

  it('requires add-ons to be explicit when changing service', async () => {
    const result = await validateUpdateAppointmentIntake({
      salonId: 'salon-1',
      appointmentId: 'appointment-1',
      existing: {
        id: 'appointment-1',
        clientId: 'placeholder-1',
        staffId: 'staff-1',
        serviceId: 'service-1',
        bookedServiceName: 'Cut',
        bookedServiceDuration: 45,
        bookedServicePrice: 100,
        bookedTotalDuration: 45,
        bookedTotalPrice: 100,
        bookedAddonCount: 0,
        date: '2026-05-01',
        startTime: '10:00',
        endTime: '10:45',
        status: 'scheduled',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      body: {
        serviceId: 'service-2',
      },
    })

    expect(result).toMatchObject({
      ok: false,
      status: 400,
      error: 'برای تغییر خدمت، افزودنی‌ها باید دوباره مشخص شوند',
    })
  })

  it('persists explicit start/end times when service and add-ons are unchanged', async () => {
    const result = await validateUpdateAppointmentIntake({
      salonId: 'salon-1',
      appointmentId: 'appointment-1',
      existing: {
        id: 'appointment-1',
        clientId: 'placeholder-1',
        staffId: 'staff-1',
        serviceId: 'service-1',
        bookedServiceName: 'Cut',
        bookedServiceDuration: 45,
        bookedServicePrice: 100,
        bookedTotalDuration: 45,
        bookedTotalPrice: 100,
        bookedAddonCount: 0,
        bookedAddons: [],
        date: '2026-05-01',
        startTime: '10:00',
        endTime: '10:45',
        status: 'scheduled',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      body: {
        serviceId: 'service-1',
        addonIds: [],
        startTime: '11:00',
        endTime: '12:30',
        durationMinutes: 90,
      },
    })

    expect(result).toMatchObject({
      ok: true,
      patch: {
        startTime: '11:00',
        endTime: '12:30',
      },
    })
    expect(
      result.ok && 'patch' in result && result.patch.serviceId,
    ).toBeUndefined()
    expect(
      result.ok && 'patch' in result && result.patch.addonIds,
    ).toBeUndefined()
  })

  it('keeps a custom end time when service or add-ons change', async () => {
    mocks.getServiceById.mockResolvedValue({
      id: 'service-1',
      name: 'کات جدید در کاتالوگ',
      active: true,
      duration: 60,
      price: 200,
    })
    mocks.getActiveServiceAddonsForService.mockResolvedValue([
      {
        id: 'addon-1',
        name: 'فرنچ',
        durationDelta: 15,
        priceDelta: 50,
        active: true,
      },
    ])

    const result = await validateUpdateAppointmentIntake({
      salonId: 'salon-1',
      appointmentId: 'appointment-1',
      existing: {
        id: 'appointment-1',
        clientId: 'placeholder-1',
        staffId: 'staff-1',
        serviceId: 'service-1',
        bookedServiceName: 'Cut',
        bookedServiceDuration: 45,
        bookedServicePrice: 100,
        bookedTotalDuration: 45,
        bookedTotalPrice: 100,
        bookedAddonCount: 0,
        bookedAddons: [],
        date: '2026-05-01',
        startTime: '10:00',
        endTime: '10:45',
        status: 'scheduled',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      body: {
        addonIds: ['addon-1'],
        startTime: '10:00',
        endTime: '11:30',
        durationMinutes: 90,
      },
    })

    expect(result).toMatchObject({
      ok: true,
      patch: {
        addonIds: ['addon-1'],
        startTime: '10:00',
        endTime: '11:30',
      },
    })
  })

  it('uses the existing booked base duration when only add-ons change', async () => {
    mocks.getServiceById.mockResolvedValue({
      id: 'service-1',
      name: 'کات جدید در کاتالوگ',
      active: true,
      duration: 60,
      price: 200,
    })
    mocks.getActiveServiceAddonsForService.mockResolvedValue([
      {
        id: 'addon-1',
        name: 'فرنچ',
        durationDelta: 15,
        priceDelta: 50,
        active: true,
      },
    ])

    const result = await validateUpdateAppointmentIntake({
      salonId: 'salon-1',
      appointmentId: 'appointment-1',
      existing: {
        id: 'appointment-1',
        clientId: 'placeholder-1',
        staffId: 'staff-1',
        serviceId: 'service-1',
        bookedServiceName: 'Cut',
        bookedServiceDuration: 45,
        bookedServicePrice: 100,
        bookedTotalDuration: 45,
        bookedTotalPrice: 100,
        bookedAddonCount: 0,
        date: '2026-05-01',
        startTime: '10:00',
        endTime: '10:45',
        status: 'scheduled',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      body: {
        addonIds: ['addon-1'],
      },
    })

    expect(result).toMatchObject({
      ok: true,
      patch: {
        addonIds: ['addon-1'],
        endTime: '11:00',
      },
    })
  })
})
