import { DrawerFooter, DrawerClose } from '@repo/ui/drawer'
import { Button } from '@repo/ui/button'
import { Spinner } from '@repo/ui/spinner'
import { Trash2 } from 'lucide-react'

interface AppointmentDetailDrawerFooterProps {
  readOnly: boolean
  isEditing: boolean
  showDeleteConfirm: boolean
  deletingCompletedAppointment: boolean
  isMutating: boolean
  isEditSubmitting: boolean
  useTemporaryClient: boolean
  temporaryClientName: string
  clientId: string
  onSave: () => void
  onCancelEdit: () => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
  onStartEditing: () => void
  onShowDeleteConfirm: () => void
}

export function AppointmentDetailDrawerFooter({
  readOnly,
  isEditing,
  showDeleteConfirm,
  deletingCompletedAppointment,
  isMutating,
  isEditSubmitting,
  useTemporaryClient,
  temporaryClientName,
  clientId,
  onSave,
  onCancelEdit,
  onConfirmDelete,
  onCancelDelete,
  onStartEditing,
  onShowDeleteConfirm,
}: AppointmentDetailDrawerFooterProps) {
  return (
    <DrawerFooter>
      {readOnly ? (
        <DrawerClose asChild>
          <Button variant="outline" className="w-full">
            بستن
          </Button>
        </DrawerClose>
      ) : isEditing ? (
        <>
          <Button
            onClick={onSave}
            disabled={
              isMutating ||
              isEditSubmitting ||
              (useTemporaryClient ? !temporaryClientName.trim() : !clientId)
            }
          >
            {(isMutating || isEditSubmitting) && <Spinner className="mr-2" />}
            {isMutating || isEditSubmitting ? 'در حال ذخیره…' : 'ذخیره تغییرات'}
          </Button>
          <Button variant="outline" onClick={onCancelEdit}>
            انصراف
          </Button>
        </>
      ) : showDeleteConfirm ? (
        <>
          <p className="text-sm text-center text-muted-foreground mb-2">
            {deletingCompletedAppointment
              ? 'این نوبت انجام‌شده و سابقه کمیسیون وابسته به آن برای همیشه حذف می‌شود. مطمئن هستید؟'
              : 'آیا از حذف این نوبت مطمئن هستید؟'}
          </p>
          <Button
            variant="destructive"
            onClick={onConfirmDelete}
            disabled={isMutating}
          >
            {isMutating && <Spinner className="mr-2" />}
            بله، حذف شود
          </Button>
          <Button variant="outline" onClick={onCancelDelete}>
            انصراف
          </Button>
        </>
      ) : (
        <>
          <Button onClick={onStartEditing} className="touch-manipulation">
            ویرایش نوبت
          </Button>
          <div className="flex gap-2">
            <DrawerClose asChild>
              <Button variant="outline" className="flex-1">
                بستن
              </Button>
            </DrawerClose>
            <Button
              variant="outline"
              size="icon"
              className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={onShowDeleteConfirm}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </DrawerFooter>
  )
}
