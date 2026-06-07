import { useEffect, useState } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '@repo/ui/drawer'
import { Button } from '@repo/ui/button'
import { Switch } from '@repo/ui/switch'
import { Field, FieldLabel, FieldError } from '@repo/ui/field'
import { Skeleton } from '@repo/ui/skeleton'
import { TimePicker } from '@repo/ui/time-picker'
import { Spinner } from '@repo/ui/spinner'
import type { BusinessHours, User } from '@repo/salon-core/types'
import { formatPersianTime } from '@repo/salon-core/persian-digits'
import { z } from 'zod'
import { staffScheduleSchema } from '@repo/salon-core/forms/staff'
import { useQuery } from '@tanstack/react-query'
import {
  staffScheduleBundleQueryOptions,
  useUpdateStaffScheduleMutation,
} from '#/lib/staff-queries'
import { useDismissGuard } from '#/lib/use-dismiss-guard'
import {
  defaultScheduleRows,
  mergeSavedScheduleRows,
  STAFF_SCHEDULE_DAYS,
} from '#/components/staff/staff-schedule'

const scheduleFormSchema = z.object({ rows: staffScheduleSchema })
type ScheduleFormValues = z.input<typeof scheduleFormSchema>

interface StaffScheduleDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  staff: User | null
  onSuccess: () => void
}

function StaffScheduleRowsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border/60 p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-6 w-10 rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function StaffScheduleDrawer({
  open,
  onOpenChange,
  staff,
  onSuccess,
}: StaffScheduleDrawerProps) {
  const [salonHours, setSalonHours] = useState<BusinessHours | null>(null)
  const bundleQuery = useQuery({
    ...staffScheduleBundleQueryOptions(staff?.id ?? ''),
    enabled: open && !!staff?.id,
  })
  const bundleLoading = bundleQuery.isPending

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleFormSchema),
    defaultValues: { rows: defaultScheduleRows() },
    mode: 'onSubmit',
  })

  const { fields } = useFieldArray({ control, name: 'rows' })

  useEffect(() => {
    if (!open || !staff) return
    reset({ rows: defaultScheduleRows() })
    const bundle = bundleQuery.data
    if (!bundle) return
    setSalonHours(bundle.businessHours)
    reset({
      rows: mergeSavedScheduleRows(bundle.schedule, bundle.businessHours),
    })
  }, [bundleQuery.data, open, reset, staff])

  const useSalonHours = () => {
    if (!salonHours) return
    const current = getValues('rows')
    current.forEach((_, idx) => {
      setValue(`rows.${idx}.workingStart`, salonHours.workingStart, {
        shouldDirty: true,
      })
      setValue(`rows.${idx}.workingEnd`, salonHours.workingEnd, {
        shouldDirty: true,
      })
    })
  }

  const saveSchedule = useUpdateStaffScheduleMutation(staff?.id ?? '')

  const onSubmit = handleSubmit(async ({ rows }) => {
    if (!staff) return
    try {
      await saveSchedule.mutateAsync(rows)
      onSuccess()
    } catch {
      // Toast handled by mutation cache.
    }
  })

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

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>برنامه کاری {staff?.name ?? ''}</DrawerTitle>
          <DrawerDescription>
            برای هر روز، فعال بودن و بازه کاری پرسنل را مشخص کنید.
          </DrawerDescription>
        </DrawerHeader>

        <form onSubmit={onSubmit} className="space-y-3 overflow-auto p-4">
          <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
            <div className="text-sm">
              <p className="font-medium">ساعت سالن</p>
              <p className="text-xs text-muted-foreground" dir="ltr">
                {formatPersianTime(salonHours?.workingStart ?? '09:00')} -{' '}
                {formatPersianTime(salonHours?.workingEnd ?? '19:00')}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={useSalonHours}
            >
              استفاده برای همه
            </Button>
          </div>

          {bundleLoading ? (
            <StaffScheduleRowsSkeleton />
          ) : (
            fields.map((field, idx) => {
              const label = STAFF_SCHEDULE_DAYS.find(
                (day) => day.dayOfWeek === field.dayOfWeek,
              )?.label
              const rowError = errors.rows?.[idx]
              return (
                <div
                  key={field.id}
                  className="rounded-lg border border-border/60 p-3"
                >
                  <Controller
                    control={control}
                    name={`rows.${idx}.active`}
                    render={({ field: activeField }) => (
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{label}</p>
                          <p className="text-xs text-muted-foreground">
                            {activeField.value
                              ? 'قابل رزرو'
                              : 'تعطیل برای این پرسنل'}
                          </p>
                        </div>
                        <Switch
                          checked={activeField.value}
                          onCheckedChange={activeField.onChange}
                        />
                      </div>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <Field>
                      <FieldLabel>شروع</FieldLabel>
                      <Controller
                        control={control}
                        name={`rows.${idx}.workingStart`}
                        render={({ field: timeField }) => (
                          <TimePicker
                            value={timeField.value}
                            onChange={timeField.onChange}
                            label={`${label} شروع`}
                          />
                        )}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>پایان</FieldLabel>
                      <Controller
                        control={control}
                        name={`rows.${idx}.workingEnd`}
                        render={({ field: timeField }) => (
                          <TimePicker
                            value={timeField.value}
                            onChange={timeField.onChange}
                            label={`${label} پایان`}
                          />
                        )}
                      />
                      {rowError?.workingEnd && (
                        <FieldError>{rowError.workingEnd.message}</FieldError>
                      )}
                    </Field>
                  </div>
                </div>
              )
            })
          )}
        </form>

        <DrawerFooter>
          <Button onClick={onSubmit} disabled={isSubmitting || bundleLoading}>
            {isSubmitting && <Spinner className="ml-2" />}
            {isSubmitting ? 'در حال ذخیره…' : 'ذخیره برنامه کاری'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => requestClose(false)}
          >
            بستن
          </Button>
        </DrawerFooter>
      </DrawerContent>
      {confirmDialog}
    </Drawer>
  )
}
