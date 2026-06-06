import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
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
import { Input } from '@repo/ui/input'
import { Field, FieldLabel, FieldGroup, FieldError } from '@repo/ui/field'
import { Badge } from '@repo/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/select'
import { Spinner } from '@repo/ui/spinner'
import { STAFF_COLORS } from '@repo/salon-core/types'
import type { User } from '@repo/salon-core/types'
import { normalizeCalendarColorId } from '@repo/salon-core/calendar-colors'
import { displayPhone, normalizePhone } from '@repo/salon-core/phone'
import {
  staffCreateSchema,
  staffUpdateSchema,
} from '@repo/salon-core/forms/staff'
import type {
  StaffCreateFormInput,
  StaffUpdateFormInput,
} from '@repo/salon-core/forms/staff'
import { DataClientHttpError } from '@repo/data-client'
import { api } from '#/lib/api-client'
import { useManagerWriteMutation } from '#/lib/use-manager-mutation'
import { PasswordInput } from '#/components/password-input'
import { cn } from '@repo/ui/utils'

interface StaffDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  roleLocked?: 'staff' | 'manager'
  staff?: User | null
}

type StaffFormValues = StaffCreateFormInput & StaffUpdateFormInput

function emptyValues(roleLocked?: 'staff' | 'manager'): StaffFormValues {
  return {
    name: '',
    nickname: '',
    phone: '',
    password: '',
    role: roleLocked ?? 'staff',
    color: STAFF_COLORS[0],
  }
}

function valuesForStaff(
  staff: User,
  roleLocked?: 'staff' | 'manager',
): StaffFormValues {
  return {
    name: staff.fullName ?? staff.name,
    nickname: staff.nickname ?? '',
    phone: staff.phone,
    password: '',
    role: roleLocked ?? staff.role,
    color: normalizeCalendarColorId(staff.color),
  }
}

export function StaffDrawer({
  open,
  onOpenChange,
  onSuccess,
  roleLocked,
  staff,
}: StaffDrawerProps) {
  const editing = Boolean(staff)
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<StaffFormValues>({
    resolver: zodResolver(
      editing ? staffUpdateSchema : staffCreateSchema,
    ) as Resolver<StaffFormValues>,
    defaultValues: emptyValues(roleLocked),
    mode: 'onSubmit',
  })

  useEffect(() => {
    if (!open) return
    reset(staff ? valuesForStaff(staff, roleLocked) : emptyValues(roleLocked))
  }, [open, roleLocked, reset, staff])

  const nameValue = watch('name')
  const phoneValue = watch('phone')
  const passwordValue = watch('password')
  const colorValue = normalizeCalendarColorId(watch('color'))

  const { requestClose, confirmDialog } = useDismissGuard({
    isDirty: isDirty && !isSubmitting,
    onClose: () => onOpenChange(false),
  })

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      onOpenChange(true)
      return
    }
    requestClose(false)
  }

  const createStaff = useManagerWriteMutation('staff.create', {
    apiFn: async (values: StaffCreateFormInput) => {
      try {
        await api.staff.create({
          ...values,
          role: roleLocked ?? values.role ?? 'staff',
        })
      } catch (error) {
        if (error instanceof Error) {
          throw new DataClientHttpError(
            error.message || 'افزودن پرسنل انجام نشد',
            0,
            null,
          )
        }
        throw error
      }
    },
    meta: { errorMessage: 'افزودن پرسنل انجام نشد' },
  })

  const updateStaff = useManagerWriteMutation('staff.update', {
    apiFn: async (values: StaffFormValues) => {
      if (!staff) return
      try {
        await api.staff.update(staff.id, {
          name: values.name,
          nickname: values.nickname ?? null,
          phone: values.phone,
          role: roleLocked ?? values.role,
          color: normalizeCalendarColorId(values.color),
        })
      } catch (error) {
        if (error instanceof Error) {
          throw new DataClientHttpError(
            error.message || 'ذخیره اطلاعات انجام نشد',
            0,
            null,
          )
        }
        throw error
      }
    },
    meta: { errorMessage: 'ذخیره اطلاعات انجام نشد' },
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (staff) {
        await updateStaff.mutateAsync(values)
      } else {
        await createStaff.mutateAsync(values)
      }
      onSuccess()
    } catch {
      // Toast handled by mutation cache.
    }
  })

  return (
    <FormSheet open={open} onOpenChange={handleOpenChange}>
      <FormSheetContent onRequestClose={() => requestClose(false)}>
        <FormSheetHeader>
          <FormSheetTitle>{staff ? 'ویرایش عضو' : 'پرسنل جدید'}</FormSheetTitle>
          <FormSheetDescription>
            {staff
              ? 'اطلاعات نمایش، ورود و نقش عضو را به‌روزرسانی کنید'
              : 'عضو جدیدی به تیم سالن اضافه کنید'}
          </FormSheetDescription>
        </FormSheetHeader>

        <form
          onSubmit={onSubmit}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4"
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="staff-name">نام و نام خانوادگی</FieldLabel>
              <Input
                id="staff-name"
                placeholder="مثال: نرگس کاظمی"
                {...register('name')}
              />
              {errors.name && <FieldError>{errors.name.message}</FieldError>}
            </Field>

            <Field>
              <FieldLabel htmlFor="staff-nickname">نام نمایشی</FieldLabel>
              <Input
                id="staff-nickname"
                placeholder="مثال: سارا رنگ"
                {...register('nickname')}
              />
              <p className="text-xs text-muted-foreground">
                در تقویم و انتخاب پرسنل از این نام کوتاه استفاده می‌شود.
              </p>
              {errors.nickname && (
                <FieldError>{errors.nickname.message}</FieldError>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="staff-phone">شماره موبایل</FieldLabel>
              <Controller
                control={control}
                name="phone"
                render={({ field }) => (
                  <Input
                    id="staff-phone"
                    type="tel"
                    value={displayPhone(field.value)}
                    onChange={(e) =>
                      field.onChange(normalizePhone(e.target.value))
                    }
                    onBlur={field.onBlur}
                    placeholder="۰۹۱۲…"
                    dir="ltr"
                    className="text-left tabular-nums"
                  />
                )}
              />
              {errors.phone && <FieldError>{errors.phone.message}</FieldError>}
            </Field>

            {!staff ? (
              <Field>
                <FieldLabel htmlFor="staff-password">رمز عبور</FieldLabel>
                <PasswordInput
                  id="staff-password"
                  placeholder="رمز ورود به سیستم"
                  {...register('password')}
                />
                {errors.password && (
                  <FieldError>{errors.password.message}</FieldError>
                )}
              </Field>
            ) : null}

            {roleLocked ? (
              <Field>
                <FieldLabel>نقش</FieldLabel>
                <Input
                  value={roleLocked === 'staff' ? 'پرسنل' : 'مدیر'}
                  disabled
                />
              </Field>
            ) : (
              <Field>
                <FieldLabel>نقش</FieldLabel>
                <Controller
                  control={control}
                  name="role"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(v) => field.onChange(v)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="staff">پرسنل</SelectItem>
                        <SelectItem value="manager">مدیر</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            )}

            <Field>
              <FieldLabel>رنگ تقویم</FieldLabel>
              <Controller
                control={control}
                name="color"
                render={({ field }) => (
                  <div className="flex flex-wrap gap-2">
                    {STAFF_COLORS.map((color) => {
                      const normalized = normalizeCalendarColorId(color)
                      const selected = colorValue === normalized
                      const colorVar = `var(--calendar-${normalized})`
                      return (
                        <button
                          key={color}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => field.onChange(normalized)}
                          className={cn(
                            'flex h-10 items-center gap-2 rounded-full border px-2.5 text-xs font-medium transition-colors',
                            selected
                              ? 'border-foreground bg-muted'
                              : 'border-border bg-background',
                          )}
                        >
                          <span
                            className="size-5 rounded-full"
                            style={{ backgroundColor: colorVar }}
                          />
                          {selected ? (
                            <Badge variant="secondary">فعال</Badge>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                )}
              />
              {errors.color && <FieldError>{errors.color.message}</FieldError>}
            </Field>
          </FieldGroup>
        </form>

        <FormSheetFooter>
          <Button
            onClick={onSubmit}
            disabled={
              isSubmitting ||
              !nameValue ||
              !phoneValue ||
              (!staff && !passwordValue)
            }
            className="touch-manipulation"
          >
            {isSubmitting && <Spinner className="ml-2" />}
            {isSubmitting
              ? staff
                ? 'در حال ذخیره…'
                : 'در حال افزودن…'
              : staff
                ? 'ذخیره تغییرات'
                : 'افزودن پرسنل'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => requestClose(false)}
            disabled={isSubmitting}
          >
            انصراف
          </Button>
        </FormSheetFooter>
      </FormSheetContent>
      {confirmDialog}
    </FormSheet>
  )
}
