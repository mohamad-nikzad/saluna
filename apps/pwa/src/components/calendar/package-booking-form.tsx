import { useEffect, useMemo, useState } from 'react'
import { PackageCheck, Plus } from 'lucide-react'
import { Button } from '@repo/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@repo/ui/field'
import { FormRootError } from '@repo/ui/form'
import { Spinner } from '@repo/ui/spinner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/select'
import { Textarea } from '@repo/ui/textarea'
import { JalaliDatePicker } from '@repo/ui/jalali-date-picker'
import { TimePicker } from '@repo/ui/time-picker'
import { toPersianDigits } from '@repo/salon-core/persian-digits'
import { endTimeFromDuration } from '@repo/salon-core/appointment-time'
import type { Client, ServicePackage, User } from '@repo/salon-core/types'

import { FormSheetBody, FormSheetFooter } from '#/components/form-sheet'
import { ClientPicker } from '#/components/calendar/client-picker'
import { StaffPicker } from '#/components/calendar/staff-picker'
import { tomansFormatter } from '#/lib/appointment-surface'
import { useCreateServicePackageBookingMutation } from '#/lib/appointments-queries'

type PackageTaskDraft = {
  packageComponentId: string
  staffId: string
  startTime: string
  endTime: string
}

type PackageBookingFormProps = {
  active: boolean
  initialDate: string
  initialTime: string
  packages: ServicePackage[]
  staff: User[]
  clients: Client[]
  onSuccess: () => void
  onCancel: () => void
  onClientsChanged?: () => void
}

function firstActivePackage(packages: ServicePackage[]) {
  return packages.find((item) => item.active && item.components.length > 0)
}

function buildTasks(pkg: ServicePackage | undefined, startTime: string) {
  let cursor = startTime
  return (pkg?.components ?? []).map((component) => {
    const endTime = endTimeFromDuration(cursor, component.service.duration)
    const task: PackageTaskDraft = {
      packageComponentId: component.id,
      staffId: '',
      startTime: cursor,
      endTime,
    }
    cursor = endTime
    return task
  })
}

export function PackageBookingForm({
  active,
  initialDate,
  initialTime,
  packages,
  staff,
  clients,
  onSuccess,
  onCancel,
  onClientsChanged,
}: PackageBookingFormProps) {
  const activePackages = useMemo(
    () => packages.filter((item) => item.active && item.components.length > 0),
    [packages],
  )
  const [packageId, setPackageId] = useState('')
  const [clientId, setClientId] = useState('')
  const [date, setDate] = useState(initialDate)
  const [notes, setNotes] = useState('')
  const [tasks, setTasks] = useState<PackageTaskDraft[]>([])
  const [rootError, setRootError] = useState<string | null>(null)
  const createBooking = useCreateServicePackageBookingMutation()

  const selectedPackage = useMemo(
    () => activePackages.find((item) => item.id === packageId),
    [activePackages, packageId],
  )
  const componentsById = useMemo(
    () =>
      new Map(
        (selectedPackage?.components ?? []).map((component) => [
          component.id,
          component,
        ]),
      ),
    [selectedPackage],
  )

  useEffect(() => {
    if (!active) return
    const nextPackage = firstActivePackage(activePackages)
    setPackageId(nextPackage?.id ?? '')
    setClientId('')
    setDate(initialDate)
    setNotes('')
    setRootError(null)
    setTasks(buildTasks(nextPackage, initialTime))
  }, [active, activePackages, initialDate, initialTime])

  const handlePackageChange = (nextPackageId: string) => {
    const nextPackage = activePackages.find((item) => item.id === nextPackageId)
    setPackageId(nextPackageId)
    setTasks(buildTasks(nextPackage, initialTime))
  }

  const updateTask = (
    packageComponentId: string,
    patch: Partial<PackageTaskDraft>,
  ) => {
    setTasks((current) =>
      current.map((task) =>
        task.packageComponentId === packageComponentId
          ? { ...task, ...patch }
          : task,
      ),
    )
  }

  const fillTaskStaff = (staffId: string) => {
    setTasks((current) => current.map((task) => ({ ...task, staffId })))
  }

  const handleSubmit = async () => {
    setRootError(null)
    if (!selectedPackage) {
      setRootError('پکیج را انتخاب کنید')
      return
    }
    if (!clientId) {
      setRootError('مشتری را انتخاب کنید')
      return
    }
    if (tasks.some((task) => !task.staffId)) {
      setRootError('برای همه خدمات پکیج پرسنل انتخاب کنید')
      return
    }

    try {
      await createBooking.mutateAsync({
        packageId: selectedPackage.id,
        values: {
          clientId,
          date,
          notes: notes.trim() || undefined,
          tasks: tasks.map((task) => ({
            packageComponentId: task.packageComponentId,
            staffId: task.staffId,
            startTime: task.startTime,
            endTime: task.endTime,
          })),
        },
      })
      onSuccess()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ثبت پکیج کامل نشد'
      setRootError(message)
    }
  }

  return (
    <>
      <FormSheetBody className="px-5 py-4">
        <FieldGroup className="gap-5">
          <Field>
            <FieldLabel>پکیج</FieldLabel>
            <Select value={packageId} onValueChange={handlePackageChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="انتخاب پکیج" />
              </SelectTrigger>
              <SelectContent>
                {activePackages.map((pkg) => (
                  <SelectItem key={pkg.id} value={pkg.id}>
                    {pkg.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedPackage ? (
              <p className="text-xs leading-6 text-muted-foreground">
                {toPersianDigits(selectedPackage.components.length)} خدمت ·{' '}
                {toPersianDigits(selectedPackage.totalDuration)} دقیقه ·{' '}
                {tomansFormatter.format(selectedPackage.resolvedPrice)} تومان
              </p>
            ) : null}
          </Field>

          <Field>
            <FieldLabel>مشتری</FieldLabel>
            <ClientPicker
              clients={clients}
              value={clientId}
              onChange={setClientId}
              onClientCreated={(client) => {
                setClientId(client.id)
                onClientsChanged?.()
              }}
              hostActive={active}
            />
          </Field>

          <Field>
            <FieldLabel>تاریخ</FieldLabel>
            <JalaliDatePicker value={date} onChange={setDate} />
          </Field>

          {staff.length > 0 ? (
            <Field>
              <FieldLabel>انتخاب سریع پرسنل</FieldLabel>
              <StaffPicker
                staff={staff}
                value=""
                onChange={fillTaskStaff}
                placeholder="برای همه خدمات یک پرسنل بگذارید"
              />
            </Field>
          ) : null}

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-foreground">
                خدمات داخل پکیج
              </h3>
              <PackageCheck className="size-4 text-muted-foreground" />
            </div>

            {tasks.map((task, index) => {
              const component = componentsById.get(task.packageComponentId)
              if (!component) return null
              return (
                <div
                  key={task.packageComponentId}
                  className="rounded-lg border border-border/70 bg-background/60 p-3"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-foreground">
                        {toPersianDigits(index + 1)}. {component.service.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {toPersianDigits(component.service.duration)} دقیقه
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[1fr_8rem_8rem]">
                    <Field>
                      <FieldLabel>پرسنل</FieldLabel>
                      <StaffPicker
                        staff={staff}
                        value={task.staffId}
                        onChange={(staffId) =>
                          updateTask(task.packageComponentId, { staffId })
                        }
                        onClear={() =>
                          updateTask(task.packageComponentId, { staffId: '' })
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel>شروع</FieldLabel>
                      <TimePicker
                        value={task.startTime}
                        onChange={(startTime) =>
                          updateTask(task.packageComponentId, { startTime })
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel>پایان</FieldLabel>
                      <TimePicker
                        value={task.endTime}
                        onChange={(endTime) =>
                          updateTask(task.packageComponentId, { endTime })
                        }
                      />
                    </Field>
                  </div>
                </div>
              )
            })}
          </div>

          <Field>
            <FieldLabel>یادداشت</FieldLabel>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="اختیاری"
            />
          </Field>

          {rootError ? (
            <FormRootError>
              <FieldError>{rootError}</FieldError>
            </FormRootError>
          ) : null}
        </FieldGroup>
      </FormSheetBody>

      <FormSheetFooter className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={
            createBooking.isPending ||
            !selectedPackage ||
            !clientId ||
            tasks.length === 0
          }
          className="min-h-11 rounded-xl"
        >
          {createBooking.isPending ? (
            <Spinner className="ml-2 size-4" />
          ) : (
            <Plus className="ml-2 size-4" />
          )}
          ثبت پکیج
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 rounded-xl"
          onClick={onCancel}
        >
          انصراف
        </Button>
      </FormSheetFooter>
    </>
  )
}
