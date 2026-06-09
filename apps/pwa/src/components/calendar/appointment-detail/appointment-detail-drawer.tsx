import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@repo/ui/drawer'
import type {
  User,
  Service,
  Client,
  AppointmentWithDetails,
} from '@repo/salon-core/types'
import { formatJalaliFullDate } from '@repo/salon-core/jalali'
import type { AppointmentDetailChange } from '#/lib/appointment-surface'
import { AppointmentDetailEditForm } from '#/components/calendar/appointment-detail/appointment-detail-edit-form'
import { AppointmentDetailReadView } from '#/components/calendar/appointment-detail/appointment-detail-read-view'
import { AppointmentDetailPlaceholderClient } from '#/components/calendar/appointment-detail/appointment-detail-placeholder-client'
import { AppointmentDetailDrawerFooter } from '#/components/calendar/appointment-detail/appointment-detail-drawer-footer'
import { useAppointmentDetailDrawer } from '#/components/calendar/appointment-detail/use-appointment-detail-drawer'

export type { AppointmentDetailChange } from '#/lib/appointment-surface'

interface AppointmentDetailDrawerProps {
  appointment: AppointmentWithDetails | null
  onOpenChange: (open: boolean) => void
  staff: User[]
  services: Service[]
  clients: Client[]
  onSuccess: (change: AppointmentDetailChange) => void
  onClientsChanged?: () => void
  readOnly?: boolean
  canChangeStatus?: boolean
}

export function AppointmentDetailDrawer({
  appointment,
  onOpenChange,
  staff,
  services,
  clients,
  onSuccess,
  onClientsChanged,
  readOnly = false,
  canChangeStatus = !readOnly,
}: AppointmentDetailDrawerProps) {
  const drawer = useAppointmentDetailDrawer({
    appointment,
    onOpenChange,
    staff,
    services,
    clients,
    onSuccess,
    onClientsChanged,
    readOnly,
  })

  if (!appointment) return null

  return (
    <Drawer open={!!appointment} onOpenChange={drawer.handleOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>
            {drawer.isEditingCurrentAppointment ? 'ویرایش نوبت' : 'جزئیات نوبت'}
          </DrawerTitle>
          <DrawerDescription>
            {drawer.isEditingCurrentAppointment
              ? 'جزئیات نوبت را ویرایش کنید. نوبت‌های هم‌زمان فقط با پرسنل و مشتری متفاوت نسبت به نوبت‌های هم‌پوشان مجاز است.'
              : formatJalaliFullDate(appointment.date)}
          </DrawerDescription>
        </DrawerHeader>

        {drawer.isEditingCurrentAppointment ? (
          <AppointmentDetailEditForm
            editForm={drawer.editForm}
            onSubmit={drawer.handleUpdate}
            localClients={drawer.localClients}
            onClientCreated={drawer.handleClientCreated}
            useTemporaryClient={drawer.useTemporaryClient}
            temporaryClientName={drawer.temporaryClientName}
            temporaryClientNotes={drawer.temporaryClientNotes}
            temporaryClientNameRef={drawer.temporaryClientNameRef}
            clientId={drawer.clientId}
            staffId={drawer.staffId}
            serviceId={drawer.serviceId}
            date={drawer.date}
            startTime={drawer.startTime}
            durationInput={drawer.durationInput}
            durationMinutes={drawer.durationMinutes}
            endTime={drawer.endTime}
            addonIds={drawer.addonIds}
            staffRoleOnly={drawer.staffRoleOnly}
            editableServices={drawer.editableServices}
            selectedEditService={drawer.selectedEditService}
            addonOptions={drawer.addonOptions}
            availableAddons={drawer.availableAddons}
            addonsLoading={drawer.addonsLoading}
            previewDuration={drawer.previewDuration}
            previewPrice={drawer.previewPrice}
            status={drawer.status}
            onStatusChange={drawer.setStatus}
            onTemporaryClientModeChange={drawer.handleTemporaryClientModeChange}
            onEditStaffChange={drawer.handleEditStaffChange}
            onClearEditStaff={drawer.clearEditStaff}
            onEditServiceChange={drawer.handleEditServiceChange}
            onClearEditService={drawer.clearEditService}
            onToggleAddon={drawer.toggleEditAddon}
            applyDurationInput={drawer.applyDurationInput}
            triggerEdit={drawer.triggerEdit}
            applyEndTime={drawer.applyEndTime}
          />
        ) : (
          <AppointmentDetailReadView
            appointment={appointment}
            readOnly={readOnly}
            canChangeStatus={canChangeStatus}
            statusAction={drawer.statusAction}
            isMutating={drawer.isMutating}
            onStartEditing={drawer.startEditing}
            onStatusChange={drawer.handleStatusChange}
            onOpenCompleteClient={drawer.openCompleteClientDrawer}
          />
        )}

        <AppointmentDetailDrawerFooter
          readOnly={readOnly}
          isEditing={drawer.isEditingCurrentAppointment}
          showDeleteConfirm={drawer.showDeleteConfirm}
          isMutating={drawer.isMutating}
          isEditSubmitting={drawer.isEditSubmitting}
          useTemporaryClient={drawer.useTemporaryClient}
          temporaryClientName={drawer.temporaryClientName}
          clientId={drawer.clientId}
          onSave={drawer.handleUpdate}
          onCancelEdit={drawer.cancelEditing}
          onConfirmDelete={drawer.handleDelete}
          onCancelDelete={() => drawer.setShowDeleteConfirm(false)}
          onStartEditing={drawer.startEditing}
          onShowDeleteConfirm={() => drawer.setShowDeleteConfirm(true)}
        />
      </DrawerContent>

      <AppointmentDetailPlaceholderClient
        open={drawer.showCompleteClientDrawer}
        onOpenChange={drawer.setShowCompleteClientDrawer}
        completeForm={drawer.completeForm}
        completeClientNameRef={drawer.completeClientNameRef}
        completeClientName={drawer.completeClientName}
        completeClientPhone={drawer.completeClientPhone}
        completeErrors={drawer.completeErrors}
        duplicateClient={drawer.duplicateClient}
        isPending={drawer.completePlaceholderClient.isPending}
        onSubmit={drawer.submitPlaceholderClient}
        onReassignToExisting={drawer.reassignPlaceholderClient}
      />
    </Drawer>
  )
}
