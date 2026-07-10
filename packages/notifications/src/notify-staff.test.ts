import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  resolveStaffNotificationRecipient: vi.fn(),
  createNotificationForUser: vi.fn(),
}))

vi.mock('@repo/database/staff', () => ({
  resolveStaffNotificationRecipient: mocks.resolveStaffNotificationRecipient,
}))

vi.mock('./notifications', () => ({
  createNotificationForUser: mocks.createNotificationForUser,
}))

import { notifyStaffOfAppointmentCreated } from './notify-staff'

const appointment = {
  id: 'appt-1',
  date: '2026-07-11',
  startTime: '10:00',
  clientId: 'client-1',
  staffId: 'user-staff',
  serviceId: 'svc-1',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('notifyStaffOfAppointmentCreated', () => {
  it('creates a notification with salon context for active Staff Profile Access', async () => {
    mocks.resolveStaffNotificationRecipient.mockResolvedValue({
      userId: 'user-staff',
      staffProfileId: 'profile-a',
      salonId: 'salon-a',
      salonName: 'سالن آفتاب',
    })
    mocks.createNotificationForUser.mockResolvedValue({ id: 'n1' })

    const result = await notifyStaffOfAppointmentCreated({
      salonId: 'salon-a',
      staffId: 'user-staff',
      actorUserId: 'manager-1',
      appointment,
      clientName: 'مینا',
      serviceName: 'کاشت',
    })

    expect(result).toEqual({ id: 'n1' })
    expect(mocks.resolveStaffNotificationRecipient).toHaveBeenCalledWith({
      salonId: 'salon-a',
      staffId: 'user-staff',
    })
    expect(mocks.createNotificationForUser).toHaveBeenCalledWith(
      expect.objectContaining({
        salonId: 'salon-a',
        userId: 'user-staff',
        type: 'appointment_created',
        title: 'نوبت جدید — سالن آفتاب',
        data: expect.objectContaining({
          salonId: 'salon-a',
          salonName: 'سالن آفتاب',
          staffProfileId: 'profile-a',
        }),
      }),
    )
  })

  it('does not notify when Staff Profile Access is missing (pending/declined/expired/revoked)', async () => {
    mocks.resolveStaffNotificationRecipient.mockResolvedValue(null)

    const result = await notifyStaffOfAppointmentCreated({
      salonId: 'salon-a',
      staffId: 'pending-profile',
      actorUserId: 'manager-1',
      appointment: { ...appointment, staffId: 'pending-profile' },
      clientName: 'مینا',
      serviceName: 'کاشت',
    })

    expect(result).toBeNull()
    expect(mocks.createNotificationForUser).not.toHaveBeenCalled()
  })

  it('does not notify the actor when they are the assigned staff', async () => {
    mocks.resolveStaffNotificationRecipient.mockResolvedValue({
      userId: 'user-staff',
      staffProfileId: 'profile-a',
      salonId: 'salon-a',
      salonName: 'سالن آفتاب',
    })

    const result = await notifyStaffOfAppointmentCreated({
      salonId: 'salon-a',
      staffId: 'user-staff',
      actorUserId: 'user-staff',
      appointment,
      clientName: 'مینا',
      serviceName: 'کاشت',
    })

    expect(result).toBeNull()
    expect(mocks.createNotificationForUser).not.toHaveBeenCalled()
  })

  it('notifies multi-salon staff for the event salon without requiring current selection', async () => {
    mocks.resolveStaffNotificationRecipient.mockResolvedValue({
      userId: 'user-multi',
      staffProfileId: 'profile-b',
      salonId: 'salon-b',
      salonName: 'سالن مهتاب',
    })
    mocks.createNotificationForUser.mockResolvedValue({ id: 'n2' })

    await notifyStaffOfAppointmentCreated({
      salonId: 'salon-b',
      staffId: 'profile-b',
      actorUserId: 'manager-1',
      appointment: { ...appointment, staffId: 'profile-b' },
      clientName: 'سارا',
      serviceName: 'رنگ',
    })

    expect(mocks.createNotificationForUser).toHaveBeenCalledWith(
      expect.objectContaining({
        salonId: 'salon-b',
        userId: 'user-multi',
        title: 'نوبت جدید — سالن مهتاب',
        data: expect.objectContaining({
          salonId: 'salon-b',
          salonName: 'سالن مهتاب',
        }),
      }),
    )
  })
})
