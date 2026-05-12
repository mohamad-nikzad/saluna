import { describe, expect, it } from 'vitest'
import { createAppointmentsApi } from './appointments'
import { createBusinessSettingsApi } from './business-settings'
import { createApiClient } from './client'
import { createClientsApi } from './clients'
import { createDashboardApi } from './dashboard'
import {
  createNotificationPreferencesApi,
  createNotificationsApi,
} from './notifications'
import { createOnboardingApi } from './onboarding'
import { createRetentionApi } from './retention'
import { createServicesApi } from './services'
import { createStaffApi } from './staff'

type FetchCall = {
  url: string
  init: RequestInit
}

function createMockedFetchClient(payload: unknown = { ok: true }) {
  const calls: FetchCall[] = []
  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} })
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const client = createApiClient({
    baseUrl: 'https://example.test',
    getToken: () => 'token-123',
    fetchImpl,
    credentials: 'omit',
  })

  return { client, calls }
}

function expectLastCall(
  calls: FetchCall[],
  expected: { path: string; method?: string; body?: unknown },
) {
  const call = calls.at(-1)
  expect(call).toBeDefined()
  expect(call?.url).toBe(`https://example.test${expected.path}`)
  expect(call?.init.method).toBe(expected.method ?? 'GET')
  expect(call?.init.credentials).toBe('omit')
  expect(call?.init.headers).toMatchObject({
    Accept: 'application/json',
    Authorization: 'Bearer token-123',
  })
  if ('body' in expected) {
    expect(call?.init.headers).toMatchObject({ 'Content-Type': 'application/json' })
    expect(call?.init.body).toBe(JSON.stringify(expected.body))
  } else {
    expect(call?.init.body).toBeUndefined()
  }
}

describe('api modules', () => {
  it('wraps dashboard routes', async () => {
    const { client, calls } = createMockedFetchClient({})
    await createDashboardApi(client).get()
    expectLastCall(calls, { path: '/api/dashboard' })
  })

  it('wraps onboarding routes', async () => {
    const { client, calls } = createMockedFetchClient({ onboarding: {} })
    const api = createOnboardingApi(client)

    await api.get()
    expectLastCall(calls, { path: '/api/onboarding' })

    await api.update('confirm-profile')
    expectLastCall(calls, {
      path: '/api/onboarding',
      method: 'PATCH',
      body: { action: 'confirm-profile' },
    })
  })

  it('wraps retention routes', async () => {
    const { client, calls } = createMockedFetchClient({ items: [] })
    const api = createRetentionApi(client)

    await api.list()
    expectLastCall(calls, { path: '/api/retention' })

    await api.updateStatus('follow-1', 'reviewed')
    expectLastCall(calls, {
      path: '/api/retention/follow-1',
      method: 'PATCH',
      body: { status: 'reviewed' },
    })
  })

  it('wraps business settings routes', async () => {
    const { client, calls } = createMockedFetchClient({ settings: {} })
    const api = createBusinessSettingsApi(client)

    await api.get()
    expectLastCall(calls, { path: '/api/settings/business' })

    await api.update({ workingStart: '09:00', workingEnd: '18:00' })
    expectLastCall(calls, {
      path: '/api/settings/business',
      method: 'PATCH',
      body: { workingStart: '09:00', workingEnd: '18:00' },
    })
  })

  it('wraps client routes', async () => {
    const { client, calls } = createMockedFetchClient({ client: {} })
    const api = createClientsApi(client)

    await api.list()
    expectLastCall(calls, { path: '/api/clients' })

    await api.get('client-1')
    expectLastCall(calls, { path: '/api/clients/client-1' })

    await api.create({ name: 'Nika', phone: '09123456789', tags: [] })
    expectLastCall(calls, {
      path: '/api/clients',
      method: 'POST',
      body: { name: 'Nika', phone: '09123456789', tags: [] },
    })

    await api.update('client-1', { notes: 'VIP' })
    expectLastCall(calls, {
      path: '/api/clients/client-1',
      method: 'PATCH',
      body: { notes: 'VIP' },
    })

    await api.summary('client-1')
    expectLastCall(calls, { path: '/api/clients/client-1/summary' })

    await api.createFollowUp('client-1', { reason: 'manual', dueDate: '2026-05-12' })
    expectLastCall(calls, {
      path: '/api/clients/client-1/follow-ups',
      method: 'POST',
      body: { reason: 'manual', dueDate: '2026-05-12' },
    })
  })

  it('wraps service routes', async () => {
    const { client, calls } = createMockedFetchClient({ service: {} })
    const api = createServicesApi(client)

    await api.list({ includeInactive: true })
    expectLastCall(calls, { path: '/api/services?all=1' })

    await api.get('service-1')
    expectLastCall(calls, { path: '/api/services/service-1' })

    await api.create({
      name: 'Cut',
      category: 'hair',
      duration: 45,
      price: 100,
      color: 'rose',
      active: true,
    })
    expectLastCall(calls, {
      path: '/api/services',
      method: 'POST',
      body: {
        name: 'Cut',
        category: 'hair',
        duration: 45,
        price: 100,
        color: 'rose',
        active: true,
      },
    })

    await api.update('service-1', { active: false })
    expectLastCall(calls, {
      path: '/api/services/service-1',
      method: 'PATCH',
      body: { active: false },
    })
  })

  it('wraps staff routes', async () => {
    const { client, calls } = createMockedFetchClient({ staff: [] })
    const api = createStaffApi(client)

    await api.list()
    expectLastCall(calls, { path: '/api/staff' })

    await api.create({
      name: 'Sara',
      phone: '09123456789',
      password: 'secret1',
      role: 'staff',
    })
    expectLastCall(calls, {
      path: '/api/staff',
      method: 'POST',
      body: {
        name: 'Sara',
        phone: '09123456789',
        password: 'secret1',
        role: 'staff',
      },
    })

    await api.updateServices('staff-1', { serviceIds: ['service-1'] })
    expectLastCall(calls, {
      path: '/api/staff/staff-1/services',
      method: 'PATCH',
      body: { serviceIds: ['service-1'] },
    })

    await api.getSchedule('staff-1')
    expectLastCall(calls, { path: '/api/staff/staff-1/schedule' })

    await api.updateSchedule('staff-1', {
      schedule: [
        {
          dayOfWeek: 0,
          active: true,
          workingStart: '09:00',
          workingEnd: '18:00',
        },
      ],
    })
    expectLastCall(calls, {
      path: '/api/staff/staff-1/schedule',
      method: 'PUT',
      body: {
        schedule: [
          {
            dayOfWeek: 0,
            active: true,
            workingStart: '09:00',
            workingEnd: '18:00',
          },
        ],
      },
    })

    await api.bookingAvailability({
      date: '2026-05-12',
      startTime: '10:00',
      endTime: '11:00',
    })
    expectLastCall(calls, {
      path: '/api/staff/booking-availability?date=2026-05-12&startTime=10%3A00&endTime=11%3A00',
    })
  })

  it('wraps appointment routes', async () => {
    const { client, calls } = createMockedFetchClient({ appointment: {} })
    const api = createAppointmentsApi(client)

    await api.listRange({ startDate: '2026-05-01', endDate: '2026-05-31' })
    expectLastCall(calls, {
      path: '/api/appointments?startDate=2026-05-01&endDate=2026-05-31',
    })

    await api.create({
      clientId: 'client-1',
      staffId: 'staff-1',
      serviceId: 'service-1',
      date: '2026-05-12',
      startTime: '10:00',
      endTime: '11:00',
    })
    expectLastCall(calls, {
      path: '/api/appointments',
      method: 'POST',
      body: {
        clientId: 'client-1',
        staffId: 'staff-1',
        serviceId: 'service-1',
        date: '2026-05-12',
        startTime: '10:00',
        endTime: '11:00',
      },
    })

    await api.get('appointment-1')
    expectLastCall(calls, { path: '/api/appointments/appointment-1' })

    await api.update('appointment-1', { notes: 'Bring photo' })
    expectLastCall(calls, {
      path: '/api/appointments/appointment-1',
      method: 'PATCH',
      body: { notes: 'Bring photo' },
    })

    await api.updateStatus('appointment-1', 'confirmed')
    expectLastCall(calls, {
      path: '/api/appointments/appointment-1',
      method: 'PATCH',
      body: { status: 'confirmed' },
    })

    await api.delete('appointment-1')
    expectLastCall(calls, {
      path: '/api/appointments/appointment-1',
      method: 'DELETE',
    })

    await api.availability({
      mode: 'nearest',
      serviceId: 'service-1',
      date: '2026-05-12',
      staffId: 'staff-1',
    })
    expectLastCall(calls, {
      path: '/api/appointments/availability?mode=nearest&serviceId=service-1&date=2026-05-12&staffId=staff-1',
    })

    await api.completePlaceholderClient('appointment-1', {
      name: 'Nika',
      phone: '09123456789',
      notes: 'Prefers mornings',
    })
    expectLastCall(calls, {
      path: '/api/appointments/appointment-1/complete-client',
      method: 'POST',
      body: {
        name: 'Nika',
        phone: '09123456789',
        notes: 'Prefers mornings',
      },
    })
  })

  it('wraps notification routes', async () => {
    const { client, calls } = createMockedFetchClient({ notifications: [] })
    const api = createNotificationsApi(client)

    await api.list()
    expectLastCall(calls, { path: '/api/notifications' })

    await api.list({ unreadOnly: true })
    expectLastCall(calls, { path: '/api/notifications?unreadOnly=true' })

    await api.markRead('notification-1')
    expectLastCall(calls, {
      path: '/api/notifications/notification-1/read',
      method: 'POST',
    })

    await api.markAllRead()
    expectLastCall(calls, {
      path: '/api/notifications/read-all',
      method: 'POST',
    })
  })

  it('wraps notification preference routes', async () => {
    const { client, calls } = createMockedFetchClient({ preferences: {} })
    const api = createNotificationPreferencesApi(client)

    await api.get()
    expectLastCall(calls, { path: '/api/notification-preferences' })

    await api.update({
      appointmentAlertsEnabled: false,
      localAlertsEnabled: true,
      smsAlertsEnabled: false,
    })
    expectLastCall(calls, {
      path: '/api/notification-preferences',
      method: 'PATCH',
      body: {
        appointmentAlertsEnabled: false,
        localAlertsEnabled: true,
        smsAlertsEnabled: false,
      },
    })
  })
})
