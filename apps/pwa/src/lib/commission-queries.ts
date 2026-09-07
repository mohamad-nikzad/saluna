import { useMutation } from '@tanstack/react-query'
import type {
  CommissionAgreement,
  GetApiV1CommissionsMeData,
  GetApiV1ReportsSalonMoneyData,
  SalonMoneyReport,
  StaffCommissionReport,
} from '@repo/api-client/types'
import {
  deleteApiV1CommissionsStaffByIdAgreementMutation,
  deleteApiV1CommissionsStaffByIdAgreementOverridesByServiceIdMutation,
  getApiV1CommissionsMeOptions,
  getApiV1CommissionsStaffByIdReportOptions,
  getApiV1ReportsSalonMoneyOptions,
  putApiV1CommissionsStaffByIdAgreementMutation,
  putApiV1CommissionsStaffByIdAgreementOverridesByServiceIdMutation,
} from '@repo/api-client/query'

export type CommissionPeriodQuery = NonNullable<
  GetApiV1CommissionsMeData['query']
>

export type SalonMoneyReportQuery = NonNullable<
  GetApiV1ReportsSalonMoneyData['query']
>

const staffReportRoot = [{ _id: 'getApiV1CommissionsStaffByIdReport' }] as const
const selfReportRoot = [{ _id: 'getApiV1CommissionsMe' }] as const
const salonMoneyReportRoot = [{ _id: 'getApiV1ReportsSalonMoney' }] as const
const reportRoots = [
  staffReportRoot,
  selfReportRoot,
  salonMoneyReportRoot,
] as const

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

export function salonMoneyReportQueryOptions(query: SalonMoneyReportQuery) {
  return {
    ...getApiV1ReportsSalonMoneyOptions({ query }),
    select: (data: { report: SalonMoneyReport }) => data.report,
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
      successMessage: 'کمیسیون ذخیره شد',
      errorMessage: 'ذخیره کمیسیون انجام نشد',
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
      successMessage: 'کمیسیون غیرفعال شد',
      errorMessage: 'غیرفعال‌کردن کمیسیون انجام نشد',
      invalidatesQuery: reportRoots,
    },
  })
}

export function useSaveServiceCommissionOverrideMutation() {
  const generated =
    putApiV1CommissionsStaffByIdAgreementOverridesByServiceIdMutation()
  return useMutation<
    CommissionAgreement,
    unknown,
    { staffId: string; serviceId: string; percentage: number }
  >({
    mutationFn: async ({ staffId, serviceId, percentage }, context) => {
      const response = await generated.mutationFn!(
        {
          path: { id: staffId, serviceId },
          body: { percentage },
        },
        context,
      )
      return response.agreement
    },
    meta: {
      successMessage: 'درصد این خدمت ذخیره شد',
      errorMessage: 'ذخیره درصد این خدمت انجام نشد',
      invalidatesQuery: reportRoots,
    },
  })
}

export function useDeleteServiceCommissionOverrideMutation() {
  const generated =
    deleteApiV1CommissionsStaffByIdAgreementOverridesByServiceIdMutation()
  return useMutation<
    CommissionAgreement,
    unknown,
    { staffId: string; serviceId: string }
  >({
    mutationFn: async ({ staffId, serviceId }, context) => {
      const response = await generated.mutationFn!(
        { path: { id: staffId, serviceId } },
        context,
      )
      return response.agreement
    },
    meta: {
      successMessage: 'درصد این خدمت حذف شد',
      errorMessage: 'حذف درصد این خدمت انجام نشد',
      invalidatesQuery: reportRoots,
    },
  })
}
