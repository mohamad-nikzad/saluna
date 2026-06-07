import { useMemo } from 'react'
import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
import { Button } from '@repo/ui/button'
import type { BusinessHours, Service, StaffSchedule, User } from '@repo/salon-core/types'

import {
  StaffActionsProvider,
  useStaffActions,
} from '#/components/staff/staff-actions-provider'
import { StaffDetailSkeleton } from '#/components/staff/staff-detail-skeleton'
import { StaffDetailView } from '#/components/staff/staff-detail-view'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '#/lib/auth'
import { servicesListQueryOptions } from '#/lib/services-queries'
import {
  staffListQueryOptions,
  staffScheduleBundleQueryOptions,
} from '#/lib/staff-queries'

export const Route = createFileRoute('/_authed/staff/$id')({
  beforeLoad: ({ context }) => {
    if (context.user.role !== 'manager') {
      throw redirect({ to: '/today' })
    }
  },
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(staffListQueryOptions()),
  component: StaffDetailPage,
  pendingComponent: StaffDetailSkeleton,
})

type ScheduleBundle = {
  schedule?: StaffSchedule[]
  businessHours?: BusinessHours
  isPending: boolean
}

function StaffDetailPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()

  const staffQuery = useQuery(staffListQueryOptions())
  const servicesQuery = useQuery(servicesListQueryOptions())
  const staff = staffQuery.data ?? []
  const servicesList = servicesQuery.data ?? []

  const member = useMemo(
    () => staff.find((item) => item.id === id) ?? null,
    [id, staff],
  )

  const isStaffRole = member?.role === 'staff'
  const scheduleQuery = useQuery({
    ...staffScheduleBundleQueryOptions(member?.id ?? ''),
    enabled: Boolean(member && isStaffRole),
  })

  if (staffQuery.isPending || servicesQuery.isPending) {
    return <StaffDetailSkeleton />
  }

  if (!member) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-muted-foreground">پرسنل یافت نشد</p>
        <Button asChild variant="outline">
          <Link to="/staff">بازگشت به فهرست</Link>
        </Button>
      </div>
    )
  }

  return (
    <StaffActionsProvider
      services={servicesList}
      onDeleteSuccess={() => {
        void navigate({ to: '/staff' })
      }}
    >
      <StaffDetailContent
        member={member}
        services={servicesList}
        scheduleBundle={{
          schedule: scheduleQuery.data?.schedule,
          businessHours: scheduleQuery.data?.businessHours,
          isPending: scheduleQuery.isPending,
        }}
      />
    </StaffActionsProvider>
  )
}

function StaffDetailContent({
  member,
  services,
  scheduleBundle,
}: {
  member: User
  services: Service[]
  scheduleBundle: ScheduleBundle
}) {
  const { user } = useAuth()
  const actions = useStaffActions()

  return (
    <StaffDetailView
      member={member}
      services={services}
      scheduleBundle={scheduleBundle}
      isSelf={member.id === user!.id}
      onOpenProfile={actions.openEditProfile}
      onOpenPassword={actions.openPassword}
      onOpenSchedule={actions.openSchedule}
      onOpenServices={actions.openServices}
      onDelete={actions.openDeleteDialog}
    />
  )
}
