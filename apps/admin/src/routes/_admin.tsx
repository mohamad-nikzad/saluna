import { ApiError } from '@repo/api-client/errors'
import { getApiV1AdminAuthMeOptions } from '@repo/api-client/query'
import { createFileRoute, isRedirect, redirect } from '@tanstack/react-router'

import { AdminShell } from '#/components/layout/admin-shell'

export const Route = createFileRoute('/_admin')({
  beforeLoad: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(getApiV1AdminAuthMeOptions())
    } catch (error) {
      if (isRedirect(error)) throw error
      if (error instanceof ApiError && error.status === 401) {
        throw redirect({ to: '/login' })
      }
      if (error instanceof ApiError && error.status === 403) {
        return
      }
      throw error
    }
  },
  component: AdminShell,
})
