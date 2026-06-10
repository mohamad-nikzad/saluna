import { createContext } from 'react'
import type { Client, Service, TodayData, User } from '@repo/salon-core/types'

export interface ManagerTodayState {
  date: string
  data?: TodayData
  isLoading: boolean
  error: unknown
  staff: User[]
  services: Service[]
  clients: Client[]
  managerName: string
}

export interface ManagerTodayActions {
  setDate: (date: string) => void
  mutateToday: () => void
  onRefreshResources: () => void
}

export interface ManagerTodayContextValue {
  state: ManagerTodayState
  actions: ManagerTodayActions
}

export const ManagerTodayContext =
  createContext<ManagerTodayContextValue | null>(null)
