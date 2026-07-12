import { describe, expect, it } from 'vitest'

import type { Service, ServiceAddon, User } from '@repo/salon-core/types'
import { appointmentFormSchema } from '@repo/salon-core/forms/appointment'

import {
  appointmentCreateFormDefaults,
  availabilitySelectionToCreateIntent,
  buildAppointmentCreateViewModel,
  buildStatusActionState,
  catalogDurationMinutes,
  clampAppointmentDuration,
  resolveIntakeAddonToggle,
  resolveIntakeServiceChange,
  resolveIntakeStaffChange,
  resolveTemporaryClientModeChange,
  validateAppointmentIntakeSubmit,
} from './appointment-intake'

const staffMember: User = {
  id: 's1',
  role: 'staff',
  name: 'کارمند',
} as User

const service: Service = {
  id: 'svc1',
  name: 'کوتاهی',
  duration: 45,
  price: 100_000,
  active: true,
} as Service

const addon: ServiceAddon = {
  id: 'addon-a',
  salonId: 'salon',
  name: 'رنگ',
  priceDelta: 20_000,
  durationDelta: 10,
  active: true,
  sortOrder: 1,
  scopes: [],
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('appointmentCreateFormDefaults', () => {
  it('uses the selected service duration when provided', () => {
    expect(
      appointmentCreateFormDefaults({
        initialDate: '2026-06-02',
        initialTime: '10:00',
        initialServiceId: 'svc1',
        services: [service],
      }),
    ).toMatchObject({
      date: '2026-06-02',
      startTime: '10:00',
      endTime: '10:45',
      durationMinutes: 45,
      serviceId: 'svc1',
      finalPrice: 100_000,
    })
  })

  it('lets a manager replace the calculated final price before creation', () => {
    const defaults = appointmentCreateFormDefaults({
      initialDate: '2026-06-02',
      initialTime: '10:00',
      initialServiceId: 'svc1',
      initialClientId: 'client-1',
      initialStaffId: 's1',
      services: [service],
    })

    expect(
      appointmentFormSchema.parse({ ...defaults, finalPrice: '۸۵۰۰۰' }),
    ).toMatchObject({ finalPrice: 85_000 })
  })
})

describe('buildAppointmentCreateViewModel', () => {
  it('marks services without staff as disabled', () => {
    const vm = buildAppointmentCreateViewModel({
      staff: [staffMember],
      services: [service],
      staffId: '',
      serviceId: '',
      addonIds: [],
      availableAddons: [],
      durationMinutes: 45,
      staffSlotOk: { s1: true },
    })

    expect(vm.serviceDisabledReason(service)).toBeNull()
    expect(vm.previewPrice).toBe(0)
  })

  it('disables staff outside schedule', () => {
    const vm = buildAppointmentCreateViewModel({
      staff: [staffMember],
      services: [service],
      staffId: 's1',
      serviceId: 'svc1',
      addonIds: [],
      availableAddons: [],
      durationMinutes: 45,
      staffSlotOk: { s1: false },
    })

    expect(vm.staffPickerStatus(staffMember)).toEqual({
      disabled: true,
      reason: 'خارج از برنامه',
    })
  })

  it('keeps services selectable when only the current time is unavailable', () => {
    const vm = buildAppointmentCreateViewModel({
      staff: [staffMember],
      services: [service],
      staffId: '',
      serviceId: '',
      addonIds: [],
      availableAddons: [],
      durationMinutes: 45,
      staffSlotOk: { s1: false },
    })

    expect(vm.serviceDisabledReason(service)).toBeNull()
    expect(vm.serviceStatusReason(service)).toBe('برای این ساعت در دسترس نیست')
  })

  it('still disables services that no staff can perform', () => {
    const vm = buildAppointmentCreateViewModel({
      staff: [{ ...staffMember, serviceIds: ['other'] }],
      services: [service],
      staffId: '',
      serviceId: '',
      addonIds: [],
      availableAddons: [],
      durationMinutes: 45,
      staffSlotOk: { s1: true },
    })

    expect(vm.serviceDisabledReason(service)).toBe('بدون پرسنل')
    expect(vm.serviceStatusReason(service)).toBeNull()
  })
})

describe('resolveIntakeServiceChange', () => {
  it('clears addons and picks the first eligible staff member', () => {
    expect(
      resolveIntakeServiceChange({
        serviceId: 'svc1',
        staffId: 'missing',
        staffRoleOnly: [staffMember],
        services: [service],
      }),
    ).toEqual({
      serviceId: 'svc1',
      staffId: 's1',
      addonIds: [],
      durationMinutes: 45,
    })
  })
})

describe('resolveIntakeStaffChange', () => {
  it('auto-picks a service when the current one is ineligible', () => {
    expect(
      resolveIntakeStaffChange({
        staffId: 's1',
        serviceId: '',
        staffRoleOnly: [staffMember],
        services: [service],
      }),
    ).toEqual({
      staffId: 's1',
      serviceId: 'svc1',
      durationMinutes: 45,
    })
  })
})

describe('resolveTemporaryClientModeChange', () => {
  it('clears client selection and optional fields when enabling fill-later mode', () => {
    expect(resolveTemporaryClientModeChange(true)).toEqual({
      useTemporaryClient: true,
      clientId: '',
      temporaryClientName: '',
      temporaryClientNotes: '',
    })
  })

  it('prefills placeholder client details when enabling edit flow', () => {
    expect(
      resolveTemporaryClientModeChange(true, {
        prefill: { name: 'دوست سارا', notes: 'بعدا تماس' },
      }),
    ).toEqual({
      useTemporaryClient: true,
      clientId: '',
      temporaryClientName: 'دوست سارا',
      temporaryClientNotes: 'بعدا تماس',
    })
  })

  it('clears temporary fields without touching clientId when disabling', () => {
    expect(resolveTemporaryClientModeChange(false)).toEqual({
      useTemporaryClient: false,
      temporaryClientName: '',
      temporaryClientNotes: '',
    })
  })
})

describe('resolveIntakeAddonToggle', () => {
  it('adds addon duration to the preview duration', () => {
    expect(
      resolveIntakeAddonToggle({
        addon,
        addonIds: [],
        availableAddons: [addon],
        selectedService: service,
      }),
    ).toEqual({
      addonIds: ['addon-a'],
      durationMinutes: 55,
    })
  })
})

describe('validateAppointmentIntakeSubmit', () => {
  it('rejects staff who cannot perform the selected service', () => {
    const mismatchStaff: User = {
      ...staffMember,
      id: 's2',
      serviceIds: ['other'],
    }

    expect(
      validateAppointmentIntakeSubmit({
        values: {
          serviceId: 'svc1',
          staffId: 's2',
          startTime: '10:00',
          endTime: '10:45',
        },
        activeServices: [service, { ...service, id: 'other', active: true }],
        staffRoleOnly: [mismatchStaff],
        serviceIdsWithStaff: new Set(['svc1', 'other']),
      }),
    ).toEqual({
      field: 'staffId',
      message: 'این پرسنل نمی‌تواند خدمت انتخاب‌شده را انجام دهد.',
    })
  })

  it('rejects an invalid start/end window on root', () => {
    expect(
      validateAppointmentIntakeSubmit({
        values: {
          serviceId: 'svc1',
          staffId: 's1',
          startTime: '10:00',
          endTime: '09:00',
        },
        activeServices: [service],
        staffRoleOnly: [{ ...staffMember, serviceIds: ['svc1'] }],
        serviceIdsWithStaff: new Set(['svc1']),
      }),
    ).toMatchObject({ field: 'root' })
  })
})

describe('buildStatusActionState', () => {
  it('uses queued copy when offline with a data client', () => {
    expect(
      buildStatusActionState({
        nextStatus: 'confirmed',
        hasDataClient: true,
        isOnline: false,
        changeType: 'updated',
        phase: 'done',
      }),
    ).toMatchObject({
      mode: 'queued',
      message: 'وضعیت نوبت آفلاین ثبت شد و بعدا همگام می‌شود.',
    })
  })
})

describe('availabilitySelectionToCreateIntent', () => {
  it('maps availability slot fields to create intent', () => {
    expect(
      availabilitySelectionToCreateIntent({
        slot: { date: '2026-06-02', startTime: '11:00', staffId: 's1' },
        serviceId: 'svc1',
      }),
    ).toEqual({
      date: '2026-06-02',
      time: '11:00',
      staffId: 's1',
      serviceId: 'svc1',
    })
  })
})

describe('clampAppointmentDuration', () => {
  it('clamps to appointment bounds', () => {
    expect(clampAppointmentDuration(3)).toBe(5)
    expect(catalogDurationMinutes(service, [addon])).toBe(55)
  })
})
