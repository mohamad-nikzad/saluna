import { useState } from 'react'
import type { AppointmentWithDetails } from '@repo/salon-core/types'

import { useUpdateAppointmentStatusMutation } from '#/lib/appointments-queries'

export type StatusActionFeedback = {
  appointmentId: string
  status: AppointmentWithDetails['status']
  mode: 'saving' | 'saved' | 'error'
  message: string
} | null

export function useStaffTodayStatusMutation(onAfterSuccess: () => void) {
  const [statusFeedback, setStatusFeedback] =
    useState<StatusActionFeedback>(null)

  const updateAppointmentStatus = useUpdateAppointmentStatusMutation({
    skipSuccessToast: true,
    skipErrorToast: true,
  })

  const patchStatus = async (
    appointmentId: string,
    status: AppointmentWithDetails['status'],
  ) => {
    setStatusFeedback({
      appointmentId,
      status,
      mode: 'saving',
      message: 'در حال ثبت وضعیت...',
    })
    try {
      const payload = await updateAppointmentStatus.mutateAsync({
        appointmentId,
        nextStatus: status,
      })
      setStatusFeedback({
        appointmentId,
        status,
        mode: 'saved',
        message:
          payload.type === 'deleted'
            ? 'رزرو موقت لغو و حذف شد.'
            : 'وضعیت ثبت شد.',
      })
      onAfterSuccess()
    } catch (err) {
      setStatusFeedback({
        appointmentId,
        status,
        mode: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'خطایی رخ داد. دوباره تلاش کنید.',
      })
    }
  }

  return { statusFeedback, patchStatus }
}
