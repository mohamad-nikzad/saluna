import { useCallback, useState } from 'react'
import type { AppointmentWithDetails } from '@repo/salon-core/types'

import type {
  AppointmentAvailabilitySelection,
  AppointmentCreateIntent,
} from '#/lib/appointment-intake'
import {
  availabilitySelectionToCreateIntent,
  emptyCreateIntent,
} from '#/lib/appointment-intake'

export type AppointmentFlowState = {
  createOpen: boolean
  availabilityOpen: boolean
  detailAppointment: AppointmentWithDetails | null
  createIntent: AppointmentCreateIntent
}

export function useAppointmentFlow(defaults?: {
  defaultDate?: string
  defaultTime?: string
}) {
  const [createOpen, setCreateOpen] = useState(false)
  const [availabilityOpen, setAvailabilityOpen] = useState(false)
  const [detailAppointment, setDetailAppointment] =
    useState<AppointmentWithDetails | null>(null)
  const [createIntent, setCreateIntent] = useState<AppointmentCreateIntent>(
    () =>
      emptyCreateIntent(
        defaults?.defaultDate ?? '',
        defaults?.defaultTime ?? '09:00',
      ),
  )

  const resetCreateIntent = useCallback((date: string, time: string) => {
    setCreateIntent(emptyCreateIntent(date, time))
  }, [])

  const openCreateIntent = useCallback((intent: AppointmentCreateIntent) => {
    setCreateIntent(intent)
    setCreateOpen(true)
  }, [])

  const openCreate = useCallback((date: string, time: string) => {
    setCreateIntent(emptyCreateIntent(date, time))
    setCreateOpen(true)
  }, [])

  const openCreateFromAvailability = useCallback(
    (selection: AppointmentAvailabilitySelection) => {
      setAvailabilityOpen(false)
      setCreateIntent(availabilitySelectionToCreateIntent(selection))
      requestAnimationFrame(() => setCreateOpen(true))
    },
    [],
  )

  const openDetail = useCallback((appointment: AppointmentWithDetails) => {
    setDetailAppointment(appointment)
  }, [])

  const closeDetail = useCallback(() => {
    setDetailAppointment(null)
  }, [])

  const handleCreateOpenChange = useCallback((open: boolean) => {
    setCreateOpen(open)
    if (!open) {
      setCreateIntent((current) => ({
        ...current,
        staffId: undefined,
        serviceId: undefined,
        clientId: undefined,
      }))
    }
  }, [])

  const closeCreateAfterSuccess = useCallback(() => {
    setCreateOpen(false)
    setCreateIntent((current) => ({
      ...current,
      staffId: undefined,
      serviceId: undefined,
      clientId: undefined,
    }))
  }, [])

  return {
    state: {
      createOpen,
      availabilityOpen,
      detailAppointment,
      createIntent,
    },
    actions: {
      setAvailabilityOpen,
      openCreate,
      openCreateIntent,
      openCreateFromAvailability,
      openDetail,
      closeDetail,
      handleCreateOpenChange,
      closeCreateAfterSuccess,
      resetCreateIntent,
      setCreateIntent,
    },
  }
}
