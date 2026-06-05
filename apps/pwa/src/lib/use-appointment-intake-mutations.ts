import { DataClientHttpError } from '@repo/data-client'
import type { CompletePlaceholderClientInput, AppointmentFormInput  } from '@repo/salon-core/forms/appointment'
import { appointmentFormSchema } from '@repo/salon-core/forms/appointment'
import type { AppointmentWithDetails } from '@repo/salon-core/types'

import { useManagerWriteMutation } from '#/lib/use-manager-mutation'

type AppointmentMutationResult =
  | { type: 'deleted'; id: string }
  | { type: 'updated'; appointment: AppointmentWithDetails }

export function useAppointmentIntakeMutations() {
  const createAppointment = useManagerWriteMutation('appointment.create', {
    dataClientFn: async (dc, values: AppointmentFormInput) => {
      const payload = appointmentFormSchema.parse(values)
      return dc.appointments.create(payload)
    },
  })

  const updateAppointment = useManagerWriteMutation('appointment.update', {
    dataClientFn: async (
      dc,
      {
        appointmentId,
        values,
        nextStatus,
      }: {
        appointmentId: string
        values: AppointmentFormInput
        nextStatus: AppointmentWithDetails['status']
      },
    ): Promise<AppointmentMutationResult> => {
      const payload = appointmentFormSchema.parse(values)
      const result = await dc.appointments.update(appointmentId, {
        ...payload,
        status: nextStatus,
      })
      return result.type === 'deleted'
        ? { type: 'deleted', id: result.id }
        : { type: 'updated', appointment: result.appointment }
    },
  })

  const deleteAppointment = useManagerWriteMutation('appointment.delete', {
    dataClientFn: async (dc, appointmentId: string) => {
      await dc.appointments.remove(appointmentId)
    },
  })

  const updateAppointmentStatus = useManagerWriteMutation(
    'appointment.updateStatus',
    {
      dataClientFn: async (
        dc,
        {
          appointmentId,
          nextStatus,
        }: {
          appointmentId: string
          nextStatus: AppointmentWithDetails['status']
        },
      ): Promise<AppointmentMutationResult> => {
        const result = await dc.appointments.updateStatus(
          appointmentId,
          nextStatus,
        )
        return result.type === 'deleted'
          ? { type: 'deleted', id: result.id }
          : { type: 'updated', appointment: result.appointment }
      },
      meta: { skipSuccessToast: true },
    },
  )

  const completePlaceholderClient = useManagerWriteMutation(
    'appointment.completePlaceholderClient',
    {
      dataClientFn: async (
        dc,
        {
          appointmentId,
          values,
        }: {
          appointmentId: string
          values: CompletePlaceholderClientInput
        },
      ) => {
        const payload = { ...values, notes: values.notes ?? undefined }
        return dc.appointments.completePlaceholderClient(appointmentId, payload)
      },
      meta: {
        skipErrorToast: true,
        errorMessage: 'ثبت اطلاعات مشتری انجام نشد',
      },
    },
  )

  const isMutating =
    createAppointment.isPending ||
    updateAppointment.isPending ||
    deleteAppointment.isPending ||
    updateAppointmentStatus.isPending ||
    completePlaceholderClient.isPending

  return {
    createAppointment,
    updateAppointment,
    deleteAppointment,
    updateAppointmentStatus,
    completePlaceholderClient,
    isMutating,
  }
}

export function isDuplicateClientError(err: unknown): err is DataClientHttpError {
  return err instanceof DataClientHttpError
}
