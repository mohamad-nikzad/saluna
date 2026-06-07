import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight, Plus } from 'lucide-react'
import { Button } from '@repo/ui/button'
import { toPersianDigits } from '@repo/salon-core/persian-digits'
import type { User } from '@repo/salon-core/types'

import {
  StaffActionsProvider,
  useStaffActions,
} from '#/components/staff/staff-actions-provider'
import { StaffListCard } from '#/components/staff/staff-list-card'
import { StaffMiniStat } from '#/components/staff/staff-mini-stat'
import { StaffSkeleton } from '#/components/staff/staff-skeleton'
import type { ManagerServicesList } from '#/lib/manager-data-queries'
import { staffServiceCount } from '#/components/staff/staff-utils'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '#/lib/auth'
import {
  useManagerServicesQuery,
} from '#/lib/manager-data-queries'
import { staffListQueryOptions } from '#/lib/staff-queries'

export const Route = createFileRoute('/_authed/staff/')({
  component: StaffListPage,
  pendingComponent: StaffSkeleton,
})

function StaffListPage() {
  const staffQuery = useQuery(staffListQueryOptions())
  const servicesQuery = useManagerServicesQuery()
  const staff = staffQuery.data ?? []
  const servicesList = servicesQuery.data ?? []

  if (staffQuery.isPending || servicesQuery.isPending) {
    return <StaffSkeleton />
  }

  return (
    <StaffActionsProvider services={servicesList}>
      <StaffListContent staff={staff} servicesList={servicesList} />
    </StaffActionsProvider>
  )
}

function StaffListContent({
  staff,
  servicesList,
}: {
  staff: User[]
  servicesList: ManagerServicesList
}) {
  const { user } = useAuth()
  const {
    openCreateProfile,
    openPassword,
    openServices,
    openSchedule,
    openDeleteDialog,
  } = useStaffActions()

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="border-b border-line-soft bg-card px-[18px] pb-4 pt-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <Button
              variant="ghost"
              size="icon-sm"
              asChild
              className="mt-0.5 size-10 shrink-0 rounded-2xl touch-manipulation"
            >
              <Link to="/settings" aria-label="بازگشت به بیشتر">
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold text-foreground">
                پرسنل و نقش‌ها
              </h1>
              <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
                {toPersianDigits(staff.length)} نفر در تیم
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="icon"
            onClick={openCreateProfile}
            className="size-[38px] shrink-0 rounded-xl touch-manipulation"
            aria-label="پرسنل جدید"
          >
            <Plus className="size-5" strokeWidth={2.2} />
          </Button>
        </div>

        <div className="mt-3.5 flex gap-2">
          <StaffMiniStat
            label="کل پرسنل"
            value={staff.length}
            color="var(--plum-deep)"
          />
        </div>
      </header>

      <div className="flex-1 overflow-auto px-[18px] pb-8 pt-4">
        {staff.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-muted-foreground">پرسنلی یافت نشد</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {staff.map((member) => (
              <StaffListCard
                key={member.id}
                member={member}
                currentUserId={user!.id}
                serviceCount={staffServiceCount(member, servicesList)}
                onEditPassword={() => openPassword(member)}
                onEditServices={() => openServices(member)}
                onEditSchedule={() => openSchedule(member)}
                onDelete={() => openDeleteDialog(member)}
              />
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={openCreateProfile}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-[18px] border-[1.5px] border-dashed border-line bg-transparent px-4 py-4 text-[13.5px] font-bold text-primary touch-manipulation"
        >
          <Plus className="size-[18px]" strokeWidth={2.4} />
          افزودن پرسنل جدید
        </button>
      </div>
    </div>
  )
}
