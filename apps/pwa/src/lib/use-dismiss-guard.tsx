import { useCallback, useRef, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@repo/ui/alert-dialog'

interface Options {
  isDirty: boolean
  onClose: () => void
  title?: string
  description?: string
  discardLabel?: string
  cancelLabel?: string
}

export function useDismissGuard({
  isDirty,
  onClose,
  title = 'خروج بدون ذخیره؟',
  description = 'تغییراتی که ثبت نکرده‌اید از بین می‌رود.',
  discardLabel = 'بستن بدون ذخیره',
  cancelLabel = 'ادامه ویرایش',
}: Options) {
  const [open, setOpen] = useState(false)
  const isDirtyRef = useRef(isDirty)
  isDirtyRef.current = isDirty

  const requestClose = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) return
      if (isDirtyRef.current) {
        setOpen(true)
        return
      }
      onClose()
    },
    [onClose],
  )

  const confirmDialog = (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row gap-3 sm:justify-end">
          <AlertDialogCancel className="mt-0 flex-1 sm:flex-initial">
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            className="flex-1 sm:flex-initial"
            onClick={() => {
              setOpen(false)
              onClose()
            }}
          >
            {discardLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  return { requestClose, confirmDialog }
}
