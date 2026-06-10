import { queryOptions, useMutation } from '@tanstack/react-query'
import type {
  StaffCreateFormInput,
  StaffCreateRequestPayload,
  StaffPasswordRequestPayload,
  StaffScheduleFormInput,
  StaffServiceIdsPayload,
  StaffUpdateFormPayload,
} from '@repo/salon-core/forms/staff'
import type { BusinessHours, StaffSchedule, User } from '@repo/salon-core/types'
import {
  getApiV1Staff,
  getApiV1StaffBookingAvailability,
  getApiV1StaffByIdSchedule,
} from '@repo/api-client/sdk'
import {
  deleteApiV1StaffByIdMutation,
  getApiV1StaffBookingAvailabilityQueryKey,
  getApiV1StaffByIdScheduleQueryKey,
  getApiV1StaffQueryKey,
  patchApiV1StaffByIdMutation,
  patchApiV1StaffByIdPasswordMutation,
  patchApiV1StaffByIdServicesMutation,
  postApiV1StaffMutation,
  putApiV1StaffByIdScheduleMutation,
} from '@repo/api-client/query'
import type {
  BusinessHours as GeneratedBusinessHours,
  StaffSchedule as GeneratedStaffSchedule,
  StaffUser as GeneratedStaffUser,
} from '@repo/api-client/types'

import { HEAVY_QUERY_STALE_TIME_MS } from '#/lib/query-client'

export {
  getApiV1StaffQueryKey,
  getApiV1StaffByIdScheduleQueryKey,
  getApiV1StaffBookingAvailabilityQueryKey,
}

/** JSON DTOs are structurally compatible; salon-core uses Date where API returns ISO strings. */
function mapStaffUser(user: GeneratedStaffUser): User {
  return user as unknown as User
}

function mapStaffSchedule(row: GeneratedStaffSchedule): StaffSchedule {
  return row as unknown as StaffSchedule
}

function mapBusinessHours(hours: GeneratedBusinessHours): BusinessHours {
  return hours as unknown as BusinessHours
}

export type StaffScheduleBundle = {
  schedule: StaffSchedule[]
  businessHours: BusinessHours
}

export function staffListQueryOptions() {
  return queryOptions({
    queryKey: getApiV1StaffQueryKey(),
    staleTime: HEAVY_QUERY_STALE_TIME_MS,
    queryFn: async ({ signal }): Promise<User[]> => {
      const { data } = await getApiV1Staff({ signal, throwOnError: true })
      return data.staff.map(mapStaffUser)
    },
  })
}

export function staffScheduleBundleQueryOptions(staffId: string) {
  return queryOptions({
    queryKey: getApiV1StaffByIdScheduleQueryKey({ path: { id: staffId } }),
    queryFn: async ({ signal }): Promise<StaffScheduleBundle> => {
      const { data } = await getApiV1StaffByIdSchedule({
        path: { id: staffId },
        signal,
        throwOnError: true,
      })
      return {
        schedule: data.schedule.map(mapStaffSchedule),
        businessHours: mapBusinessHours(data.businessHours),
      }
    },
  })
}

export function staffBookingAvailabilityQueryOptions(params: {
  date: string
  startTime: string
  endTime: string
}) {
  return queryOptions({
    queryKey: getApiV1StaffBookingAvailabilityQueryKey({
      query: params,
    }),
    queryFn: async ({ signal }) => {
      const { data } = await getApiV1StaffBookingAvailability({
        query: params,
        signal,
        throwOnError: true,
      })
      return data.staff
    },
  })
}

function toCreateBody(values: StaffCreateFormInput): StaffCreateRequestPayload {
  return {
    name: values.name,
    phone: values.phone,
    password: values.password,
    role: values.role ?? 'staff',
  }
}

function toUpdateBody(values: StaffUpdateFormPayload) {
  return {
    name: values.name,
    nickname: values.nickname,
    phone: values.phone,
    role: values.role,
    color: values.color,
  }
}

export function useCreateStaffMutation(options?: { skipToast?: boolean }) {
  const generated = postApiV1StaffMutation()

  return useMutation<User, unknown, StaffCreateFormInput>({
    mutationFn: async (values, mutationContext) => {
      const response = await generated.mutationFn!(
        { body: toCreateBody(values) },
        mutationContext,
      )
      return mapStaffUser(response.user)
    },
    meta: {
      errorMessage: 'افزودن پرسنل انجام نشد',
      invalidatesQuery: getApiV1StaffQueryKey(),
      ...(options?.skipToast ? { skipToast: true } : {}),
    },
  })
}

export function useUpdateStaffMutation(staffId: string) {
  const generated = patchApiV1StaffByIdMutation()

  return useMutation<User, unknown, StaffUpdateFormPayload>({
    mutationFn: async (values, mutationContext) => {
      const response = await generated.mutationFn!(
        {
          path: { id: staffId },
          body: toUpdateBody(values),
        },
        mutationContext,
      )
      return mapStaffUser(response.staff)
    },
    meta: {
      errorMessage: 'ذخیره اطلاعات انجام نشد',
      invalidatesQuery: getApiV1StaffQueryKey(),
    },
  })
}

export function useUpdateStaffPasswordMutation(staffId: string) {
  const generated = patchApiV1StaffByIdPasswordMutation()

  return useMutation<void, unknown, StaffPasswordRequestPayload>({
    mutationFn: async (values, mutationContext) => {
      await generated.mutationFn!(
        {
          path: { id: staffId },
          body: values,
        },
        mutationContext,
      )
    },
    meta: {
      errorMessage: 'تغییر رمز عبور انجام نشد',
    },
  })
}

export function useDeleteStaffMutation() {
  const generated = deleteApiV1StaffByIdMutation()

  return useMutation<void, unknown, string>({
    mutationFn: async (staffId, mutationContext) => {
      await generated.mutationFn!({ path: { id: staffId } }, mutationContext)
    },
    meta: {
      errorMessage: 'حذف پرسنل انجام نشد',
      invalidatesQuery: getApiV1StaffQueryKey(),
    },
  })
}

export function useUpdateStaffServicesMutation() {
  const generated = patchApiV1StaffByIdServicesMutation()

  return useMutation<
    User,
    unknown,
    { staffId: string; serviceIds: StaffServiceIdsPayload['serviceIds'] }
  >({
    mutationFn: async ({ staffId, serviceIds }, mutationContext) => {
      const response = await generated.mutationFn!(
        {
          path: { id: staffId },
          body: { serviceIds },
        },
        mutationContext,
      )
      return mapStaffUser(response.staff)
    },
    meta: {
      errorMessage: 'ذخیره خدمات پرسنل انجام نشد',
      invalidatesQuery: getApiV1StaffQueryKey(),
    },
  })
}

export function useUpdateStaffScheduleMutation(staffId: string) {
  const generated = putApiV1StaffByIdScheduleMutation()

  return useMutation<StaffSchedule[], unknown, StaffScheduleFormInput>({
    mutationFn: async (schedule, mutationContext) => {
      const response = await generated.mutationFn!(
        {
          path: { id: staffId },
          body: { schedule },
        },
        mutationContext,
      )
      return response.schedule.map(mapStaffSchedule)
    },
    meta: {
      errorMessage: 'ذخیره برنامه کاری انجام نشد',
      invalidatesQuery: getApiV1StaffByIdScheduleQueryKey({
        path: { id: staffId },
      }),
    },
  })
}
