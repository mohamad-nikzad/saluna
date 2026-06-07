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
    expect(call?.init.headers).toMatchObject({
      'Content-Type': 'application/json',
    })
    expect(call?.init.body).toBe(JSON.stringify(expected.body))
  } else {
    expect(call?.init.body).toBeUndefined()
  }
}

describe('api modules', () => {
  it('wraps dashboard routes', async () => {
    const { client, calls } = createMockedFetchClient({})
    await createDashboardApi(client).get()
    expectLastCall(calls, { path: '/api/v1/dashboard' })
  })

  it('wraps onboarding routes', async () => {
    const { client, calls } = createMockedFetchClient({ onboarding: {} })
    const api = createOnboardingApi(client)

    await api.get()
    expectLastCall(calls, { path: '/api/v1/onboarding' })

    await api.update('complete')
    expectLastCall(calls, {
      path: '/api/v1/onboarding',
      method: 'PATCH',
      body: { action: 'complete' },
    })
  })

  it('wraps retention routes', async () => {
    const { client, calls } = createMockedFetchClient({ items: [] })
    const api = createRetentionApi(client)

    await api.list()
    expectLastCall(calls, { path: '/api/v1/retention' })

    await api.updateStatus('follow-1', 'reviewed')
    expectLastCall(calls, {
      path: '/api/v1/retention/follow-1',
      method: 'PATCH',
      body: { status: 'reviewed' },
    })

    await api.sendBaleMessage('follow-1')
    expectLastCall(calls, {
      path: '/api/v1/retention/follow-1/bale-message',
      method: 'POST',
      body: {},
    })

    await api.sendBaleMessage('follow-1', { retry: true })
    expectLastCall(calls, {
      path: '/api/v1/retention/follow-1/bale-message',
      method: 'POST',
      body: { retry: true },
    })
  })

  it('wraps business settings routes', async () => {
    const { client, calls } = createMockedFetchClient({ settings: {} })
    const api = createBusinessSettingsApi(client)

    await api.get()
    expectLastCall(calls, { path: '/api/v1/settings/business' })

    await api.update({ workingStart: '09:00', workingEnd: '18:00' })
    expectLastCall(calls, {
      path: '/api/v1/settings/business',
      method: 'PATCH',
      body: { workingStart: '09:00', workingEnd: '18:00' },
    })
  })

  it('wraps client routes', async () => {
    const { client, calls } = createMockedFetchClient({ client: {} })
    const api = createClientsApi(client)

    await api.list()
    expectLastCall(calls, { path: '/api/v1/clients' })

    await api.get('client-1')
    expectLastCall(calls, { path: '/api/v1/clients/client-1' })

    await api.create({
      name: 'Nika',
      phone: '09123456789',
      notes: undefined,
      tags: [],
    })
    expectLastCall(calls, {
      path: '/api/v1/clients',
      method: 'POST',
      body: {
        name: 'Nika',
        phone: '09123456789',
        notes: undefined,
        tags: [],
      },
    })

    await api.update('client-1', { notes: 'VIP', tags: undefined })
    expectLastCall(calls, {
      path: '/api/v1/clients/client-1',
      method: 'PATCH',
      body: { notes: 'VIP', tags: undefined },
    })

    await api.summary('client-1')
    expectLastCall(calls, { path: '/api/v1/clients/client-1/summary' })

    await api.createFollowUp('client-1', {
      reason: 'manual',
      dueDate: '2026-05-12',
    })
    expectLastCall(calls, {
      path: '/api/v1/clients/client-1/follow-ups',
      method: 'POST',
      body: { reason: 'manual', dueDate: '2026-05-12' },
    })
  })

  it('wraps service routes', async () => {
    const { client, calls } = createMockedFetchClient({ service: {} })
    const api = createServicesApi(client)

    await api.list({ includeInactive: true })
    expectLastCall(calls, { path: '/api/v1/services?all=1' })

    await api.get('service-1')
    expectLastCall(calls, { path: '/api/v1/services/service-1' })

    await api.create({
      name: 'Cut',
      categoryId: 'cat-1',
      familyId: 'family-1',
      duration: 45,
      price: 100,
      color: 'rose',
      active: true,
    })
    expectLastCall(calls, {
      path: '/api/v1/services',
      method: 'POST',
      body: {
        name: 'Cut',
        categoryId: 'cat-1',
        familyId: 'family-1',
        duration: 45,
        price: 100,
        color: 'rose',
        active: true,
      },
    })

    await api.update('service-1', { active: false })
    expectLastCall(calls, {
      path: '/api/v1/services/service-1',
      method: 'PATCH',
      body: { active: false },
    })

    await api.comboComponents.get('combo-1')
    expectLastCall(calls, { path: '/api/v1/services/combo-1/combo-components' })

    await api.comboComponents.update('combo-1', {
      componentServiceIds: ['service-1', 'service-2'],
    })
    expectLastCall(calls, {
      path: '/api/v1/services/combo-1/combo-components',
      method: 'PUT',
      body: { componentServiceIds: ['service-1', 'service-2'] },
    })

    await api.addons.list({ includeInactive: true })
    expectLastCall(calls, { path: '/api/v1/service-addons?all=1' })

    await api.addons.create({
      name: 'دیزاین',
      priceDelta: 100000,
      durationDelta: 15,
      active: true,
      scopes: [{ type: 'category', categoryId: 'category-1' }],
    })
    expectLastCall(calls, {
      path: '/api/v1/service-addons',
      method: 'POST',
      body: {
        name: 'دیزاین',
        priceDelta: 100000,
        durationDelta: 15,
        active: true,
        scopes: [{ type: 'category', categoryId: 'category-1' }],
      },
    })

    await api.addons.update('addon-1', { active: false })
    expectLastCall(calls, {
      path: '/api/v1/service-addons/addon-1',
      method: 'PATCH',
      body: { active: false },
    })

    await api.addons.forService('service-1')
    expectLastCall(calls, { path: '/api/v1/services/service-1/addons' })

    await api.categories.list({ includeInactive: true })
    expectLastCall(calls, { path: '/api/v1/service-categories?all=1' })

    await api.categories.create({ name: 'ناخن', active: true })
    expectLastCall(calls, {
      path: '/api/v1/service-categories',
      method: 'POST',
      body: { name: 'ناخن', active: true },
    })

    await api.families.create({
      categoryId: 'category-1',
      name: 'کاشت ناخن',
      active: true,
    })
    expectLastCall(calls, {
      path: '/api/v1/service-families',
      method: 'POST',
      body: { categoryId: 'category-1', name: 'کاشت ناخن', active: true },
    })

    await api.importStarterTemplates()
    expectLastCall(calls, {
      path: '/api/v1/services/import-starter-templates',
      method: 'POST',
    })
  })

  it('wraps staff routes', async () => {
    const { client, calls } = createMockedFetchClient({ staff: [] })
    const api = createStaffApi(client)

    await api.list()
    expectLastCall(calls, { path: '/api/v1/staff' })

    await api.create({
      name: 'Sara',
      phone: '09123456789',
      password: 'secret12',
      role: 'staff',
    })
    expectLastCall(calls, {
      path: '/api/v1/staff',
      method: 'POST',
      body: {
        name: 'Sara',
        phone: '09123456789',
        password: 'secret12',
        role: 'staff',
      },
    })

    await api.updatePassword('staff-1', { password: 'newsecret12' })
    expectLastCall(calls, {
      path: '/api/v1/staff/staff-1/password',
      method: 'PATCH',
      body: { password: 'newsecret12' },
    })

    await api.delete('staff-1')
    expectLastCall(calls, {
      path: '/api/v1/staff/staff-1',
      method: 'DELETE',
    })

    await api.updateServices('staff-1', { serviceIds: ['service-1'] })
    expectLastCall(calls, {
      path: '/api/v1/staff/staff-1/services',
      method: 'PATCH',
      body: { serviceIds: ['service-1'] },
    })

    await api.getSchedule('staff-1')
    expectLastCall(calls, { path: '/api/v1/staff/staff-1/schedule' })

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
      path: '/api/v1/staff/staff-1/schedule',
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
      path: '/api/v1/staff/booking-availability?date=2026-05-12&startTime=10%3A00&endTime=11%3A00',
    })
  })

  it('wraps appointment routes', async () => {
    const { client, calls } = createMockedFetchClient({ appointment: {} })
    const api = createAppointmentsApi(client)

    await api.listRange({ startDate: '2026-05-01', endDate: '2026-05-31' })
    expectLastCall(calls, {
      path: '/api/v1/appointments?startDate=2026-05-01&endDate=2026-05-31',
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
      path: '/api/v1/appointments',
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
    expectLastCall(calls, { path: '/api/v1/appointments/appointment-1' })

    await api.update('appointment-1', { notes: 'Bring photo' })
    expectLastCall(calls, {
      path: '/api/v1/appointments/appointment-1',
      method: 'PATCH',
      body: { notes: 'Bring photo' },
    })

    await api.updateStatus('appointment-1', 'confirmed')
    expectLastCall(calls, {
      path: '/api/v1/appointments/appointment-1',
      method: 'PATCH',
      body: { status: 'confirmed' },
    })

    await api.delete('appointment-1')
    expectLastCall(calls, {
      path: '/api/v1/appointments/appointment-1',
      method: 'DELETE',
    })

    await api.availability({
      mode: 'nearest',
      serviceId: 'service-1',
      date: '2026-05-12',
      staffId: 'staff-1',
    })
    expectLastCall(calls, {
      path: '/api/v1/appointments/availability?mode=nearest&serviceId=service-1&date=2026-05-12&staffId=staff-1',
    })

    await api.completePlaceholderClient('appointment-1', {
      name: 'Nika',
      phone: '09123456789',
      notes: 'Prefers mornings',
    })
    expectLastCall(calls, {
      path: '/api/v1/appointments/appointment-1/complete-client',
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
    expectLastCall(calls, { path: '/api/v1/notifications' })

    await api.list({ unreadOnly: true })
    expectLastCall(calls, { path: '/api/v1/notifications?unreadOnly=true' })

    await api.markRead('notification-1')
    expectLastCall(calls, {
      path: '/api/v1/notifications/notification-1/read',
      method: 'POST',
    })

    await api.markAllRead()
    expectLastCall(calls, {
      path: '/api/v1/notifications/read-all',
      method: 'POST',
    })

    await api.createTest()
    expectLastCall(calls, {
      path: '/api/v1/notifications/test',
      method: 'POST',
    })
  })

  it('wraps notification preference routes', async () => {
    const { client, calls } = createMockedFetchClient({ preferences: {} })
    const api = createNotificationPreferencesApi(client)

    await api.get()
    expectLastCall(calls, { path: '/api/v1/notification-preferences' })

    await api.update({
      appointmentAlertsEnabled: false,
      localAlertsEnabled: true,
      smsAlertsEnabled: false,
    })
    expectLastCall(calls, {
      path: '/api/v1/notification-preferences',
      method: 'PATCH',
      body: {
        appointmentAlertsEnabled: false,
        localAlertsEnabled: true,
        smsAlertsEnabled: false,
      },
    })
  })
})
