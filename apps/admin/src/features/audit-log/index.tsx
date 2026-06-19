import { getApiV1AdminAuditLogOptions } from '@repo/api-client/query'
import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import type { ColumnDef, PaginationState } from '@tanstack/react-table'
import { Filter, RotateCcw } from 'lucide-react'
import { useMemo } from 'react'

import { DataTable } from '#/components/data-table/data-table'
import { DataTablePagination } from '#/components/data-table/data-table-pagination'
import { DataTableToolbar } from '#/components/data-table/data-table-toolbar'
import { ErrorPanel } from '#/components/admin/error-panel'
import { RoleBadge } from '#/components/admin/role-badge'
import { ScreenSkeleton } from '#/components/admin/screen-skeleton'
import { AdminPageHeader } from '#/components/layout/admin-page-header'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { formatDate, text } from '#/lib/admin-format'
import { normalizePageSize } from '#/lib/admin-search-schemas'
import {
  useAuditLogSearch,
  type AuditLogUrlState,
} from '#/hooks/use-audit-log-search'

type RecordRow = Record<string, unknown>

type AuditLogParams = {
  page: number
  pageSize: number
  search?: string
  action?: string
  targetType?: string
  targetId?: string
  salonId?: string
}

type AuditLogResult = {
  items: RecordRow[]
  pagination: {
    page: number
    pageSize: number
    total: number
  }
}

type AuditLogQueryOptions = UseQueryOptions<
  AuditLogResult,
  unknown,
  AuditLogResult,
  readonly unknown[]
>

const filterFields = [
  ['action', 'عمل'],
  ['targetType', 'نوع هدف'],
  ['targetId', 'شناسه هدف'],
  ['salonId', 'شناسه سالن'],
] as const

export function AuditLogPage() {
  return (
    <>
      <AdminPageHeader
        title="گزارش ممیزی"
        description="بررسی عملیات ادمین پلتفرم با فیلترهای دقیق و صفحه‌بندی."
      />
      <AuditLogScreen />
    </>
  )
}

export function AuditLogScreen() {
  const [state, setState] = useAuditLogSearch(20)
  const columns = useMemo<ColumnDef<RecordRow>[]>(
    () => [
      {
        accessorKey: 'action',
        header: 'عمل',
        cell: ({ row }) => (
          <PrimaryCell
            title={text(row.original.action)}
            subtitle={text(row.original.reason)}
          />
        ),
      },
      {
        accessorKey: 'actorName',
        header: 'عامل',
        cell: ({ row }) => (
          <PrimaryCell
            title={text(row.original.actorName) || text(row.original.actorUserId)}
            subtitle={text(row.original.actorUserId)}
          />
        ),
      },
      {
        accessorKey: 'actorPlatformRole',
        header: 'نقش',
        cell: ({ row }) => (
          <RoleBadge role={text(row.original.actorPlatformRole)} />
        ),
      },
      {
        accessorKey: 'targetType',
        header: 'هدف',
        cell: ({ row }) => (
          <PrimaryCell
            title={text(row.original.targetType)}
            subtitle={shortId(row.original.targetId)}
          />
        ),
      },
      {
        accessorKey: 'salonId',
        header: 'شناسه سالن',
        cell: ({ row }) => (
          <span dir="ltr">{shortId(row.original.salonId) || '-'}</span>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: 'تاریخ ایجاد',
        cell: ({ row }) => formatDate(row.original.createdAt),
      },
    ],
    [],
  )
  const pagination: PaginationState = {
    pageIndex: Math.max(state.page - 1, 0),
    pageSize: state.pageSize,
  }
  const auditLogQuery = useQuery(
    getApiV1AdminAuditLogOptions({
      query: compactParams({
        page: state.page,
        pageSize: state.pageSize,
        search: state.search,
        action: state.action,
        targetType: state.targetType,
        targetId: state.targetId,
        salonId: state.salonId,
      }),
    }) as AuditLogQueryOptions,
  )
  const total = auditLogQuery.data?.pagination.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / state.pageSize))

  return (
    <section className="space-y-3">
      <DataTableToolbar
        query={state.search}
        onQueryChange={(search) => setState({ search, page: 1 })}
        onReset={() =>
          setState({
            page: 1,
            search: '',
            action: '',
            targetType: '',
            targetId: '',
            salonId: '',
          })
        }
      />
      <AuditFilters state={state} onChange={setState} />
      {auditLogQuery.isLoading ? (
        <ScreenSkeleton label="در حال بارگذاری گزارش ممیزی" />
      ) : null}
      {auditLogQuery.isError ? (
        <ErrorPanel
          message="بارگذاری گزارش ممیزی ناموفق بود."
          onRetry={() => void auditLogQuery.refetch()}
        />
      ) : null}
      {!auditLogQuery.isLoading && !auditLogQuery.isError ? (
        <>
          <DataTable
            columns={columns}
            data={auditLogQuery.data?.items ?? []}
            pageCount={pageCount}
            pagination={pagination}
            onPaginationChange={(next) =>
              setState({
                page: next.pageIndex + 1,
                pageSize: normalizePageSize(next.pageSize, state.pageSize),
              })
            }
          />
          <DataTablePagination
            pagination={pagination}
            pageCount={pageCount}
            totalRows={total}
            onPaginationChange={(next) =>
              setState({
                page: next.pageIndex + 1,
                pageSize: normalizePageSize(next.pageSize, state.pageSize),
              })
            }
            onPageSizeChange={(pageSize) => setState({ page: 1, pageSize })}
          />
        </>
      ) : null}
    </section>
  )
}

function AuditFilters({
  state,
  onChange,
}: {
  state: AuditLogUrlState
  onChange: (next: Partial<AuditLogUrlState>) => void
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Filter className="h-4 w-4 text-muted-foreground" />
          فیلترهای ممیزی
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            onChange({
              page: 1,
              action: '',
              targetType: '',
              targetId: '',
              salonId: '',
            })
          }
        >
          <RotateCcw className="h-4 w-4" />
          پاک کردن فیلترها
        </Button>
      </div>
      <div className="grid gap-2 md:grid-cols-4">
        {filterFields.map(([field, label]) => (
          <label key={field} className="block space-y-1.5 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <Input
              value={state[field]}
              onChange={(event) =>
                onChange({ [field]: event.target.value, page: 1 })
              }
              placeholder={label}
              dir="ltr"
            />
          </label>
        ))}
      </div>
    </div>
  )
}

function compactParams(params: AuditLogParams): AuditLogParams {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== ''),
  ) as AuditLogParams
}

function PrimaryCell({
  title,
  subtitle,
}: {
  title: string
  subtitle?: string
}) {
  return (
    <div className="min-w-0">
      <div className="truncate font-medium">{title || '-'}</div>
      {subtitle ? (
        <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
      ) : null}
    </div>
  )
}

function shortId(value: unknown) {
  const id = text(value)
  if (!id) return ''
  return id.length > 8 ? id.slice(0, 8) : id
}
