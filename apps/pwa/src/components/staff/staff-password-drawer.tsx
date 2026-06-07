import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import type { Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  FormSheet,
  FormSheetContent,
  FormSheetHeader,
  FormSheetTitle,
  FormSheetDescription,
  FormSheetFooter,
} from '#/components/form-sheet'
import { useDismissGuard } from '#/lib/use-dismiss-guard'
import { Button } from '@repo/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@repo/ui/field'
import { Spinner } from '@repo/ui/spinner'
import type { User } from '@repo/salon-core/types'
import {
  staffPasswordUpdateSchema,
  type StaffPasswordUpdateInput,
} from '@repo/salon-core/forms/staff'
import { useUpdateStaffPasswordMutation } from '#/lib/staff-queries'
import { PasswordInput } from '#/components/password-input'

interface StaffPasswordDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  staff?: User | null
}

const emptyValues: StaffPasswordUpdateInput = {
  password: '',
  confirmPassword: '',
}

export function StaffPasswordDrawer({
  open,
  onOpenChange,
  onSuccess,
  staff,
}: StaffPasswordDrawerProps) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<StaffPasswordUpdateInput>({
    resolver: zodResolver(
      staffPasswordUpdateSchema,
    ) as Resolver<StaffPasswordUpdateInput>,
    defaultValues: emptyValues,
    mode: 'onSubmit',
  })

  useEffect(() => {
    if (open) reset(emptyValues)
  }, [open, reset, staff?.id])

  const password = watch('password')
  const confirmPassword = watch('confirmPassword')

  const updatePassword = useUpdateStaffPasswordMutation(staff?.id ?? '')

  const { requestClose, confirmDialog } = useDismissGuard({
    isDirty: isDirty && !updatePassword.isPending,
    onClose: () => onOpenChange(false),
  })

  const onSubmit = handleSubmit(async (values) => {
    if (!staff) return
    try {
      await updatePassword.mutateAsync({ password: values.password })
      onSuccess()
    } catch {
      // Toast and field errors are handled by form/mutation layers.
    }
  })

  return (
    <FormSheet
      open={open}
      onOpenChange={(isOpen) => {
        if (isOpen) {
          onOpenChange(true)
          return
        }
        requestClose(false)
      }}
    >
      <FormSheetContent onRequestClose={() => requestClose(false)}>
        <FormSheetHeader>
          <FormSheetTitle>تغییر رمز عبور</FormSheetTitle>
          <FormSheetDescription>
            {staff ? `رمز ورود ${staff.name} را به‌روزرسانی کنید` : null}
          </FormSheetDescription>
        </FormSheetHeader>

        <form
          onSubmit={onSubmit}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4"
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="staff-new-password">
                رمز عبور جدید
              </FieldLabel>
              <PasswordInput
                id="staff-new-password"
                placeholder="حداقل ۸ کاراکتر"
                {...register('password')}
              />
              {errors.password && (
                <FieldError>{errors.password.message}</FieldError>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="staff-new-confirm-password">
                تکرار رمز عبور جدید
              </FieldLabel>
              <PasswordInput
                id="staff-new-confirm-password"
                placeholder="تکرار رمز جدید"
                {...register('confirmPassword')}
              />
              {errors.confirmPassword && (
                <FieldError>{errors.confirmPassword.message}</FieldError>
              )}
            </Field>
          </FieldGroup>
        </form>

        <FormSheetFooter>
          <Button
            onClick={onSubmit}
            disabled={updatePassword.isPending || !password || !confirmPassword}
            className="touch-manipulation"
          >
            {updatePassword.isPending && <Spinner className="ml-2" />}
            {updatePassword.isPending ? 'در حال ذخیره…' : 'تغییر رمز عبور'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => requestClose(false)}
            disabled={updatePassword.isPending}
          >
            انصراف
          </Button>
        </FormSheetFooter>
      </FormSheetContent>
      {confirmDialog}
    </FormSheet>
  )
}
