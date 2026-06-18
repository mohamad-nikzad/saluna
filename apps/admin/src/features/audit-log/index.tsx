import { getApiV1AdminAuditLogOptions } from '@repo/api-client/query'
import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import type { ColumnDef, PaginationState } from '@tanstack/react-table'
import { Filter, RotateCcw } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

import { DataTable } from '#/components/data-table/data-table'
import { DataTablePagination } from '#/components/data-table/data-table-pagination'
import { DataTableToolbar } from '#/components/data-table/data-table-toolbar'
import { AdminPageHeader } from '#/components/layout/admin-page-header'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Skeleton } from '#/components/ui/skeleton'

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

type AuditLogUrlState = {
  page: number
  pageSize: number
  search: string
  action: string
  targetType: string
  targetId: string
  salonId: string
}

const filterFields = [
  ['action', 'Action'],
  ['targetType', 'Target type'],
  ['targetId', 'Target ID'],
  ['salonId', 'Salon ID'],
] as const

export function AuditLogPage() {
  return (
    <>
      <AdminPageHeader
        title="لاگ ممیزی"
        description="بازبینی عملیات ادمین‌های پلتفرم با فیلترهای دقیق و صفحه‌بندی."
      />
      <AuditLogScreen />
    </>
  )
}

export function AuditLogScreen() {
  const [state, setState] = useAuditLogUrlState(20)
  const columns = useMemo<ColumnDef<RecordRow>[]>(
    () => [
      {
        accessorKey: 'action',
        header: 'Action',
        cell: ({ row }) => (
          <PrimaryCell
            title={text(row.original.action)}
            subtitle={text(row.original.reason)}
          />
        ),
      },
      {
        accessorKey: 'actorName',
        header: 'Actor',
        cell: ({ row }) => (
          <PrimaryCell
            title={text(row.original.actorName) || text(row.original.actorUserId)}
            subtitle={text(row.original.actorUserId)}
          />
        ),
      },
      {
        accessorKey: 'actorPlatformRole',
        header: 'Role',
        cell: ({ row }) => (
          <RoleBadge role={text(row.original.actorPlatformRole)} />
        ),
      },
      {
        accessorKey: 'targetType',
        header: 'Target',
        cell: ({ row }) => (
          <PrimaryCell
            title={text(row.original.targetType)}
            subtitle={shortId(row.original.targetId)}
          />
        ),
      },
      {
        accessorKey: 'salonId',
        header: 'Salon ID',
        cell: ({ row }) => (
          <span dir="ltr">{shortId(row.original.salonId) || '-'}</span>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: 'Created',
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
        <ScreenSkeleton label="در حال دریافت لاگ ممیزی" />
      ) : null}
      {auditLogQuery.isError ? (
        <ErrorPanel message="بارگذاری لاگ ممیزی انجام نشد." />
      ) : null}
      <DataTable
        columns={columns}
        data={auditLogQuery.data?.items ?? []}
        pageCount={pageCount}
        pagination={pagination}
        onPaginationChange={(next) =>
          setState({ page: next.pageIndex + 1, pageSize: next.pageSize })
        }
      />
      <DataTablePagination
        pagination={pagination}
        pageCount={pageCount}
        onPaginationChange={(next) =>
          setState({ page: next.pageIndex + 1, pageSize: next.pageSize })
        }
      />
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
          پاک‌سازی فیلترها
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

function useAuditLogUrlState(defaultPageSize: number) {
  const [state, setStateValue] = useState<AuditLogUrlState>(() => {
    const params = new URLSearchParams(window.location.search)
    return {
      page: positiveNumber(params.get('page'), 1),
      pageSize: positiveNumber(params.get('pageSize'), defaultPageSize),
      search: params.get('q') ?? '',
      action: params.get('action') ?? '',
      targetType: params.get('targetType') ?? '',
      targetId: params.get('targetId') ?? '',
      salonId: params.get('salonId') ?? '',
    }
  })

  const setState = useCallback(
    (next: Partial<AuditLogUrlState>) => {
      setStateValue((current) => {
        const updated = { ...current, ...next }
        const params = new URLSearchParams(window.location.search)
        const entries = {
          page: updated.page,
          pageSize: updated.pageSize,
          q: updated.search,
          action: updated.action,
          targetType: updated.targetType,
          targetId: updated.targetId,
          salonId: updated.salonId,
        }

        for (const [key, value] of Object.entries(entries)) {
          if (value === undefined || value === '') {
            params.delete(key)
          } else {
            params.set(key, String(value))
          }
        }

        const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`
        window.history.replaceState(null, '', nextUrl)
        return updated
      })
    },
    [],
  )

  return [state, setState] as const
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

function RoleBadge({ role }: { role: string }) {
  if (!role) return <Badge variant="outline">بدون نقش</Badge>
  return <Badge>{formatRole(role)}</Badge>
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
      {message}
    </div>
  )
}

function ScreenSkeleton({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="space-y-3 rounded-lg border border-border bg-card p-4"
    >
      <Skeleton className="h-5 w-52" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  )
}

function formatRole(role: string) {
  const roles: Record<string, string> = {
    platform_owner: 'مالک',
    platform_admin: 'ادمین',
    platform_support: 'پشتیبان',
    platform_viewer: 'بیننده',
  }
  return roles[role] ?? role
}

function text(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value)
  return ''
}

function formatDate(value: unknown): string {
  const raw = text(value)
  if (!raw) return '-'
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw
  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function shortId(value: unknown) {
  const id = text(value)
  if (!id) return ''
  return id.length > 8 ? id.slice(0, 8) : id
}

function positiveNumber(value: string | null, fallback: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return parsed
}
