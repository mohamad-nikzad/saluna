import { ApiError } from '@repo/api-client/errors'
import { getApiV1AdminAuthMeOptions } from '@repo/api-client/query'
import { createFileRoute, isRedirect, redirect } from '@tanstack/react-router'

import { AdminLoginPage } from '#/features/admin-login-page'

export const Route = createFileRoute('/login')({
  beforeLoad: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(getApiV1AdminAuthMeOptions())
      throw redirect({ to: '/overview' })
    } catch (error) {
      if (isRedirect(error)) throw error
      if (error instanceof ApiError && error.status === 401) return
    }
  },
  component: AdminLoginPage,
})
