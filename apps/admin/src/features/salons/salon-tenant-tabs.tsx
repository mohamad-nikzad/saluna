import {
  getApiV1AdminSalonsByIdAppointmentRequestsOptions,
  getApiV1AdminSalonsByIdAppointmentsOptions,
  getApiV1AdminSalonsByIdClientsOptions,
  getApiV1AdminSalonsByIdServicesOptions,
  getApiV1AdminSalonsByIdStaffOptions,
} from '@repo/api-client/query'
import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import type { ColumnDef, PaginationState } from '@tanstack/react-table'
import { useState } from 'react'

import { ErrorPanel } from '#/components/admin/error-panel'
import { ScreenSkeleton } from '#/components/admin/screen-skeleton'
import { DataTable } from '#/components/data-table/data-table'
import { DataTablePagination } from '#/components/data-table/data-table-pagination'
import { DataTableToolbar } from '#/components/data-table/data-table-toolbar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'

import {
  useAppointmentColumns,
  useClientColumns,
  useRequestColumns,
  useServiceColumns,
  useStaffColumns,
  type RecordRow,
} from './salon-columns'
import { Panel } from '#/components/admin/panel'
import type { SalonOpsTab } from './salon-url-state'

type ListParams = {
  page: number
  pageSize: number
  search?: string
}

type ListResult = {
  items: RecordRow[]
  pagination: {
    page: number
    pageSize: number
    total: number
  }
}

type AdminListQueryOptions = UseQueryOptions<
  ListResult,
  unknown,
  ListResult,
  readonly unknown[]
>

export function SalonTenantDataTabs({
  salonId,
  activeTab,
  onTabChange,
}: {
  salonId: string
  activeTab: SalonOpsTab
  onTabChange: (tab: SalonOpsTab) => void
}) {
  const clientColumns = useClientColumns()
  const appointmentColumns = useAppointmentColumns()
  const requestColumns = useRequestColumns()
  const staffColumns = useStaffColumns()
  const serviceColumns = useServiceColumns()

  return (
    <Panel title="داده‌های عملیاتی">
      <Tabs
        value={activeTab}
        onValueChange={(value) => onTabChange(value as SalonOpsTab)}
        className="space-y-4"
      >
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="clients">مشتریان</TabsTrigger>
          <TabsTrigger value="appointments">نوبت‌ها</TabsTrigger>
          <TabsTrigger value="requests">درخواست‌های نوبت</TabsTrigger>
          <TabsTrigger value="staff">پرسنل</TabsTrigger>
          <TabsTrigger value="services">انواع خدمت</TabsTrigger>
        </TabsList>
        <TenantTabContent
          value="clients"
          columns={clientColumns}
          loadingLabel="در حال بارگذاری مشتریان"
          queryOptionsFor={(params) =>
            getApiV1AdminSalonsByIdClientsOptions({
              path: { id: salonId },
              query: params,
            })
          }
          emptyCopy="مشتری‌ای برای این سالن ثبت نشده است."
        />
        <TenantTabContent
          value="appointments"
          columns={appointmentColumns}
          loadingLabel="در حال بارگذاری نوبت‌ها"
          queryOptionsFor={(params) =>
            getApiV1AdminSalonsByIdAppointmentsOptions({
              path: { id: salonId },
              query: params,
            })
          }
          emptyCopy="نوبتی برای این سالن ثبت نشده است."
        />
        <TenantTabContent
          value="requests"
          columns={requestColumns}
          loadingLabel="در حال بارگذاری درخواست‌های نوبت"
          queryOptionsFor={(params) =>
            getApiV1AdminSalonsByIdAppointmentRequestsOptions({
              path: { id: salonId },
              query: params,
            })
          }
          emptyCopy="درخواست نوبتی برای این سالن ثبت نشده است."
        />
        <TenantTabContent
          value="staff"
          columns={staffColumns}
          loadingLabel="در حال بارگذاری پرسنل"
          queryOptionsFor={(params) =>
            getApiV1AdminSalonsByIdStaffOptions({
              path: { id: salonId },
              query: params,
            })
          }
          emptyCopy="پرسنلی برای این سالن ثبت نشده است."
        />
        <TenantTabContent
          value="services"
          columns={serviceColumns}
          loadingLabel="در حال بارگذاری انواع خدمت"
          queryOptionsFor={(params) =>
            getApiV1AdminSalonsByIdServicesOptions({
              path: { id: salonId },
              query: params,
            })
          }
          emptyCopy="نوع خدمتی برای این سالن ثبت نشده است."
        />
      </Tabs>
    </Panel>
  )
}

function TenantTabContent({
  value,
  columns,
  loadingLabel,
  queryOptionsFor,
  emptyCopy,
}: {
  value: string
  columns: ColumnDef<RecordRow>[]
  loadingLabel: string
  queryOptionsFor: (params: ListParams) => unknown
  emptyCopy: string
}) {
  const [query, setQuery] = useState('')
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })
  const listQuery = useQuery(
    queryOptionsFor({
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      search: query || undefined,
    }) as AdminListQueryOptions,
  )
  const total = listQuery.data?.pagination.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / pagination.pageSize))
  const rows = listQuery.data?.items ?? []

  return (
    <TabsContent value={value} className="space-y-3">
      <DataTableToolbar
        query={query}
        onQueryChange={(nextQuery) => {
          setQuery(nextQuery)
          setPagination((current) => ({ ...current, pageIndex: 0 }))
        }}
        onReset={() => {
          setQuery('')
          setPagination((current) => ({ ...current, pageIndex: 0 }))
        }}
      />
      {listQuery.isLoading ? (
        <ScreenSkeleton label={loadingLabel} />
      ) : null}
      {listQuery.isError ? (
        <ErrorPanel
          message="بارگذاری داده‌های سالن ناموفق بود."
          onRetry={() => void listQuery.refetch()}
        />
      ) : null}
      {!listQuery.isLoading && !listQuery.isError && rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyCopy}</p>
      ) : null}
      {!listQuery.isLoading && !listQuery.isError ? (
        <>
          <DataTable
            columns={columns}
            data={rows}
            pageCount={pageCount}
            pagination={pagination}
            onPaginationChange={setPagination}
          />
          <DataTablePagination
            pagination={pagination}
            pageCount={pageCount}
            onPaginationChange={setPagination}
          />
        </>
      ) : null}
    </TabsContent>
  )
}
