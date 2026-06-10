import {
  duplicateClientFromError,
  isDuplicateClientError,
  useCompletePlaceholderClientMutation,
  useCreateAppointmentMutation,
  useDeleteAppointmentMutation,
  useUpdateAppointmentMutation,
  useUpdateAppointmentStatusMutation,
} from '#/lib/appointments-queries'

export { isDuplicateClientError, duplicateClientFromError }

export function useAppointmentIntakeMutations() {
  const createAppointment = useCreateAppointmentMutation()
  const updateAppointment = useUpdateAppointmentMutation()
  const deleteAppointment = useDeleteAppointmentMutation()
  const updateAppointmentStatus = useUpdateAppointmentStatusMutation()
  const completePlaceholderClient = useCompletePlaceholderClientMutation()

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
