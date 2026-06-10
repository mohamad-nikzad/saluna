import type {
  AppointmentWithDetails,
  Client,
  Service,
  User,
} from '@repo/salon-core/types'

import { AppointmentDrawer } from '#/components/calendar/appointment-drawer'
import { AppointmentDetailDrawer } from '#/components/calendar/appointment-detail-drawer'
import { AvailabilityDrawer } from '#/components/calendar/availability-drawer'
import type { AppointmentDetailChange } from '#/lib/appointment-surface'

import type { useAppointmentFlow } from '#/components/appointments/use-appointment-flow'

type AppointmentFlow = ReturnType<typeof useAppointmentFlow>

type AppointmentFlowDrawersProps = {
  flow: AppointmentFlow
  staff: User[]
  services: Service[]
  clients: Client[]
  availabilityInitialDate: string
  onAppointmentCreated: (appointment: AppointmentWithDetails) => void
  onDetailChange: (change: AppointmentDetailChange) => void
  onClientsChanged?: () => void
  detailReadOnly?: boolean
  canChangeStatus?: boolean
  intakeEnabled?: boolean
}

export function AppointmentFlowDrawers({
  flow,
  staff,
  services,
  clients,
  availabilityInitialDate,
  onAppointmentCreated,
  onDetailChange,
  onClientsChanged,
  detailReadOnly,
  canChangeStatus,
  intakeEnabled = true,
}: AppointmentFlowDrawersProps) {
  const { state, actions } = flow
  const { createIntent, createOpen, availabilityOpen, detailAppointment } =
    state

  return (
    <>
      <AppointmentDetailDrawer
        appointment={detailAppointment}
        onOpenChange={(open) => {
          if (!open) actions.closeDetail()
        }}
        staff={staff}
        services={services}
        clients={clients}
        onSuccess={onDetailChange}
        onClientsChanged={onClientsChanged}
        readOnly={detailReadOnly}
        canChangeStatus={canChangeStatus}
      />

      {intakeEnabled ? (
        <>
          <AvailabilityDrawer
            open={availabilityOpen}
            onOpenChange={actions.setAvailabilityOpen}
            initialDate={availabilityInitialDate}
            staff={staff}
            services={services}
            onSelectSlot={actions.openCreateFromAvailability}
          />

          <AppointmentDrawer
            open={createOpen}
            onOpenChange={actions.handleCreateOpenChange}
            initialDate={createIntent.date}
            initialTime={createIntent.time}
            initialStaffId={createIntent.staffId}
            initialServiceId={createIntent.serviceId}
            initialClientId={createIntent.clientId}
            staff={staff}
            services={services}
            clients={clients}
            onSuccess={onAppointmentCreated}
            onClientsChanged={onClientsChanged}
          />
        </>
      ) : null}
    </>
  )
}
