import type { AdminMeResponse } from '@repo/api-client/types'
import type { ReactNode } from 'react'
import { createContext, use } from 'react'

type AdminAuthContextValue = {
  me: AdminMeResponse['user']
  runtime: AdminMeResponse['runtime']
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null)

export function AdminAuthProvider({
  me,
  runtime,
  children,
}: {
  me: AdminMeResponse['user']
  runtime: AdminMeResponse['runtime']
  children: ReactNode
}) {
  return (
    <AdminAuthContext value={{ me, runtime }}>
      {children}
    </AdminAuthContext>
  )
}

export function useAdminAuth() {
  const value = use(AdminAuthContext)
  if (!value)
    throw new Error('useAdminAuth must be used inside AdminAuthProvider')
  return value
}
