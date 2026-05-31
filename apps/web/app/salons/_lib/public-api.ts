import { webEnv } from '@/env'
import type { Service } from '@repo/salon-core/types'

export type PublicSalonView = {
  salon: {
    id: string
    slug: string
    name: string
    phone: string | null
    timezone: string
    locale: string
  }
  publicSettings: {
    enabled: boolean
    bioText: string | null
    themeId: string
    layoutId: string
    appointmentRequestsEnabled: boolean
  }
  services: Service[]
}

export type PublicAvailabilitySlot = {
  date: string
  startTime: string
  endTime: string
  staffId: string
  staffName: string
}

export type PublicAvailabilityDayResponse = {
  mode: 'day'
  slots: PublicAvailabilitySlot[]
  emptyReason?: string
}

export type AppointmentRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'expired'

export type AppointmentRequestStatusView = {
  id: string
  status: AppointmentRequestStatus
  bookedServiceName: string
  bookedServiceDuration: number
  bookedServicePrice: number
  requestedDate: string
  requestedStartTime: string
  requestedEndTime: string
  salon: { name: string; phone: string | null }
  createdAt: string
  reviewedAt: string | null
  rejectionReason: string | null
}

type ApiError = { error: string }

export class PublicApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function apiUrl(path: string): string {
  return new URL(path, webEnv.NEXT_PUBLIC_API_URL).toString()
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  const body = text ? (JSON.parse(text) as T | ApiError) : ({} as T)
  if (!res.ok) {
    const message =
      (body as ApiError)?.error ?? 'خطایی رخ داد. لطفاً دوباره تلاش کنید.'
    throw new PublicApiError(message, res.status)
  }
  return body as T
}

export async function fetchPublicSalon(
  slug: string,
  init?: RequestInit,
): Promise<PublicSalonView> {
  const res = await fetch(apiUrl(`/api/v1/public/salons/${slug}`), {
    cache: 'no-store',
    ...init,
  })
  return parseJson<PublicSalonView>(res)
}

export async function fetchPublicAvailability(
  slug: string,
  params: { serviceId: string; date: string },
  init?: RequestInit,
): Promise<PublicAvailabilityDayResponse> {
  const url = new URL(apiUrl(`/api/v1/public/salons/${slug}/availability`))
  url.searchParams.set('serviceId', params.serviceId)
  url.searchParams.set('date', params.date)
  url.searchParams.set('mode', 'day')
  const res = await fetch(url.toString(), { cache: 'no-store', ...init })
  return parseJson<PublicAvailabilityDayResponse>(res)
}

export async function submitAppointmentRequest(
  slug: string,
  body: {
    serviceId: string
    date: string
    startTime: string
    endTime: string
    customerName: string
    customerPhone: string
    notes?: string
  },
): Promise<{ token: string }> {
  const res = await fetch(apiUrl(`/api/v1/public/salons/${slug}/appointment-requests`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return parseJson<{ token: string }>(res)
}

export async function fetchAppointmentRequest(
  slug: string,
  token: string,
  init?: RequestInit,
): Promise<AppointmentRequestStatusView> {
  const res = await fetch(
    apiUrl(`/api/v1/public/salons/${slug}/appointment-requests/${token}`),
    { cache: 'no-store', ...init },
  )
  return parseJson<AppointmentRequestStatusView>(res)
}

export async function cancelAppointmentRequest(
  slug: string,
  token: string,
): Promise<void> {
  const res = await fetch(
    apiUrl(`/api/v1/public/salons/${slug}/appointment-requests/${token}/cancel`),
    { method: 'POST' },
  )
  await parseJson<{ ok: true }>(res)
}
