import { PUBLIC_API_URL } from 'astro:env/client'
import { configureGeneratedApiClient } from '@repo/api-client/generated-client'
import { ApiError } from '@repo/api-client/errors'
import {
  getApiV1PublicSalonsBySlug,
  getApiV1PublicSalonsBySlugAvailability,
  getApiV1PublicSalonsBySlugAppointmentRequestsByToken,
  postApiV1PublicSalonsBySlugAppointmentRequests,
  postApiV1PublicSalonsBySlugAppointmentRequestsByTokenCancel,
} from '@repo/api-client/sdk'
import type { Service } from '@repo/salon-core/types'
import type {
  AppointmentRequestStatus,
  AvailabilitySlot,
  DayAvailabilityResponse,
  PublicAppointmentRequestBody,
  PublicAppointmentRequestStatusView,
} from '@repo/api-client/types'

configureGeneratedApiClient({ baseUrl: PUBLIC_API_URL })

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
export type PublicAvailabilitySlot = AvailabilitySlot
export type PublicAvailabilityDayResponse = DayAvailabilityResponse
export type { AppointmentRequestStatus }
export type AppointmentRequestStatusView = PublicAppointmentRequestStatusView

export class PublicApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function rethrowPublicApiError(error: unknown): never {
  if (error instanceof ApiError) {
    throw new PublicApiError(error.message, error.status)
  }
  throw error
}

export async function fetchPublicSalon(
  slug: string,
  init?: RequestInit,
): Promise<PublicSalonView> {
  try {
    const { data } = await getApiV1PublicSalonsBySlug({
      path: { slug },
      signal: init?.signal ?? undefined,
      throwOnError: true,
    })
    return data as unknown as PublicSalonView
  } catch (error) {
    rethrowPublicApiError(error)
  }
}

export async function fetchPublicAvailability(
  slug: string,
  params: { serviceId: string; date: string },
  init?: RequestInit,
): Promise<PublicAvailabilityDayResponse> {
  try {
    const { data } = await getApiV1PublicSalonsBySlugAvailability({
      path: { slug },
      query: {
        serviceId: params.serviceId,
        date: params.date,
        mode: 'day',
      },
      signal: init?.signal ?? undefined,
      throwOnError: true,
    })
    if (data.mode !== 'day') {
      throw new PublicApiError('پاسخی از سرور دریافت نشد.', 500)
    }
    return data
  } catch (error) {
    rethrowPublicApiError(error)
  }
}

export async function submitAppointmentRequest(
  slug: string,
  body: PublicAppointmentRequestBody,
): Promise<{ token: string }> {
  try {
    const { data } = await postApiV1PublicSalonsBySlugAppointmentRequests({
      path: { slug },
      body,
      throwOnError: true,
    })
    return data
  } catch (error) {
    rethrowPublicApiError(error)
  }
}

export async function fetchAppointmentRequest(
  slug: string,
  token: string,
  init?: RequestInit,
): Promise<AppointmentRequestStatusView> {
  try {
    const { data } = await getApiV1PublicSalonsBySlugAppointmentRequestsByToken({
      path: { slug, token },
      signal: init?.signal ?? undefined,
      throwOnError: true,
    })
    return data
  } catch (error) {
    rethrowPublicApiError(error)
  }
}

export async function cancelAppointmentRequest(
  slug: string,
  token: string,
): Promise<void> {
  try {
    await postApiV1PublicSalonsBySlugAppointmentRequestsByTokenCancel({
      path: { slug, token },
      throwOnError: true,
    })
  } catch (error) {
    rethrowPublicApiError(error)
  }
}
