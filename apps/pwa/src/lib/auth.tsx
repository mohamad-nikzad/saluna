import { createContext, useCallback, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@repo/api-client'
import type { MeResponse } from '@repo/api-client/auth'
import type { User } from '@repo/salon-core/types'

import { api } from '#/lib/api-client'

export const authQueryKey = ['auth', 'me'] as const

export type AuthSession = MeResponse | null

async function fetchSessionUser({
  signal,
}: { signal?: AbortSignal } = {}): Promise<AuthSession> {
  try {
    return await api.auth.me({ signal })
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
  session: AuthSession
  user: User | null
  preWorkspaceUser:
    | Extract<NonNullable<AuthSession>, { status: 'needs_workspace' }>['user']
    | null
  loading: boolean
  logout: () => Promise<void>
  refresh: () => Promise<AuthSession>
  setUser: (user: User | null) => void
  setSession: (session: AuthSession) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  const query = useQuery<AuthSession>({
    queryKey: authQueryKey,
    queryFn: ({ signal }) => fetchSessionUser({ signal }),
    refetchOnMount: 'always',
  })

  const setUser = useCallback(
    (user: User | null) => {
      queryClient.setQueryData(
        authQueryKey,
        user ? { status: 'ready', user } : null,
      )
    },
    [queryClient],
  )

  const setSession = useCallback(
    (session: AuthSession) => {
      queryClient.setQueryData(authQueryKey, session)
    },
    [queryClient],
  )

  const refresh = useCallback(
    () =>
      queryClient.fetchQuery({
        queryKey: authQueryKey,
        queryFn: ({ signal }) => fetchSessionUser({ signal }),
        staleTime: 0,
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

  const session = query.data ?? null
  const user =
    session?.status === 'needs_workspace' ? null : (session?.user ?? null)
  const preWorkspaceUser =
    session?.status === 'needs_workspace' ? session.user : null

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      preWorkspaceUser,
      loading: query.isLoading,
      logout,
      refresh,
      setUser,
      setSession,
    }),
    [
      session,
      user,
      preWorkspaceUser,
      query.isLoading,
      logout,
      refresh,
      setUser,
      setSession,
    ],
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
