import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@repo/database/appointments', () => ({
  createAppointment: vi.fn(),
  deleteAppointment: vi.fn(),
  getAppointmentById: vi.fn(),
  getAppointmentWithDetailsById: vi.fn(),
  getAppointmentsWithDetailsByDateRange: vi.fn(),
  getManagerAppointmentAvailability: vi.fn(),
  updateAppointment: vi.fn(),
  validateCreateAppointmentIntake: vi.fn(),
  validateUpdateAppointmentIntake: vi.fn(),
}))

vi.mock('@repo/database/clients', () => ({
  cancelIncompletePlaceholderAppointment: vi.fn(),
  cleanupPlaceholderAfterAppointmentMutation: vi.fn(),
  completePlaceholderAppointmentClient: vi.fn(),
  createPlaceholderClient: vi.fn(),
  deletePlaceholderClientIfOrphaned: vi.fn(),
  getClientById: vi.fn(),
  updateClient: vi.fn(),
}))

vi.mock('@repo/notifications', () => ({
  createNotificationForUser: vi.fn(),
  notifyStaffOfAppointmentCreated: vi.fn(),
  isWebPushConfigured: vi.fn(() => false),
  sendWebPushToUser: vi.fn(),
  getMessagingProvider: vi.fn(),
  getBaleConfig: vi.fn(() => null),
  getTelegramConfig: vi.fn(() => null),
  renderAppointmentRequestPending: vi.fn(),
  messagingCommands: {
    handleLinkStart: vi.fn(),
    handleUnlink: vi.fn(),
  },
  sendTelegramMessage: vi.fn(),
  answerTelegramCallback: vi.fn(),
  editTelegramMessageText: vi.fn(),
  editTelegramMessageReplyMarkup: vi.fn(),
  sendBaleMessage: vi.fn(),
  answerBaleCallback: vi.fn(),
  editBaleMessageText: vi.fn(),
  editBaleMessageReplyMarkup: vi.fn(),
  renderBaleBotHtml: vi.fn((html: string) => html.replace(/<[^>]*>/g, '')),
  persistentReplyKeyboard: vi.fn(() => ({
    keyboard: [],
    is_persistent: true,
    resize_keyboard: true,
  })),
  REPLY_KEYBOARD_LABELS: {
    pending: '📋 درخواست‌های در انتظار',
    today: '📅 امروز',
    notificationSettings: '⚙️ تنظیمات اعلان‌ها',
  },
}))

vi.mock('@repo/auth/server', () => ({
  auth: { api: { getSession: vi.fn() } },
}))

vi.mock('@repo/database/staff', () => ({
  resolveStaffTenantContext: vi.fn(),
}))

vi.mock('@repo/database/members', () => ({
  getMemberForUser: vi.fn(),
  getManagerMemberForUser: vi.fn(),
}))

import * as appts from '@repo/database/appointments'
import * as clientsDb from '@repo/database/clients'
import * as notif from '@repo/notifications'
import { auth as authServer } from '@repo/auth/server'
import {
  getManagerMemberForUser,
  getMemberForUser,
} from '@repo/database/members'
import { resolveStaffTenantContext } from '@repo/database/staff'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgres://stub'
process.env.JWT_SECRET = 'test-secret'

const { app } = await import('../app')

const managerUser = {
  id: 'u1',
  salonId: 's1',
  role: 'manager' as const,
  name: 'Manager',
  phone: '09120000000',
  createdAt: new Date(),
}

const staffUser = { ...managerUser, id: 'u2', role: 'staff' as const }

const authHeaders = { Authorization: 'Bearer testtoken' }
const jsonHeaders = { ...authHeaders, 'Content-Type': 'application/json' }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(authServer.api.getSession).mockImplementation(
    async (args: any) =>
      (args?.headers?.get?.('Authorization')
        ? { user: { id: 'u1' } }
        : null) as never,
  )
  vi.mocked(getMemberForUser).mockResolvedValue({
    userId: 'u1',
    organizationId: 's1',
    role: 'owner',
    name: 'Manager',
    username: '09120000000',
  } as never)
  vi.mocked(getManagerMemberForUser).mockResolvedValue({
    userId: 'u1',
    organizationId: 's1',
    role: 'owner',
    name: 'Manager',
    username: '09120000000',
  } as never)
  vi.mocked(notif.notifyStaffOfAppointmentCreated).mockResolvedValue(
    null as never,
  )
})

describe('appointments router', () => {
  it('GET / returns 401 without auth', async () => {
    vi.mocked(authServer.api.getSession).mockResolvedValue(null as never)
    const res = await app.request(
      '/api/v1/appointments?startDate=2026-01-01&endDate=2026-01-02',
    )
    expect(res.status).toBe(401)
  })

  it('GET / returns 400 without dates', async () => {
    const res = await app.request('/api/v1/appointments', {
      headers: authHeaders,
    })
    expect(res.status).toBe(400)
  })

  it('GET / scopes to staff when role=staff', async () => {
    vi.mocked(getManagerMemberForUser).mockResolvedValue(undefined as never)
    vi.mocked(resolveStaffTenantContext).mockResolvedValue({
      status: 'ok',
      userId: 'u2',
      salonId: 's1',
      staffProfileId: 'profile-u2',
      name: 'Staff',
      phone: '09120000001',
      salonStatus: 'active',
    } as never)
    vi.mocked(authServer.api.getSession).mockResolvedValue({
      user: { id: 'u2' },
    } as never)
    vi.mocked(appts.getAppointmentsWithDetailsByDateRange).mockResolvedValue(
      [] as never,
    )
    const res = await app.request(
      '/api/v1/appointments?startDate=2026-01-01&endDate=2026-01-02',
      { headers: authHeaders },
    )
    expect(res.status).toBe(200)
    expect(appts.getAppointmentsWithDetailsByDateRange).toHaveBeenCalledWith(
      's1',
      '2026-01-01',
      '2026-01-02',
      ['u2', 'profile-u2'],
    )
  })

  it('GET / for manager passes undefined staff filter', async () => {
    vi.mocked(appts.getAppointmentsWithDetailsByDateRange).mockResolvedValue(
      [] as never,
    )
    const res = await app.request(
      '/api/v1/appointments?startDate=2026-01-01&endDate=2026-01-02',
      { headers: authHeaders },
    )
    expect(res.status).toBe(200)
    expect(appts.getAppointmentsWithDetailsByDateRange).toHaveBeenCalledWith(
      's1',
      '2026-01-01',
      '2026-01-02',
      undefined,
    )
  })

  it('POST / returns 403 for staff role', async () => {
    vi.mocked(getManagerMemberForUser).mockResolvedValue(undefined as never)
    vi.mocked(resolveStaffTenantContext).mockResolvedValue({
      status: 'ok',
      userId: 'u2',
      salonId: 's1',
      staffProfileId: 'profile-u2',
      name: 'Staff',
      phone: '09120000001',
      salonStatus: 'active',
    } as never)
    const res = await app.request('/api/v1/appointments', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(403)
  })

  it('POST / returns 400 on invalid body', async () => {
    const res = await app.request('/api/v1/appointments', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ staffId: '', serviceId: '' }),
    })
    expect(res.status).toBe(400)
  })

  it('POST / propagates intake error code/status', async () => {
    vi.mocked(appts.validateCreateAppointmentIntake).mockResolvedValue({
      ok: false,
      status: 409,
      error: 'تداخل برنامه',
      code: 'schedule-conflict',
    } as never)
    const res = await app.request('/api/v1/appointments', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        clientId: 'c1',
        staffId: 'u1',
        serviceId: 'svc1',
        date: '2026-06-01',
        startTime: '10:00',
        durationMinutes: 30,
      }),
    })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      error: 'تداخل برنامه',
      code: 'schedule-conflict',
    })
  })

  it('POST / creates appointment and returns detail', async () => {
    vi.mocked(appts.validateCreateAppointmentIntake).mockResolvedValue({
      ok: true,
      command: {} as never,
      client: { id: 'c1', name: 'Ali' },
      staff: { id: 'u1', name: 'M' },
      service: { id: 'svc1', name: 'Cut' },
    } as never)
    vi.mocked(appts.createAppointment).mockResolvedValue({
      id: 'a1',
      date: '2026-06-01',
      startTime: '10:00',
      clientId: 'c1',
      staffId: 'u1',
      serviceId: 'svc1',
    } as never)
    vi.mocked(appts.getAppointmentWithDetailsById).mockResolvedValue({
      id: 'a1',
      detail: true,
      bookedTotalPrice: 275000,
    } as never)
    const res = await app.request('/api/v1/appointments', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        clientId: 'c1',
        staffId: 'u1',
        serviceId: 'svc1',
        date: '2026-06-01',
        startTime: '10:00',
        durationMinutes: 30,
        finalPrice: 275000,
      }),
    })
    expect(res.status).toBe(200)
    expect(appts.createAppointment).toHaveBeenCalledWith(
      expect.anything(),
      's1',
      { createdByUserId: 'u1', finalPrice: 275000 },
    )
    expect(await res.json()).toEqual({
      appointment: { id: 'a1', detail: true, bookedTotalPrice: 275000 },
    })
  })

  it('POST / leaves calculated pricing in place when finalPrice is omitted', async () => {
    vi.mocked(appts.validateCreateAppointmentIntake).mockResolvedValue({
      ok: true,
      command: {} as never,
      client: { id: 'c1', name: 'Ali' },
      staff: { id: 'u1', name: 'M' },
      service: { id: 'svc1', name: 'Cut' },
    } as never)
    vi.mocked(appts.createAppointment).mockResolvedValue({
      id: 'a1',
      date: '2026-06-01',
      startTime: '10:00',
      clientId: 'c1',
      staffId: 'u1',
      serviceId: 'svc1',
    } as never)
    vi.mocked(appts.getAppointmentWithDetailsById).mockResolvedValue({
      id: 'a1',
      bookedTotalPrice: 120000,
    } as never)

    const res = await app.request('/api/v1/appointments', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        clientId: 'c1',
        staffId: 'u1',
        serviceId: 'svc1',
        date: '2026-06-01',
        startTime: '10:00',
        durationMinutes: 30,
      }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      appointment: { id: 'a1', bookedTotalPrice: 120000 },
    })
    expect(appts.createAppointment).toHaveBeenCalledWith(
      expect.anything(),
      's1',
      { createdByUserId: 'u1', finalPrice: undefined },
    )
  })

  it('POST / rejects an invalid finalPrice', async () => {
    const res = await app.request('/api/v1/appointments', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        clientId: 'c1',
        staffId: 'u1',
        serviceId: 'svc1',
        date: '2026-06-01',
        startTime: '10:00',
        durationMinutes: 30,
        finalPrice: -1,
      }),
    })
    expect(res.status).toBe(400)
    expect(appts.createAppointment).not.toHaveBeenCalled()
  })

  it('POST / notifies assigned staff via active Staff Profile Access with salon context', async () => {
    vi.mocked(appts.validateCreateAppointmentIntake).mockResolvedValue({
      ok: true,
      command: {} as never,
      client: { id: 'c1', name: 'Ali' },
      staff: { id: 'u2', name: 'Staff' },
      service: { id: 'svc1', name: 'Cut' },
    } as never)
    vi.mocked(appts.createAppointment).mockResolvedValue({
      id: 'a1',
      date: '2026-06-01',
      startTime: '10:00',
      clientId: 'c1',
      staffId: 'u2',
      serviceId: 'svc1',
    } as never)
    vi.mocked(appts.getAppointmentWithDetailsById).mockResolvedValue({
      id: 'a1',
      detail: true,
    } as never)
    vi.mocked(notif.notifyStaffOfAppointmentCreated).mockResolvedValue({
      id: 'n1',
      userId: 'u2',
      salonId: 's1',
      title: 'نوبت جدید — سالن آفتاب',
      body: 'Ali، Cut، 2026-06-01 ساعت 10:00',
    } as never)
    vi.mocked(notif.isWebPushConfigured).mockReturnValue(true)

    const res = await app.request('/api/v1/appointments', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        clientId: 'c1',
        staffId: 'u2',
        serviceId: 'svc1',
        date: '2026-06-01',
        startTime: '10:00',
        durationMinutes: 30,
      }),
    })

    expect(res.status).toBe(200)
    expect(notif.notifyStaffOfAppointmentCreated).toHaveBeenCalledWith({
      salonId: 's1',
      staffId: 'u2',
      actorUserId: 'u1',
      appointment: {
        id: 'a1',
        date: '2026-06-01',
        startTime: '10:00',
        clientId: 'c1',
        staffId: 'u2',
        serviceId: 'svc1',
      },
      clientName: 'Ali',
      serviceName: 'Cut',
    })
    expect(notif.sendWebPushToUser).toHaveBeenCalledWith('u2', {
      title: 'نوبت جدید — سالن آفتاب',
      body: 'Ali، Cut، 2026-06-01 ساعت 10:00',
      url: '/calendar?date=2026-06-01&appointmentId=a1',
      tag: 'appointment-a1',
    })
  })

  it('GET /availability returns 400 on invalid mode', async () => {
    const res = await app.request(
      '/api/v1/appointments/availability?mode=bogus&serviceId=svc1&date=2026-06-01',
      { headers: authHeaders },
    )
    expect(res.status).toBe(400)
  })

  it('GET /availability calls db and returns response', async () => {
    vi.mocked(appts.getManagerAppointmentAvailability).mockResolvedValue({
      ok: true,
      response: { slots: [] },
    } as never)
    const res = await app.request(
      '/api/v1/appointments/availability?mode=day&serviceId=svc1&date=2026-06-01',
      { headers: authHeaders },
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ slots: [] })
  })

  it('GET /:id returns 404 when missing', async () => {
    vi.mocked(appts.getAppointmentWithDetailsById).mockResolvedValue(
      undefined as never,
    )
    const res = await app.request('/api/v1/appointments/a1', {
      headers: authHeaders,
    })
    expect(res.status).toBe(404)
  })

  it('GET /:id 403 for staff viewing other staff appointment', async () => {
    vi.mocked(getManagerMemberForUser).mockResolvedValue(undefined as never)
    vi.mocked(resolveStaffTenantContext).mockResolvedValue({
      status: 'ok',
      userId: 'u2',
      salonId: 's1',
      staffProfileId: 'profile-u2',
      name: 'Staff',
      phone: '09120000001',
      salonStatus: 'active',
    } as never)
    vi.mocked(appts.getAppointmentWithDetailsById).mockResolvedValue({
      id: 'a1',
      staffId: 'other',
    } as never)
    const res = await app.request('/api/v1/appointments/a1', {
      headers: authHeaders,
    })
    expect(res.status).toBe(403)
  })

  it('GET /:id allows staff when appointment staffId is the linked Staff Profile', async () => {
    vi.mocked(getManagerMemberForUser).mockResolvedValue(undefined as never)
    vi.mocked(resolveStaffTenantContext).mockResolvedValue({
      status: 'ok',
      userId: 'u2',
      salonId: 's1',
      staffProfileId: 'profile-u2',
      name: 'Staff',
      phone: '09120000001',
      salonStatus: 'active',
    } as never)
    vi.mocked(appts.getAppointmentWithDetailsById).mockResolvedValue({
      id: 'a1',
      staffId: 'profile-u2',
    } as never)
    const res = await app.request('/api/v1/appointments/a1', {
      headers: authHeaders,
    })
    expect(res.status).toBe(200)
  })

  it('rejects staff tenant appointment list for a wrong salon context', async () => {
    vi.mocked(getManagerMemberForUser).mockResolvedValue(undefined as never)
    vi.mocked(resolveStaffTenantContext).mockResolvedValue({
      status: 'rejected',
      reason: 'wrong_salon',
    } as never)
    const res = await app.request(
      '/api/v1/appointments?startDate=2026-01-01&endDate=2026-01-02',
      { headers: { ...authHeaders, 'X-Saluna-Salon-Id': 'salon-other' } },
    )
    expect(res.status).toBe(403)
    expect(appts.getAppointmentsWithDetailsByDateRange).not.toHaveBeenCalled()
  })

  it('rejects pending-invite staff with no Staff Profile Access on appointments', async () => {
    vi.mocked(getManagerMemberForUser).mockResolvedValue(undefined as never)
    vi.mocked(resolveStaffTenantContext).mockResolvedValue({
      status: 'rejected',
      reason: 'no_access',
    } as never)
    const res = await app.request(
      '/api/v1/appointments?startDate=2026-01-01&endDate=2026-01-02',
      { headers: authHeaders },
    )
    expect(res.status).toBe(403)
  })

  it('rejects revoked Staff Profile Access on appointment status changes', async () => {
    vi.mocked(getManagerMemberForUser).mockResolvedValue(undefined as never)
    vi.mocked(resolveStaffTenantContext).mockResolvedValue({
      status: 'rejected',
      reason: 'no_access',
    } as never)
    const res = await app.request('/api/v1/appointments/a1', {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({ status: 'completed' }),
    })
    expect(res.status).toBe(403)
    expect(appts.getAppointmentById).not.toHaveBeenCalled()
  })

  it('PATCH /:id 403 for staff doing non-status patch', async () => {
    vi.mocked(getManagerMemberForUser).mockResolvedValue(undefined as never)
    vi.mocked(resolveStaffTenantContext).mockResolvedValue({
      status: 'ok',
      userId: 'u2',
      salonId: 's1',
      staffProfileId: 'profile-u2',
      name: 'Staff',
      phone: '09120000001',
      salonStatus: 'active',
    } as never)
    vi.mocked(appts.getAppointmentById).mockResolvedValue({
      id: 'a1',
      staffId: 'u2',
      clientId: 'c1',
    } as never)
    vi.mocked(clientsDb.getClientById).mockResolvedValue({
      id: 'c1',
      isPlaceholder: false,
    } as never)
    const res = await app.request('/api/v1/appointments/a1', {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({ notes: 'hi' }),
    })
    expect(res.status).toBe(403)
  })

  it('PATCH /:id rejects a staff price change', async () => {
    vi.mocked(getManagerMemberForUser).mockResolvedValue(undefined as never)
    vi.mocked(resolveStaffTenantContext).mockResolvedValue({
      status: 'ok',
      userId: 'u2',
      salonId: 's1',
      staffProfileId: 'profile-u2',
      name: 'Staff',
      phone: '09120000001',
      salonStatus: 'active',
    } as never)
    vi.mocked(appts.getAppointmentById).mockResolvedValue({
      id: 'a1',
      staffId: 'profile-u2',
      clientId: 'c1',
      date: '2026-06-01',
      endTime: '10:00',
    } as never)
    vi.mocked(clientsDb.getClientById).mockResolvedValue({
      id: 'c1',
      isPlaceholder: false,
    } as never)

    const res = await app.request('/api/v1/appointments/a1', {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({ finalPrice: 125_000 }),
    })

    expect(res.status).toBe(403)
    expect(appts.validateUpdateAppointmentIntake).not.toHaveBeenCalled()
  })

  it('PATCH /:id allows staff status-only update on own appointment', async () => {
    vi.mocked(getManagerMemberForUser).mockResolvedValue(undefined as never)
    vi.mocked(resolveStaffTenantContext).mockResolvedValue({
      status: 'ok',
      userId: 'u2',
      salonId: 's1',
      staffProfileId: 'profile-u2',
      name: 'Staff',
      phone: '09120000001',
      salonStatus: 'active',
    } as never)
    vi.mocked(appts.getAppointmentById).mockResolvedValue({
      id: 'a1',
      staffId: 'u2',
      clientId: 'c1',
    } as never)
    vi.mocked(clientsDb.getClientById).mockResolvedValue({
      id: 'c1',
      isPlaceholder: false,
    } as never)
    vi.mocked(appts.validateUpdateAppointmentIntake).mockResolvedValue({
      ok: true,
      patch: { status: 'completed' },
      client: { id: 'c1', name: 'X' },
      staff: { id: 'u2', name: 'S' },
      service: { id: 'svc1', name: 'Cut' },
    } as never)
    vi.mocked(appts.updateAppointment).mockResolvedValue({
      id: 'a1',
      clientId: 'c1',
    } as never)
    vi.mocked(appts.getAppointmentWithDetailsById).mockResolvedValue({
      id: 'a1',
      status: 'completed',
    } as never)
    const res = await app.request('/api/v1/appointments/a1', {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({ status: 'completed' }),
    })
    expect(res.status).toBe(200)
  })

  it('PATCH /:id manager cancelling placeholder returns cleanup shape', async () => {
    vi.mocked(appts.getAppointmentById).mockResolvedValue({
      id: 'a1',
      staffId: 'u1',
      clientId: 'c1',
    } as never)
    vi.mocked(clientsDb.getClientById).mockResolvedValue({
      id: 'c1',
      isPlaceholder: true,
    } as never)
    vi.mocked(
      clientsDb.cancelIncompletePlaceholderAppointment,
    ).mockResolvedValue({
      ok: true,
      appointmentDeleted: true,
      placeholderDeleted: true,
      clientId: 'c1',
    } as never)
    const res = await app.request('/api/v1/appointments/a1', {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({ status: 'cancelled' }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      success: true,
      removedAppointmentId: 'a1',
      cleanup: true,
    })
  })

  it.each([
    ['before the scheduled end', '2026-06-01T06:29:00.000Z'],
    ['at the 24-hour boundary', '2026-06-02T06:30:00.000Z'],
  ])('PATCH /:id allows a manager price change %s', async (_, now) => {
    vi.setSystemTime(now)
    vi.mocked(appts.getAppointmentById).mockResolvedValue({
      id: 'a1',
      staffId: 'u1',
      clientId: 'c1',
      date: '2026-06-01',
      endTime: '10:00',
      bookedTotalPrice: 100_000,
    } as never)
    vi.mocked(clientsDb.getClientById).mockResolvedValue({
      id: 'c1',
      isPlaceholder: false,
    } as never)
    vi.mocked(appts.validateUpdateAppointmentIntake).mockResolvedValue({
      ok: true,
      patch: { bookedTotalPrice: 125_000 },
      client: { id: 'c1' },
      staff: { id: 'u1' },
      service: { id: 'svc1' },
    } as never)
    vi.mocked(appts.updateAppointment).mockResolvedValue({
      id: 'a1',
      clientId: 'c1',
    } as never)

    const res = await app.request('/api/v1/appointments/a1', {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({ finalPrice: 125_000 }),
    })

    expect(res.status).toBe(200)
    expect(appts.validateUpdateAppointmentIntake).toHaveBeenCalledWith(
      expect.objectContaining({ body: { finalPrice: 125_000 } }),
    )
  })

  it('PATCH /:id rejects a manager price change after the 24-hour boundary', async () => {
    vi.setSystemTime('2026-06-02T06:30:00.001Z')
    vi.mocked(appts.getAppointmentById).mockResolvedValue({
      id: 'a1',
      staffId: 'u1',
      clientId: 'c1',
      date: '2026-06-01',
      endTime: '10:00',
      bookedTotalPrice: 100_000,
    } as never)
    vi.mocked(clientsDb.getClientById).mockResolvedValue({
      id: 'c1',
      isPlaceholder: false,
    } as never)

    const res = await app.request('/api/v1/appointments/a1', {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({ finalPrice: 125_000 }),
    })

    expect(res.status).toBe(409)
    expect(appts.validateUpdateAppointmentIntake).not.toHaveBeenCalled()
  })

  it('DELETE /:id returns 403 for staff', async () => {
    vi.mocked(getManagerMemberForUser).mockResolvedValue(undefined as never)
    vi.mocked(resolveStaffTenantContext).mockResolvedValue({
      status: 'ok',
      userId: 'u2',
      salonId: 's1',
      staffProfileId: 'profile-u2',
      name: 'Staff',
      phone: '09120000001',
      salonStatus: 'active',
    } as never)
    const res = await app.request('/api/v1/appointments/a1', {
      method: 'DELETE',
      headers: authHeaders,
    })
    expect(res.status).toBe(403)
  })

  it('DELETE /:id returns 404 when not found', async () => {
    vi.mocked(appts.getAppointmentById).mockResolvedValue(undefined as never)
    vi.mocked(appts.deleteAppointment).mockResolvedValue(false as never)
    const res = await app.request('/api/v1/appointments/a1', {
      method: 'DELETE',
      headers: authHeaders,
    })
    expect(res.status).toBe(404)
  })

  it('DELETE /:id success triggers cleanup', async () => {
    vi.mocked(appts.getAppointmentById).mockResolvedValue({
      id: 'a1',
      clientId: 'c1',
    } as never)
    vi.mocked(appts.deleteAppointment).mockResolvedValue(true as never)
    const res = await app.request('/api/v1/appointments/a1', {
      method: 'DELETE',
      headers: authHeaders,
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
    expect(
      clientsDb.cleanupPlaceholderAfterAppointmentMutation,
    ).toHaveBeenCalled()
  })

  it('POST /:id/complete-client propagates 409 with existingClient', async () => {
    vi.mocked(clientsDb.completePlaceholderAppointmentClient).mockResolvedValue(
      {
        ok: false,
        status: 409,
        error: 'این شماره تماس برای مشتری دیگری ثبت شده است',
        code: 'duplicate-phone',
        existingClient: { id: 'c2', name: 'Other' },
      } as never,
    )
    const res = await app.request('/api/v1/appointments/a1/complete-client', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ name: 'Ali', phone: '09121234567' }),
    })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      error: 'این شماره تماس برای مشتری دیگری ثبت شده است',
      code: 'duplicate-phone',
      existingClient: { id: 'c2', name: 'Other' },
    })
  })

  it('POST /:id/complete-client success returns outcome', async () => {
    vi.mocked(clientsDb.completePlaceholderAppointmentClient).mockResolvedValue(
      {
        ok: true,
        appointment: { id: 'a1' },
        outcome: 'completed',
      } as never,
    )
    const res = await app.request('/api/v1/appointments/a1/complete-client', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ name: 'Ali', phone: '09121234567' }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      appointment: { id: 'a1' },
      outcome: 'completed',
    })
  })
})
