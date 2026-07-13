import { startTransition, useCallback, useState } from 'react'
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
  createSession: number
  availabilityOpen: boolean
  detailAppointment: AppointmentWithDetails | null
  createIntent: AppointmentCreateIntent
}

export function useAppointmentFlow(defaults?: {
  defaultDate?: string
  defaultTime?: string
}) {
  const [createOpen, setCreateOpen] = useState(false)
  const [createSession, setCreateSession] = useState(0)
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

  const prepareCreate = useCallback((intent: AppointmentCreateIntent) => {
    setCreateIntent(intent)
    setCreateSession((current) => current + 1)
    requestAnimationFrame(() => {
      startTransition(() => setCreateOpen(true))
    })
  }, [])

  const openCreateIntent = useCallback(
    (intent: AppointmentCreateIntent) => prepareCreate(intent),
    [prepareCreate],
  )

  const openCreate = useCallback(
    (date: string, time: string) =>
      prepareCreate(emptyCreateIntent(date, time)),
    [prepareCreate],
  )

  const openCreateFromAvailability = useCallback(
    (selection: AppointmentAvailabilitySelection) => {
      setAvailabilityOpen(false)
      prepareCreate(availabilitySelectionToCreateIntent(selection))
    },
    [prepareCreate],
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
      createSession,
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
