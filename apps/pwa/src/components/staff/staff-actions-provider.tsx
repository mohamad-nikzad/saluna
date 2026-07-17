import { createContext, use, useMemo } from 'react'
import type { Service, User } from '@repo/salon-core/types'

import { StaffDeleteDialog } from '#/components/staff/staff-delete-dialog'
import { StaffDrawer } from '#/components/staff/staff-drawer'
import { StaffScheduleDrawer } from '#/components/staff/staff-schedule-drawer'
import { StaffServicesDrawer } from '#/components/staff/staff-services-drawer'
import { useStaffPageController } from '#/components/staff/use-staff-page-controller'

interface StaffActionsContextValue {
  services: Service[]
  openCreateProfile: () => void
  openEditProfile: (member: User) => void
  openServices: (member: User) => void
  openSchedule: (member: User) => void
  openDeleteDialog: (member: User) => void
}

const StaffActionsContext = createContext<StaffActionsContextValue | null>(null)

interface StaffActionsProviderProps {
  children: React.ReactNode
  services: Service[]
  onDeleteSuccess?: (staff: User) => void
}

export function StaffActionsProvider({
  children,
  services,
  onDeleteSuccess,
}: StaffActionsProviderProps) {
  const controller = useStaffPageController({ onDeleteSuccess })

  const value = useMemo(
    () => ({
      services,
      openCreateProfile: controller.openCreateProfile,
      openEditProfile: controller.openEditProfile,
      openServices: controller.openServices,
      openSchedule: controller.openSchedule,
      openDeleteDialog: controller.openDeleteDialog,
    }),
    [
      services,
      controller.openCreateProfile,
      controller.openEditProfile,
      controller.openServices,
      controller.openSchedule,
      controller.openDeleteDialog,
    ],
  )

  return (
    <StaffActionsContext value={value}>
      {children}
      <StaffActionsDrawers controller={controller} services={services} />
    </StaffActionsContext>
  )
}

export function useStaffActions() {
  const value = use(StaffActionsContext)
  if (!value) {
    throw new Error('useStaffActions must be used within StaffActionsProvider')
  }
  return value
}

type StaffPageController = ReturnType<typeof useStaffPageController>

function StaffActionsDrawers({
  controller,
  services,
}: {
  controller: StaffPageController
  services: Service[]
}) {
  return (
    <>
      <StaffDrawer
        open={controller.profileOpen}
        onOpenChange={(open) => {
          controller.setProfileOpen(open)
          if (!open) controller.setProfileStaff(null)
        }}
        staff={controller.profileStaff}
        onSuccess={controller.handleProfileSuccess}
      />

      <StaffServicesDrawer
        open={!!controller.servicesStaff}
        onOpenChange={(open) => !open && controller.setServicesStaff(null)}
        staff={controller.servicesStaff}
        services={services}
        onSuccess={controller.handleServicesSuccess}
      />

      <StaffScheduleDrawer
        open={!!controller.scheduleStaff}
        onOpenChange={(open) => !open && controller.setScheduleStaff(null)}
        staff={controller.scheduleStaff}
        onSuccess={controller.handleScheduleSuccess}
      />

      <StaffDeleteDialog
        open={!!controller.deletingStaff}
        staff={controller.deletingStaff}
        isPending={controller.deleteStaffIsPending}
        onOpenChange={(open) => {
          if (!open && !controller.deleteStaffIsPending) {
            controller.setDeletingStaff(null)
          }
        }}
        onConfirm={controller.confirmDelete}
      />
    </>
  )
}
