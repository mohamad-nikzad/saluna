import type { AdminSalonStatus } from '@repo/api-client/types'
import { Link } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { Eye } from 'lucide-react'
import { useMemo } from 'react'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { formatCurrency, formatDate, number, text } from '#/lib/admin-format'

export type RecordRow = Record<string, unknown>

export function useSalonsListColumns() {
  return useMemo<ColumnDef<RecordRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'سالن',
        cell: ({ row }) => (
          <PrimaryCell
            title={text(row.original.name)}
            subtitle={text(row.original.slug)}
          />
        ),
      },
      {
        accessorKey: 'status',
        header: 'وضعیت',
        cell: ({ row }) => <StatusBadge status={text(row.original.status)} />,
      },
      {
        accessorKey: 'phone',
        header: 'تلفن',
        cell: ({ row }) => <span dir="ltr">{text(row.original.phone)}</span>,
      },
      {
        accessorKey: 'memberCount',
        header: 'اعضا',
        cell: ({ row }) => number(row.original.memberCount),
      },
      {
        accessorKey: 'publicEnabled',
        header: 'صفحه عمومی',
        cell: ({ row }) => (
          <BooleanBadge
            value={truthy(row.original.publicEnabled)}
            trueLabel="فعال"
            falseLabel="غیرفعال"
          />
        ),
      },
      {
        id: 'actions',
        cell: ({ row }) => (
          <Button asChild size="sm" variant="ghost">
            <Link
              to="/salons/$salonId"
              params={{ salonId: text(row.original.id) }}
            >
              <Eye className="h-4 w-4" />
              مشاهده
            </Link>
          </Button>
        ),
      },
    ],
    [],
  )
}

export function useClientColumns() {
  return useMemo<ColumnDef<RecordRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'مشتری',
        cell: ({ row }) => (
          <PrimaryCell
            title={text(row.original.name)}
            subtitle={text(row.original.phone)}
          />
        ),
      },
      {
        accessorKey: 'isPlaceholder',
        header: 'نوع',
        cell: ({ row }) => (
          <BooleanBadge
            value={truthy(row.original.isPlaceholder)}
            trueLabel="موقت"
            falseLabel="مشتری"
          />
        ),
      },
      {
        accessorKey: 'notes',
        header: 'یادداشت',
        cell: ({ row }) => text(row.original.notes) || '-',
      },
      {
        accessorKey: 'createdAt',
        header: 'تاریخ ایجاد',
        cell: ({ row }) => formatDate(row.original.createdAt),
      },
    ],
    [],
  )
}

export function useAppointmentColumns() {
  return useMemo<ColumnDef<RecordRow>[]>(
    () => [
      {
        accessorKey: 'bookedServiceName',
        header: 'نوبت',
        cell: ({ row }) => (
          <PrimaryCell
            title={text(row.original.bookedServiceName)}
            subtitle={`${text(row.original.date)} ${text(row.original.startTime)}`}
          />
        ),
      },
      {
        accessorKey: 'clientName',
        header: 'مشتری',
        cell: ({ row }) => (
          <PrimaryCell
            title={text(row.original.clientName)}
            subtitle={text(row.original.clientPhone)}
          />
        ),
      },
      {
        accessorKey: 'staffName',
        header: 'پرسنل',
        cell: ({ row }) => text(row.original.staffName) || '-',
      },
      {
        accessorKey: 'bookedTotalPrice',
        header: 'مبلغ',
        cell: ({ row }) => formatCurrency(row.original.bookedTotalPrice),
      },
      {
        accessorKey: 'status',
        header: 'وضعیت',
        cell: ({ row }) => (
          <Badge variant="outline">{text(row.original.status)}</Badge>
        ),
      },
    ],
    [],
  )
}

export function useRequestColumns() {
  return useMemo<ColumnDef<RecordRow>[]>(
    () => [
      {
        accessorKey: 'bookedServiceName',
        header: 'درخواست نوبت',
        cell: ({ row }) => (
          <PrimaryCell
            title={text(row.original.bookedServiceName)}
            subtitle={`${text(row.original.requestedDate)} ${text(row.original.requestedStartTime)}`}
          />
        ),
      },
      {
        accessorKey: 'customerName',
        header: 'مشتری',
        cell: ({ row }) => (
          <PrimaryCell
            title={text(row.original.customerName)}
            subtitle={text(row.original.customerPhone)}
          />
        ),
      },
      {
        accessorKey: 'status',
        header: 'وضعیت',
        cell: ({ row }) => (
          <Badge variant="outline">{text(row.original.status)}</Badge>
        ),
      },
      {
        accessorKey: 'paymentStatus',
        header: 'پرداخت',
        cell: ({ row }) => text(row.original.paymentStatus) || '-',
      },
      {
        accessorKey: 'createdAt',
        header: 'تاریخ ایجاد',
        cell: ({ row }) => formatDate(row.original.createdAt),
      },
    ],
    [],
  )
}

export function useStaffColumns() {
  return useMemo<ColumnDef<RecordRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'پرسنل',
        cell: ({ row }) => (
          <PrimaryCell
            title={text(row.original.displayName) || text(row.original.name)}
            subtitle={
              text(row.original.phoneNumber) || text(row.original.email)
            }
          />
        ),
      },
      {
        accessorKey: 'active',
        header: 'وضعیت',
        cell: ({ row }) => (
          <BooleanBadge
            value={truthy(row.original.active)}
            trueLabel="فعال"
            falseLabel="غیرفعال"
          />
        ),
      },
      {
        accessorKey: 'color',
        header: 'رنگ',
        cell: ({ row }) => text(row.original.color) || '-',
      },
      {
        accessorKey: 'createdAt',
        header: 'تاریخ عضویت',
        cell: ({ row }) => formatDate(row.original.createdAt),
      },
    ],
    [],
  )
}

export function useServiceColumns() {
  return useMemo<ColumnDef<RecordRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'نوع خدمت',
        cell: ({ row }) => (
          <PrimaryCell
            title={text(row.original.name)}
            subtitle={[
              text(row.original.categoryName),
              text(row.original.familyName),
            ]
              .filter(Boolean)
              .join(' / ')}
          />
        ),
      },
      {
        accessorKey: 'kind',
        header: 'نوع',
        cell: ({ row }) => (
          <Badge variant="outline">{text(row.original.kind)}</Badge>
        ),
      },
      {
        accessorKey: 'duration',
        header: 'مدت',
        cell: ({ row }) => `${number(row.original.duration)} دقیقه`,
      },
      {
        accessorKey: 'price',
        header: 'قیمت',
        cell: ({ row }) => formatCurrency(row.original.price),
      },
      {
        accessorKey: 'active',
        header: 'وضعیت',
        cell: ({ row }) => (
          <BooleanBadge
            value={truthy(row.original.active)}
            trueLabel="فعال"
            falseLabel="غیرفعال"
          />
        ),
      },
    ],
    [],
  )
}

export function normalizeStatus(value: unknown): AdminSalonStatus {
  if (value === 'suspended' || value === 'archived') return value
  return 'active'
}

export function truthy(value: unknown): boolean {
  return value === true || value === 'true' || value === 1
}

export function PrimaryCell({
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

export function StatusBadge({ status }: { status: string }) {
  if (status === 'active') return <Badge variant="success">فعال</Badge>
  if (status === 'suspended') return <Badge variant="warning">تعلیق‌شده</Badge>
  if (status === 'archived') return <Badge variant="danger">آرشیوشده</Badge>
  return <Badge>{status || 'نامشخص'}</Badge>
}

export function BooleanBadge({
  value,
  trueLabel = 'بله',
  falseLabel = 'خیر',
}: {
  value: boolean
  trueLabel?: string
  falseLabel?: string
}) {
  return (
    <Badge variant={value ? 'success' : 'outline'}>
      {value ? trueLabel : falseLabel}
    </Badge>
  )
}
