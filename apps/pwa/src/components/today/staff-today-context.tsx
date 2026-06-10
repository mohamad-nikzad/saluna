import { createContext } from 'react'
import type { AppointmentWithDetails, TodayData } from '@repo/salon-core/types'

export type StatusActionFeedback = {
  appointmentId: string
  status: AppointmentWithDetails['status']
  mode: 'saving' | 'saved' | 'error'
  message: string
} | null

export interface StaffTodayState {
  todayDate: string
  tomorrowDate: string
  todayData?: TodayData
  tomorrowData?: TodayData
  todayLoading: boolean
  tomorrowLoading: boolean
  todayError: unknown
  tomorrowError: unknown
  staffName: string
}

export interface StaffTodayActions {
  mutateToday: () => void
  mutateTomorrow: () => void
}

export interface StaffTodayContextValue {
  state: StaffTodayState
  actions: StaffTodayActions
}

export const StaffTodayContext = createContext<StaffTodayContextValue | null>(
  null,
)
