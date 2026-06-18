import { createFileRoute } from '@tanstack/react-router'

import { AuditLogPage } from '#/features/audit-log'

export const Route = createFileRoute('/_admin/audit-log')({
  component: AuditLogRoute,
})

function AuditLogRoute() {
  return <AuditLogPage />
}
