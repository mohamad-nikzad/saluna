import type {
  AppointmentWithDetails,
  Client,
  Service,
  ServicePackage,
  User,
} from '@repo/salon-core/types'

import { AppointmentDrawer } from '#/components/calendar/appointment-drawer'
import { AppointmentDetailDrawer } from '#/components/calendar/appointment-detail-drawer'
import { AvailabilityDrawer } from '#/components/calendar/availability-drawer'
import type { AppointmentDetailChange } from '#/lib/appointment-surface'

import type { useAppointmentFlow } from '#/components/appointments/use-appointment-flow'
import { useSalonUnavailableDates } from '#/lib/use-salon-unavailable-dates'

type AppointmentFlow = ReturnType<typeof useAppointmentFlow>

type AppointmentFlowDrawersProps = {
  flow: AppointmentFlow
  staff: User[]
  services: Service[]
  packages?: ServicePackage[]
  clients: Client[]
  availabilityInitialDate: string
  onAppointmentCreated: (appointment: AppointmentWithDetails) => void
  onPackageBooked?: () => void
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
  packages = [],
  clients,
  availabilityInitialDate,
  onAppointmentCreated,
  onPackageBooked,
  onDetailChange,
  onClientsChanged,
  detailReadOnly,
  canChangeStatus,
  intakeEnabled = true,
}: AppointmentFlowDrawersProps) {
  const unavailableDates = useSalonUnavailableDates()
  const { state, actions } = flow
  const {
    createIntent,
    createOpen,
    createFormRevision,
    availabilityOpen,
    detailAppointment,
  } = state

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
        unavailableDates={unavailableDates}
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
            unavailableDates={unavailableDates}
          />

          <AppointmentDrawer
            formRevision={createFormRevision}
            open={createOpen}
            onOpenChange={actions.handleCreateOpenChange}
            initialDate={createIntent.date}
            initialTime={createIntent.time}
            initialStaffId={createIntent.staffId}
            initialServiceId={createIntent.serviceId}
            initialClientId={createIntent.clientId}
            packages={packages}
            staff={staff}
            services={services}
            clients={clients}
            onSuccess={onAppointmentCreated}
            onPackageBooked={onPackageBooked}
            onClientsChanged={onClientsChanged}
            unavailableDates={unavailableDates}
          />
        </>
      ) : null}
    </>
  )
}
