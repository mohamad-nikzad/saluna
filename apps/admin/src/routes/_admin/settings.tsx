import { createFileRoute } from '@tanstack/react-router'

import { SettingsPage } from '#/features/settings'
import { tableSearchSchema } from '#/lib/admin-search-schemas'
import { requirePermission } from '#/lib/platform-rbac'

export const Route = createFileRoute('/_admin/settings')({
  beforeLoad: async ({ context }) => {
    await requirePermission(context.queryClient, 'manage_platform_admins')
  },
  validateSearch: tableSearchSchema,
  component: SettingsPage,
})
