import { getApiV1AdminSalonsOptions } from '@repo/api-client/query'

import { AdminListTable } from '#/components/admin/admin-list-table'
import { AdminPageHeader } from '#/components/layout/admin-page-header'

import { useSalonsListColumns } from './salon-columns'

export function SalonsListPage() {
  return (
    <>
      <AdminPageHeader
        title="سالن‌ها"
        description="جستجو، وضعیت پلتفرم و عملیات داخلی سالن‌های Saluna."
      />
      <SalonsListScreen />
    </>
  )
}

export function SalonsListScreen() {
  const columns = useSalonsListColumns()

  return (
    <AdminListTable
      from="/_admin/salons/"
      columns={columns}
      queryOptionsFor={(params) =>
        getApiV1AdminSalonsOptions({ query: params })
      }
      hint="جستجو بر اساس نام سالن، شناسه یا شماره تلفن..."
      loadingLabel="در حال بارگذاری سالن‌ها"
      errorMessage="بارگذاری سالن‌ها ناموفق بود."
    />
  )
}
