import { createFileRoute } from '@tanstack/react-router'

import { AuditLogPage } from '#/features/audit-log'
import { auditLogSearchSchema } from '#/lib/admin-search-schemas'

export const Route = createFileRoute('/_admin/audit-log')({
  validateSearch: auditLogSearchSchema,
  component: AuditLogRoute,
})

function AuditLogRoute() {
  return <AuditLogPage />
}
