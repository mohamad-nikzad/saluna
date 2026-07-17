import { useMutation } from '@tanstack/react-query'
import type {
  CommissionAgreement,
  GetApiV1CommissionsMeData,
  SalonCommissionReport,
  StaffCommissionReport,
} from '@repo/api-client/types'
import {
  deleteApiV1CommissionsStaffByIdAgreementMutation,
  getApiV1CommissionsMeOptions,
  getApiV1CommissionsSalonOptions,
  getApiV1CommissionsStaffByIdReportOptions,
  putApiV1CommissionsStaffByIdAgreementMutation,
} from '@repo/api-client/query'

export type CommissionPeriodQuery = NonNullable<
  GetApiV1CommissionsMeData['query']
>

const staffReportRoot = [{ _id: 'getApiV1CommissionsStaffByIdReport' }] as const
const selfReportRoot = [{ _id: 'getApiV1CommissionsMe' }] as const
const salonReportRoot = [{ _id: 'getApiV1CommissionsSalon' }] as const
const reportRoots = [staffReportRoot, selfReportRoot, salonReportRoot] as const

export function commissionReportInvalidationKeys() {
  return reportRoots
}

export function staffCommissionReportQueryOptions(
  staffId: string,
  query: CommissionPeriodQuery,
) {
  return {
    ...getApiV1CommissionsStaffByIdReportOptions({
      path: { id: staffId },
      query,
    }),
    select: (data: { report: StaffCommissionReport }) => data.report,
  }
}

export function myCommissionReportQueryOptions(query: CommissionPeriodQuery) {
  return {
    ...getApiV1CommissionsMeOptions({ query }),
    select: (data: { report: StaffCommissionReport }) => data.report,
  }
}

export function salonCommissionReportQueryOptions(
  query: CommissionPeriodQuery,
) {
  return {
    ...getApiV1CommissionsSalonOptions({ query }),
    select: (data: { report: SalonCommissionReport }) => data.report,
  }
}

export function useSaveCommissionAgreementMutation() {
  const generated = putApiV1CommissionsStaffByIdAgreementMutation()
  return useMutation<
    CommissionAgreement,
    unknown,
    { staffId: string; percentage: number }
  >({
    mutationFn: async ({ staffId, percentage }, context) => {
      const response = await generated.mutationFn!(
        { path: { id: staffId }, body: { percentage } },
        context,
      )
      return response.agreement
    },
    meta: {
      successMessage: 'توافق کمیسیون ذخیره شد',
      errorMessage: 'ذخیره توافق کمیسیون انجام نشد',
      invalidatesQuery: reportRoots,
    },
  })
}

export function useDisableCommissionAgreementMutation() {
  const generated = deleteApiV1CommissionsStaffByIdAgreementMutation()
  return useMutation<CommissionAgreement, unknown, string>({
    mutationFn: async (staffId, context) => {
      const response = await generated.mutationFn!(
        { path: { id: staffId } },
        context,
      )
      return response.agreement
    },
    meta: {
      successMessage: 'توافق کمیسیون غیرفعال شد',
      errorMessage: 'غیرفعال‌کردن توافق کمیسیون انجام نشد',
      invalidatesQuery: reportRoots,
    },
  })
}
