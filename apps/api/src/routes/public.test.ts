import { addDaysYmd, salonTodayYmd } from '@repo/salon-core/salon-local-time'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@repo/database/public', () => ({
  getPublicSalon: vi.fn(),
  getPublicAvailability: vi.fn(),
  createAppointmentRequest: vi.fn(),
  getAppointmentRequestByToken: vi.fn(),
  cancelAppointmentRequestByToken: vi.fn(),
  getEnabledMessagingProvidersForSalon: vi.fn(async () => []),
}))

vi.mock('@repo/database/rate-limit', () => ({
  checkAndRecordPublicSubmit: vi.fn(),
}))

vi.mock('@repo/notifications', () => ({
  notifyManagersOfNewAppointmentRequest: vi.fn().mockResolvedValue(undefined),
  getMessagingProvider: vi.fn(),
  getBaleConfig: vi.fn(() => null),
  getTelegramConfig: vi.fn(() => null),
  isWebPushConfigured: vi.fn(() => false),
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

import * as publicDb from '@repo/database/public'
import * as rateLimit from '@repo/database/rate-limit'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgres://stub'
process.env.JWT_SECRET = 'test-secret'

const { app } = await import('../app')

const validToken = '11111111-1111-1111-1111-111111111111'
const validRequestDate = salonTodayYmd()
const validAvailabilityDate = addDaysYmd(validRequestDate, 1)

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(rateLimit.checkAndRecordPublicSubmit).mockResolvedValue({
    allowed: true,
  })
})

describe('public routes', () => {
  it('GET /salons/:slug returns the public view', async () => {
    vi.mocked(publicDb.getPublicSalon).mockResolvedValue({
      ok: true,
      view: {
        salon: {
          id: 's1',
          slug: 'foo',
          name: 'Foo',
          phone: null,
          timezone: 'Asia/Tehran',
          locale: 'fa',
        },
        publicSettings: {
          enabled: true,
          bioText: null,
          themeId: 'rose',
          layoutId: 'agenda',
          appointmentRequestsEnabled: true,
        },
        presence: {
          address: 'خیابان ولیعصر',
          mapGoogle: 'https://maps.app.goo.gl/example',
          mapNeshan: null,
          mapBalad: null,
          socialInstagram: '@foo',
          socialTelegram: null,
          socialWhatsapp: '09121234567',
          website: 'https://foo.example',
        },
        services: [],
      },
    } as never)
    const res = await app.request('/api/v1/public/salons/foo')
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      salon: { slug: string }
      presence: { address: string; socialInstagram: string }
    }
    expect(body.salon.slug).toBe('foo')
    expect(body.presence.address).toBe('خیابان ولیعصر')
    expect(body.presence.socialInstagram).toBe('@foo')
  })

  it('GET /salons/:slug 404 when not found', async () => {
    vi.mocked(publicDb.getPublicSalon).mockResolvedValue({
      ok: false,
      status: 404,
      error: 'سالن یافت نشد',
    } as never)
    const res = await app.request('/api/v1/public/salons/missing')
    expect(res.status).toBe(404)
  })

  it('GET /availability rejects bad date format with 400', async () => {
    const res = await app.request(
      '/api/v1/public/salons/foo/availability?serviceId=svc1&date=bogus',
    )
    expect(res.status).toBe(400)
  })

  it('GET /availability returns slots from getPublicAvailability', async () => {
    vi.mocked(publicDb.getPublicAvailability).mockResolvedValue({
      ok: true,
      response: { mode: 'day', slots: [] },
    } as never)
    const res = await app.request(
      `/api/v1/public/salons/foo/availability?serviceId=svc1&date=${validAvailabilityDate}`,
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { mode: string }
    expect(body.mode).toBe('day')
  })

  it('POST /appointment-requests returns 201 with token', async () => {
    vi.mocked(publicDb.createAppointmentRequest).mockResolvedValue({
      ok: true,
      id: 'req1',
      confirmationToken: validToken,
    } as never)
    const res = await app.request(
      '/api/v1/public/salons/foo/appointment-requests',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: 'svc1',
          date: validRequestDate,
          startTime: '10:00',
          endTime: '10:30',
          customerName: 'علی',
          customerPhone: '09121234567',
        }),
      },
    )
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ token: validToken })
  })

  it('POST /appointment-requests returns 429 when rate-limited', async () => {
    vi.mocked(rateLimit.checkAndRecordPublicSubmit).mockResolvedValue({
      allowed: false,
      retryAfterMs: 60_000,
    } as never)
    const res = await app.request(
      '/api/v1/public/salons/foo/appointment-requests',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: 'svc1',
          date: validRequestDate,
          startTime: '10:00',
          endTime: '10:30',
          customerName: 'علی',
          customerPhone: '09121234567',
        }),
      },
    )
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('60')
    expect(publicDb.createAppointmentRequest).not.toHaveBeenCalled()
  })

  it('POST /appointment-requests rejects invalid phone with 400', async () => {
    const res = await app.request(
      '/api/v1/public/salons/foo/appointment-requests',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: 'svc1',
          date: validRequestDate,
          startTime: '10:00',
          endTime: '10:30',
          customerName: 'علی',
          customerPhone: '12345',
        }),
      },
    )
    expect(res.status).toBe(400)
  })

  it('GET status by token hides customer identity', async () => {
    vi.mocked(publicDb.getAppointmentRequestByToken).mockResolvedValue({
      id: 'req1',
      status: 'pending',
      bookedServiceName: 'Cut',
      bookedServiceDuration: 30,
      bookedServicePrice: 100_000,
      requestedDate: validRequestDate,
      requestedStartTime: '10:00',
      requestedEndTime: '10:30',
      salon: { name: 'Foo', phone: '02112345678' },
      createdAt: new Date(),
      reviewedAt: null,
      rejectionReason: null,
    } as never)
    const res = await app.request(
      `/api/v1/public/salons/foo/appointment-requests/${validToken}`,
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body).not.toHaveProperty('customerName')
    expect(body).not.toHaveProperty('customerPhone')
  })

  it('GET status 404 when token unknown', async () => {
    vi.mocked(publicDb.getAppointmentRequestByToken).mockResolvedValue(null)
    const res = await app.request(
      `/api/v1/public/salons/foo/appointment-requests/${validToken}`,
    )
    expect(res.status).toBe(404)
  })

  it('POST cancel flips pending → cancelled', async () => {
    vi.mocked(publicDb.cancelAppointmentRequestByToken).mockResolvedValue({
      ok: true,
    } as never)
    const res = await app.request(
      `/api/v1/public/salons/foo/appointment-requests/${validToken}/cancel`,
      { method: 'POST' },
    )
    expect(res.status).toBe(200)
  })

  it('POST cancel returns 409 when not pending', async () => {
    vi.mocked(publicDb.cancelAppointmentRequestByToken).mockResolvedValue({
      ok: false,
      status: 409,
      error: 'این درخواست قابل لغو نیست',
    } as never)
    const res = await app.request(
      `/api/v1/public/salons/foo/appointment-requests/${validToken}/cancel`,
      { method: 'POST' },
    )
    expect(res.status).toBe(409)
  })
})
