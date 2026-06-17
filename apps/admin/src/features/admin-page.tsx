import type { ColumnDef, PaginationState } from '@tanstack/react-table'
import { useMemo } from 'react'
import { Activity, CircleAlert, LockKeyhole, Plus, ShieldCheck } from 'lucide-react'

import { DataTable } from '#/components/data-table/data-table'
import { DataTablePagination } from '#/components/data-table/data-table-pagination'
import { DataTableRowActions } from '#/components/data-table/data-table-row-actions'
import { DataTableToolbar } from '#/components/data-table/data-table-toolbar'
import { AdminPageHeader } from '#/components/layout/admin-page-header'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { useTableUrlState } from '#/hooks/use-table-url-state'

type AdminPageId =
  | 'overview'
  | 'salons'
  | 'users'
  | 'catalog-presets'
  | 'messaging-health'
  | 'support-lookup'
  | 'audit-log'
  | 'platform-admins'
  | 'settings'

type PageConfig = {
  title: string
  description: string
  action?: string
}

const pageConfig: Record<AdminPageId, PageConfig> = {
  overview: {
    title: 'Overview',
    description: 'Platform status, tenant health, failed deliveries, and recent governance activity.',
  },
  salons: {
    title: 'Salons',
    description: 'Read-only tenant business data with platform status controls arriving in the API phase.',
    action: 'Export',
  },
  users: {
    title: 'Users',
    description: 'Cross-tenant account lookup, memberships, messaging accounts, and support notes.',
  },
  'catalog-presets': {
    title: 'Catalog Presets',
    description: 'Platform-managed service catalog presets for onboarding and operational consistency.',
    action: 'New preset',
  },
  'messaging-health': {
    title: 'Messaging Health',
    description: 'Provider configuration, delivery failures, and linked messaging account signals.',
  },
  'support-lookup': {
    title: 'Support Lookup',
    description: 'Read-only appointment and appointment-request search across tenants.',
  },
  'audit-log': {
    title: 'Audit Log',
    description: 'Immutable admin mutation history with actors, targets, reasons, and request context.',
  },
  'platform-admins': {
    title: 'Platform Admins',
    description: 'Grant, change, and revoke internal access with owner safeguards.',
    action: 'Grant access',
  },
  settings: {
    title: 'Settings',
    description: 'Internal admin preferences that do not change tenant-facing behavior.',
  },
}

const sampleRows = [
  { id: 'salon_104', name: 'Nava Studio', status: 'active', owner: 'Mina Rahimi', updated: '2 min ago' },
  { id: 'salon_098', name: 'Roja Beauty', status: 'review', owner: 'Sara Amiri', updated: '16 min ago' },
  { id: 'salon_077', name: 'Moon Cut', status: 'suspended', owner: 'Arman Nouri', updated: '1 h ago' },
  { id: 'salon_051', name: 'Darya Care', status: 'active', owner: 'Laleh Sadeghi', updated: '3 h ago' },
]

type SampleRow = (typeof sampleRows)[number]

export function AdminPage({ pageId }: { pageId: AdminPageId }) {
  const config = pageConfig[pageId]
  const [tableState, setTableState] = useTableUrlState(20)
  const pagination: PaginationState = {
    pageIndex: Math.max(tableState.page - 1, 0),
    pageSize: tableState.pageSize,
  }
  const columns = useMemo<ColumnDef<SampleRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'owner',
        header: 'Owner',
      },
      {
        accessorKey: 'updated',
        header: 'Updated',
      },
      {
        id: 'actions',
        cell: () => <DataTableRowActions />,
      },
    ],
    [],
  )

  return (
    <>
      <AdminPageHeader
        title={config.title}
        description={config.description}
        actions={
          config.action ? (
            <Button>
              <Plus className="h-4 w-4" />
              {config.action}
            </Button>
          ) : null
        }
      />
      {pageId === 'overview' ? <OverviewGrid /> : null}
      <section className="space-y-3">
        <DataTableToolbar
          query={tableState.query}
          onQueryChange={(query) => setTableState({ query, page: 1 })}
          onReset={() => setTableState({ query: '', page: 1, sort: '' })}
        />
        <DataTable
          columns={columns}
          data={sampleRows}
          pageCount={3}
          pagination={pagination}
          onPaginationChange={(next) => setTableState({ page: next.pageIndex + 1, pageSize: next.pageSize })}
        />
        <DataTablePagination
          pagination={pagination}
          pageCount={3}
          onPaginationChange={(next) => setTableState({ page: next.pageIndex + 1, pageSize: next.pageSize })}
        />
      </section>
    </>
  )
}

function OverviewGrid() {
  const cards = [
    { label: 'Active salons', value: '128', icon: Activity, tone: 'success' },
    { label: 'Failed deliveries', value: '14', icon: CircleAlert, tone: 'warning' },
    { label: 'Admin mutations', value: '37', icon: ShieldCheck, tone: 'default' },
    { label: 'Restricted tenants', value: '3', icon: LockKeyhole, tone: 'danger' },
  ] as const

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <Card key={card.label}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{card.label}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{card.value}</div>
              <Badge className="mt-2" variant={card.tone}>
                Phase 1 preview
              </Badge>
            </CardContent>
          </Card>
        )
      })}
    </section>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'active') return <Badge variant="success">Active</Badge>
  if (status === 'suspended') return <Badge variant="danger">Suspended</Badge>
  return <Badge variant="warning">Review</Badge>
}
