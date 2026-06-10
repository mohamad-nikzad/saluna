import { queryOptions, useMutation } from '@tanstack/react-query'
import { ApiError } from '@repo/api-client/errors'
import type {
  AppointmentFormInput,
  CompletePlaceholderClientInput,
} from '@repo/salon-core/forms/appointment'
import { appointmentFormSchema } from '@repo/salon-core/forms/appointment'
import type {
  AvailabilityMode,
  AvailabilityResponse,
} from '@repo/salon-core/availability'
import type { AppointmentWithDetails, Client } from '@repo/salon-core/types'
import {
  getApiV1Appointments,
  getApiV1AppointmentsAvailability,
} from '@repo/api-client/sdk'
import {
  deleteApiV1AppointmentsByIdMutation,
  getApiV1AppointmentsAvailabilityQueryKey,
  getApiV1AppointmentsQueryKey,
  patchApiV1AppointmentsByIdMutation,
  postApiV1AppointmentsByIdCompleteClientMutation,
  postApiV1AppointmentsMutation,
} from '@repo/api-client/query'
import type {
  AppointmentWithDetails as GeneratedAppointmentWithDetails,
  PatchApiV1AppointmentsByIdResponse,
} from '@repo/api-client/types'

import { HEAVY_QUERY_STALE_TIME_MS } from '#/lib/query-client'

export {
  getApiV1AppointmentsQueryKey,
  getApiV1AppointmentsAvailabilityQueryKey,
}

function mapAppointment(
  appointment: GeneratedAppointmentWithDetails,
): AppointmentWithDetails {
  return appointment as unknown as AppointmentWithDetails
}

export type AppointmentMutationResult =
  | { type: 'deleted'; id: string }
  | { type: 'updated'; appointment: AppointmentWithDetails }

function parseUpdateResponse(
  response: PatchApiV1AppointmentsByIdResponse,
): AppointmentMutationResult {
  if (
    'removedAppointmentId' in response &&
    typeof response.removedAppointmentId === 'string'
  ) {
    return { type: 'deleted', id: response.removedAppointmentId }
  }
  if ('appointment' in response && response.appointment) {
    return {
      type: 'updated',
      appointment: mapAppointment(response.appointment),
    }
  }
  throw new Error('پاسخ به‌روزرسانی نوبت کامل نبود.')
}

export function appointmentsRangeQueryOptions(
  startDate: string,
  endDate: string,
) {
  return queryOptions({
    queryKey: getApiV1AppointmentsQueryKey({
      query: { startDate, endDate },
    }),
    staleTime: HEAVY_QUERY_STALE_TIME_MS,
    queryFn: async ({ signal }): Promise<AppointmentWithDetails[]> => {
      const { data } = await getApiV1Appointments({
        query: { startDate, endDate },
        signal,
        throwOnError: true,
      })
      return data.appointments.map(mapAppointment)
    },
  })
}

export function appointmentsRangeInvalidationKeys() {
  return [[{ _id: 'getApiV1Appointments' }]] as const
}

export async function fetchAppointmentAvailability(
  input: {
    mode: AvailabilityMode
    serviceId: string
    date: string
    staffId?: string
  },
  signal?: AbortSignal,
): Promise<AvailabilityResponse> {
  const { data } = await getApiV1AppointmentsAvailability({
    query: input,
    signal,
    throwOnError: true,
  })
  return data as AvailabilityResponse
}

export function useCreateAppointmentMutation() {
  const generated = postApiV1AppointmentsMutation()

  return useMutation<AppointmentWithDetails, unknown, AppointmentFormInput>({
    mutationFn: async (values, mutationContext) => {
      const body = appointmentFormSchema.parse(values)
      const response = await generated.mutationFn!({ body }, mutationContext)
      return mapAppointment(response.appointment)
    },
    meta: {
      errorMessage: 'ثبت نوبت انجام نشد',
      invalidatesQuery: appointmentsRangeInvalidationKeys(),
    },
  })
}

export function useUpdateAppointmentMutation() {
  const generated = patchApiV1AppointmentsByIdMutation()

  return useMutation<
    AppointmentMutationResult,
    unknown,
    {
      appointmentId: string
      values: AppointmentFormInput
      nextStatus: AppointmentWithDetails['status']
    }
  >({
    mutationFn: async (
      { appointmentId, values, nextStatus },
      mutationContext,
    ) => {
      const body = {
        ...appointmentFormSchema.parse(values),
        status: nextStatus,
      }
      const response = await generated.mutationFn!(
        {
          path: { id: appointmentId },
          body,
        },
        mutationContext,
      )
      return parseUpdateResponse(response)
    },
    meta: {
      errorMessage: 'ذخیره نوبت انجام نشد',
      invalidatesQuery: appointmentsRangeInvalidationKeys(),
    },
  })
}

export function useDeleteAppointmentMutation() {
  const generated = deleteApiV1AppointmentsByIdMutation()

  return useMutation<void, unknown, string>({
    mutationFn: async (appointmentId, mutationContext) => {
      await generated.mutationFn!(
        { path: { id: appointmentId } },
        mutationContext,
      )
    },
    meta: {
      errorMessage: 'حذف نوبت انجام نشد',
      invalidatesQuery: appointmentsRangeInvalidationKeys(),
    },
  })
}

export function useUpdateAppointmentStatusMutation(options?: {
  skipSuccessToast?: boolean
  skipErrorToast?: boolean
}) {
  const generated = patchApiV1AppointmentsByIdMutation()

  return useMutation<
    AppointmentMutationResult,
    unknown,
    {
      appointmentId: string
      nextStatus: AppointmentWithDetails['status']
    }
  >({
    mutationFn: async ({ appointmentId, nextStatus }, mutationContext) => {
      const response = await generated.mutationFn!(
        {
          path: { id: appointmentId },
          body: { status: nextStatus },
        },
        mutationContext,
      )
      return parseUpdateResponse(response)
    },
    meta: {
      skipSuccessToast: options?.skipSuccessToast,
      skipErrorToast: options?.skipErrorToast,
      invalidatesQuery: appointmentsRangeInvalidationKeys(),
    },
  })
}

export function useCompletePlaceholderClientMutation() {
  const generated = postApiV1AppointmentsByIdCompleteClientMutation()

  return useMutation<
    AppointmentWithDetails,
    unknown,
    {
      appointmentId: string
      values: CompletePlaceholderClientInput
    }
  >({
    mutationFn: async ({ appointmentId, values }, mutationContext) => {
      const response = await generated.mutationFn!(
        {
          path: { id: appointmentId },
          body: {
            ...values,
            notes: values.notes ?? undefined,
          },
        },
        mutationContext,
      )
      return mapAppointment(response.appointment)
    },
    meta: {
      skipErrorToast: true,
      errorMessage: 'ثبت اطلاعات مشتری انجام نشد',
      invalidatesQuery: appointmentsRangeInvalidationKeys(),
    },
  })
}

export function isDuplicateClientError(err: unknown): err is ApiError {
  if (!(err instanceof ApiError) || err.status !== 409) {
    return false
  }
  return (
    typeof err.payload === 'object' &&
    err.payload != null &&
    'code' in err.payload &&
    (err.payload as { code?: string }).code === 'duplicate-phone'
  )
}

export function duplicateClientFromError(err: ApiError): Client | null {
  if (
    typeof err.payload === 'object' &&
    err.payload != null &&
    'existingClient' in err.payload
  ) {
    const existingClient = (err.payload as { existingClient?: Client })
      .existingClient
    return existingClient ?? null
  }
  return null
}
