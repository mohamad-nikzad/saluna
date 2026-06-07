import { createContext, useCallback, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@repo/api-client'
import type { User } from '@repo/salon-core/types'

import { api } from '#/lib/api-client'

export const authQueryKey = ['auth', 'me'] as const

async function fetchSessionUser({
  signal,
}: { signal?: AbortSignal } = {}): Promise<User | null> {
  try {
    const res = await api.auth.me({ signal })
    return res.user
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      return null
    }
    throw err
  }
}

export function registerAuthQueryDefaults(queryClient: QueryClient) {
  queryClient.setQueryDefaults(authQueryKey, {
    queryFn: ({ signal }) => fetchSessionUser({ signal }),
    staleTime: 60_000,
    retry: 1,
  })
}

export type AuthContextValue = {
  user: User | null
  loading: boolean
  logout: () => Promise<void>
  refresh: () => Promise<User | null>
  setUser: (user: User | null) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  const query = useQuery<User | null>({
    queryKey: authQueryKey,
    queryFn: ({ signal }) => fetchSessionUser({ signal }),
    refetchOnMount: 'always',
  })

  const setUser = useCallback(
    (user: User | null) => {
      queryClient.setQueryData(authQueryKey, user)
    },
    [queryClient],
  )

  const refresh = useCallback(
    () =>
      queryClient.fetchQuery({
        queryKey: authQueryKey,
        queryFn: ({ signal }) => fetchSessionUser({ signal }),
      }),
    [queryClient],
  )

  const logout = useCallback(async () => {
    try {
      await api.auth.logout()
    } catch {
      /* ignore — clear local state regardless */
    }
    setUser(null)
    void queryClient.invalidateQueries()
  }, [queryClient, setUser])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: query.data ?? null,
      loading: query.isLoading,
      logout,
      refresh,
      setUser,
    }),
    [query.data, query.isPending, logout, refresh, setUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
