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
  PublicSalonView as GeneratedPublicSalonView,
} from '@repo/api-client/types'

configureGeneratedApiClient({ baseUrl: PUBLIC_API_URL })

export type PublicSalonView = Omit<GeneratedPublicSalonView, 'services'> & {
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

const LEGACY_SERVICE_CATEGORIES = ['hair', 'nails', 'skincare', 'spa'] as const

function isLegacyServiceCategory(
  value: unknown,
): value is Service['category'] {
  return (
    typeof value === 'string' &&
    LEGACY_SERVICE_CATEGORIES.includes(value as Service['category'])
  )
}

function toPublicService(service: GeneratedPublicSalonView['services'][number]) {
  if (
    !isLegacyServiceCategory(service.category) ||
    typeof service.categoryId !== 'string' ||
    typeof service.duration !== 'number' ||
    typeof service.price !== 'number' ||
    typeof service.color !== 'string' ||
    typeof service.active !== 'boolean'
  ) {
    throw new PublicApiError('پاسخی از سرور دریافت نشد.', 500)
  }

  return {
    id: service.id,
    name: service.name,
    category: service.category,
    categoryId: service.categoryId,
    categoryName:
      typeof service.categoryName === 'string' ? service.categoryName : null,
    familyId: typeof service.familyId === 'string' ? service.familyId : null,
    familyName:
      typeof service.familyName === 'string' ? service.familyName : null,
    duration: service.duration,
    price: service.price,
    color: service.color,
    active: service.active,
    description:
      typeof service.description === 'string' ? service.description : null,
    kind:
      service.kind === 'standard' || service.kind === 'combo'
        ? service.kind
        : undefined,
  } satisfies Service
}

function toPublicSalonView(view: GeneratedPublicSalonView): PublicSalonView {
  return {
    ...view,
    services: view.services.map(toPublicService),
  }
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
    return toPublicSalonView(data)
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
    const { data } = await getApiV1PublicSalonsBySlugAppointmentRequestsByToken(
      {
        path: { slug, token },
        signal: init?.signal ?? undefined,
        throwOnError: true,
      },
    )
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
