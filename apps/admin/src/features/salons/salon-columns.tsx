import {
  getApiV1AdminOverviewQueryKey,
  getApiV1AdminSalonsQueryKey,
  patchApiV1AdminSalonsByIdStatusMutation,
} from '@repo/api-client/query'
import type { AdminSalonStatusUpdateRequest } from '@repo/api-client/types'
import { Link } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import {
  Archive,
  Check,
  CircleCheck,
  Clock,
  Inbox,
  KeyRound,
  LayoutDashboard,
  MapPin,
  MoreHorizontal,
  PauseCircle,
  Pencil,
  Scissors,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { BooleanBadge } from '#/components/admin/boolean-badge'
import { MutationError } from '#/components/admin/mutation-error'
import { PrimaryCell } from '#/components/admin/primary-cell'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { formatCurrency, formatDate, number, text } from '#/lib/admin-format'

export type RecordRow = Record<string, unknown>
export type AdminSalonStatus = 'setup' | 'active' | 'suspended' | 'archived'

export function useSalonsListColumns() {
  return useMemo<ColumnDef<RecordRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'سالن',
        cell: ({ row }) => (
          <Link
            to="/salons/$salonId"
            params={{ salonId: text(row.original.id) }}
            className="block min-w-0 rounded-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <PrimaryCell
              title={text(row.original.name)}
              subtitle={text(row.original.slug)}
            />
          </Link>
        ),
      },
      {
        accessorKey: 'status',
        header: 'وضعیت',
        cell: ({ row }) => <StatusBadge status={text(row.original.status)} />,
      },
      {
        id: 'owner',
        header: 'مالک / تحویل',
        cell: ({ row }) => <OwnerCell row={row.original} />,
      },
      {
        accessorKey: 'phone',
        header: 'تلفن',
        cell: ({ row }) => (
          <span dir="ltr">
            {text(row.original.phone) || text(row.original.intendedOwnerPhone)}
          </span>
        ),
      },
      {
        accessorKey: 'memberCount',
        header: 'پرسنل',
        cell: ({ row }) => number(row.original.memberCount),
      },
      {
        accessorKey: 'serviceCount',
        header: 'خدمات',
        cell: ({ row }) => number(row.original.serviceCount),
      },
      {
        accessorKey: 'createdAt',
        header: 'ایجاد',
        cell: ({ row }) => formatDate(row.original.createdAt),
      },
      {
        id: 'actions',
        cell: ({ row }) => <SalonRowActions row={row.original} />,
      },
    ],
    [],
  )
}

function OwnerCell({ row }: { row: RecordRow }) {
  const ownerName = text(row.ownerName)
  const ownerPhone = text(row.ownerPhone)
  const intendedOwnerPhone = text(row.intendedOwnerPhone)

  if (ownerName || ownerPhone) {
    return (
      <PrimaryCell
        title={ownerName || ownerPhone}
        subtitle={ownerPhone && ownerName ? ownerPhone : 'مالک ثبت‌شده'}
      />
    )
  }

  if (intendedOwnerPhone) {
    return (
      <span dir="ltr">
        <PrimaryCell title="در انتظار تحویل" subtitle={intendedOwnerPhone} />
      </span>
    )
  }

  return <span className="text-muted-foreground">بدون مالک</span>
}

function SalonRowActions({ row }: { row: RecordRow }) {
  const salonId = text(row.id)
  const status = normalizeStatus(row.status)
  const salonName = text(row.name) || 'این سالن'
  const [nextStatus, setNextStatus] = useState<Exclude<
    AdminSalonStatus,
    'setup'
  > | null>(null)
  const queryClient = useQueryClient()
  const statusMutation = useMutation({
    ...patchApiV1AdminSalonsByIdStatusMutation(),
    onSuccess: () => {
      setNextStatus(null)
      void queryClient.invalidateQueries({
        queryKey: getApiV1AdminSalonsQueryKey(),
      })
      void queryClient.invalidateQueries({
        queryKey: getApiV1AdminOverviewQueryKey(),
      })
    },
  })
  const setup = status === 'setup'

  function submitStatus() {
    if (!nextStatus) return
    const body: AdminSalonStatusUpdateRequest = { status: nextStatus }
    statusMutation.mutate({ path: { id: salonId }, body })
  }

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" aria-label="اقدام‌های سالن">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuLabel>میانبرها</DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <Link to="/salons/$salonId" params={{ salonId }}>
              <LayoutDashboard />
              نمای کلی
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/salons/$salonId/edit" params={{ salonId }}>
              <Pencil />
              ویرایش اطلاعات سالن
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/salons/$salonId/hours" params={{ salonId }}>
              <Clock />
              ساعت کاری
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/salons/$salonId/presence" params={{ salonId }}>
              <MapPin />
              حضور سالن
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/salons/$salonId/staff" params={{ salonId }}>
              <Users />
              پرسنل
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/salons/$salonId/services" params={{ salonId }}>
              <Scissors />
              خدمات
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/salons/$salonId/clients" params={{ salonId }}>
              <UserRound />
              مشتریان
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/salons/$salonId/requests" params={{ salonId }}>
              <Inbox />
              درخواست‌ها
            </Link>
          </DropdownMenuItem>
          {setup ? (
            <DropdownMenuItem asChild>
              <Link to="/salons/$salonId/handoff" params={{ salonId }}>
                <KeyRound />
                تحویل
              </Link>
            </DropdownMenuItem>
          ) : null}
          {!setup ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>تغییر وضعیت</DropdownMenuLabel>
              {STATUS_ACTIONS.filter((action) => action.status !== status).map(
                (action) => (
                  <DropdownMenuItem
                    key={action.status}
                    onSelect={() => setNextStatus(action.status)}
                  >
                    <action.icon />
                    {action.label}
                  </DropdownMenuItem>
                ),
              )}
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={Boolean(nextStatus)}
        onOpenChange={(open) => {
          if (!open) setNextStatus(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأیید تغییر وضعیت</DialogTitle>
            <DialogDescription>
              وضعیت «{salonName}» به {statusLabel(nextStatus)} تغییر می‌کند.
            </DialogDescription>
          </DialogHeader>
          <MutationError error={statusMutation.error} />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setNextStatus(null)}
            >
              انصراف
            </Button>
            <Button
              type="button"
              disabled={statusMutation.isPending}
              onClick={submitStatus}
            >
              <Check className="h-4 w-4" />
              تأیید تغییر وضعیت
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

const STATUS_ACTIONS: Array<{
  status: Exclude<AdminSalonStatus, 'setup'>
  label: string
  icon: LucideIcon
}> = [
  { status: 'active', label: 'فعال کردن', icon: CircleCheck },
  { status: 'suspended', label: 'تعلیق کردن', icon: PauseCircle },
  { status: 'archived', label: 'آرشیو کردن', icon: Archive },
]

function statusLabel(status: AdminSalonStatus | null) {
  if (status === 'active') return 'فعال'
  if (status === 'suspended') return 'تعلیق‌شده'
  if (status === 'archived') return 'آرشیوشده'
  if (status === 'setup') return 'راه‌اندازی'
  return 'وضعیت جدید'
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
        header: 'خدمت',
        cell: ({ row }) => (
          <PrimaryCell
            title={text(row.original.name)}
            subtitle={text(row.original.categoryName)}
          />
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
  if (value === 'setup' || value === 'suspended' || value === 'archived')
    return value
  return 'active'
}

export function truthy(value: unknown): boolean {
  return value === true || value === 'true' || value === 1
}

export { BooleanBadge } from '#/components/admin/boolean-badge'
export { PrimaryCell } from '#/components/admin/primary-cell'

export function StatusBadge({ status }: { status: string }) {
  if (status === 'setup') return <Badge>راه‌اندازی</Badge>
  if (status === 'active') return <Badge variant="success">فعال</Badge>
  if (status === 'suspended') return <Badge variant="warning">تعلیق‌شده</Badge>
  if (status === 'archived') return <Badge variant="danger">آرشیوشده</Badge>
  return <Badge>{status || 'نامشخص'}</Badge>
}
