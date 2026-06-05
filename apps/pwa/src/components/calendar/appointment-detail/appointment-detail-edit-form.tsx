import type { RefObject } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { Checkbox } from '@repo/ui/checkbox'
import { Input } from '@repo/ui/input'
import { Field, FieldLabel, FieldGroup, FieldError } from '@repo/ui/field'
import { FormRootError } from '@repo/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/select'
import { Spinner } from '@repo/ui/spinner'
import { APPOINTMENT_STATUS } from '@repo/salon-core/types'
import type {
  User,
  Service,
  ServiceAddon,
  Client,
} from '@repo/salon-core/types'
import { eligibleStaffForService } from '@repo/salon-core/staff-service-autofill'
import { endTimeFromDuration } from '@repo/salon-core/appointment-time'
import type { AppointmentFormInput } from '@repo/salon-core/forms/appointment'
import { ClientPicker } from '#/components/calendar/client-picker'
import { ServicePicker } from '#/components/services/service-picker'
import { StaffPicker } from '#/components/calendar/staff-picker'
import { JalaliDatePicker } from '@repo/ui/jalali-date-picker'
import { TimePicker } from '@repo/ui/time-picker'
import { toPersianDigits } from '@repo/salon-core/persian-digits'
import {
  formatTomans,
  isHistoricalAddon,
  tomansFormatter,
} from '#/lib/appointment-surface'
import { LocalizedNumberInput } from '#/components/localized-number-input'

interface AppointmentDetailEditFormProps {
  editForm: UseFormReturn<AppointmentFormInput>
  onSubmit: () => void
  localClients: Client[]
  onClientCreated: (client: Client) => void
  useTemporaryClient: boolean
  temporaryClientName: string
  temporaryClientNameRef: RefObject<HTMLInputElement | null>
  clientId: string
  staffId: string
  serviceId: string
  date: string | undefined
  startTime: string | undefined
  durationInput: string | number | undefined
  durationMinutes: number
  endTime: string | undefined
  addonIds: string[]
  staffRoleOnly: User[]
  editableServices: Service[]
  selectedEditService: Service | undefined
  addonOptions: ServiceAddon[]
  availableAddons: ServiceAddon[]
  addonsLoading: boolean
  previewDuration: number
  previewPrice: number
  status: string
  onStatusChange: (status: string) => void
  onTemporaryClientModeChange: (enabled: boolean) => void
  onEditStaffChange: (id: string) => void
  onEditServiceChange: (id: string) => void
  onToggleAddon: (addon: ServiceAddon) => void
  applyDurationInput: (value: string) => void
  triggerEdit: UseFormReturn<AppointmentFormInput>['trigger']
  applyEndTime: (et: string) => void
}

export function AppointmentDetailEditForm({
  editForm,
  onSubmit,
  localClients,
  onClientCreated,
  useTemporaryClient,
  temporaryClientName,
  temporaryClientNameRef,
  clientId,
  staffId,
  serviceId,
  date,
  startTime,
  durationInput,
  durationMinutes,
  endTime,
  addonIds,
  staffRoleOnly,
  editableServices,
  selectedEditService,
  addonOptions,
  availableAddons,
  addonsLoading,
  previewDuration,
  previewPrice,
  status,
  onStatusChange,
  onTemporaryClientModeChange,
  onEditStaffChange,
  onEditServiceChange,
  onToggleAddon,
  applyDurationInput,
  triggerEdit,
  applyEndTime,
}: AppointmentDetailEditFormProps) {
  const {
    register: registerEdit,
    setValue: setEditValue,
    watch: watchEdit,
    formState: { errors: editErrors },
  } = editForm

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4 overflow-auto px-4"
    >
      <FieldGroup>
        <Field>
          <FieldLabel>مشتری</FieldLabel>
          <div className="space-y-3">
            <label
              htmlFor="edit-temporary-client-mode"
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 bg-card px-3 py-3"
            >
              <Checkbox
                id="edit-temporary-client-mode"
                checked={useTemporaryClient}
                onCheckedChange={(checked) =>
                  onTemporaryClientModeChange(checked === true)
                }
                className="mt-0.5"
              />
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  بعداً اطلاعات مشتری را کامل می‌کنم
                </p>
                <p className="text-xs text-muted-foreground">
                  در حالت موقت فقط یک نام نمایشی نگه می‌داریم و شماره تماس بعداً
                  تکمیل می‌شود.
                </p>
              </div>
            </label>

            {useTemporaryClient ? (
              <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
                <Field className="gap-2">
                  <FieldLabel htmlFor="edit-temporary-client-name">
                    نام مشتری
                  </FieldLabel>
                  <Input
                    id="edit-temporary-client-name"
                    ref={temporaryClientNameRef}
                    value={temporaryClientName}
                    onChange={(event) =>
                      setEditValue('temporaryClientName', event.target.value, {
                        shouldDirty: true,
                        shouldValidate: false,
                      })
                    }
                    placeholder="مثلاً دوستِ سارا"
                  />
                  {editErrors.temporaryClientName && (
                    <FieldError>
                      {editErrors.temporaryClientName.message}
                    </FieldError>
                  )}
                </Field>

                <Field className="gap-2">
                  <FieldLabel htmlFor="edit-temporary-client-notes">
                    یادداشت (اختیاری)
                  </FieldLabel>
                  <Input
                    id="edit-temporary-client-notes"
                    value={watchEdit('temporaryClientNotes') ?? ''}
                    onChange={(event) =>
                      setEditValue('temporaryClientNotes', event.target.value, {
                        shouldDirty: true,
                      })
                    }
                    placeholder="مثلاً شماره را بعداً می‌گیرم"
                  />
                </Field>
              </div>
            ) : (
              <ClientPicker
                clients={localClients}
                value={clientId}
                onChange={(id) =>
                  setEditValue('clientId', id, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                onClientCreated={onClientCreated}
              />
            )}
            {editErrors.clientId && (
              <FieldError>{editErrors.clientId.message}</FieldError>
            )}
          </div>
        </Field>

        <div className="flex min-w-0 flex-col gap-7">
          <Field>
            <FieldLabel>پرسنل</FieldLabel>
            <StaffPicker
              staff={staffRoleOnly}
              value={staffId || undefined}
              onChange={onEditStaffChange}
              getStatus={(member) => {
                const serviceMismatch =
                  !!serviceId &&
                  !eligibleStaffForService([member], serviceId).length
                if (serviceMismatch)
                  return {
                    disabled: true,
                    reason: 'این خدمت را انجام نمی‌دهد',
                  }
                return undefined
              }}
            />
          </Field>

          <Field>
            <FieldLabel>خدمت</FieldLabel>
            <ServicePicker
              services={editableServices}
              value={serviceId || undefined}
              onChange={onEditServiceChange}
            />
          </Field>

          {selectedEditService ? (
            <Field>
              <FieldLabel>افزودنی‌ها</FieldLabel>
              <div className="space-y-2 rounded-lg border border-border bg-card p-3">
                {addonsLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Spinner className="size-3.5" />
                    در حال دریافت افزودنی‌ها...
                  </div>
                ) : addonOptions.length > 0 ? (
                  addonOptions.map((addon) => (
                    <label
                      key={addon.id}
                      className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-muted/60"
                    >
                      <Checkbox
                        checked={addonIds.includes(addon.id)}
                        onCheckedChange={() => onToggleAddon(addon)}
                        className="mt-0.5"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">
                          {addon.name}
                          {isHistoricalAddon(addon.id, availableAddons) ? (
                            <span className="mr-2 text-xs font-normal text-muted-foreground">
                              تاریخی
                            </span>
                          ) : null}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          +{toPersianDigits(addon.durationDelta)} دقیقه · +
                          {tomansFormatter.format(addon.priceDelta)} تومان
                        </span>
                      </span>
                    </label>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">
                    برای این خدمت افزودنی فعالی تعریف نشده است.
                  </p>
                )}
                <div className="border-t border-border/60 pt-2 text-xs text-muted-foreground">
                  جمع پیش‌نمایش: {toPersianDigits(previewDuration)} دقیقه ·{' '}
                  {formatTomans(previewPrice)}
                </div>
              </div>
            </Field>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="edit-date">تاریخ</FieldLabel>
            <JalaliDatePicker
              id="edit-date"
              value={date ?? ''}
              onChange={(value) =>
                setEditValue('date', value, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              required
            />
            {editErrors.date && (
              <FieldError>{editErrors.date.message}</FieldError>
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor="edit-time">شروع</FieldLabel>
            <TimePicker
              id="edit-time"
              value={startTime ?? ''}
              onChange={(st) => {
                setEditValue('startTime', st, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
                setEditValue(
                  'endTime',
                  endTimeFromDuration(st, durationMinutes),
                  {
                    shouldDirty: true,
                    shouldValidate: true,
                  },
                )
              }}
              label="ساعت شروع"
            />
            {editErrors.startTime && (
              <FieldError>{editErrors.startTime.message}</FieldError>
            )}
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="edit-duration">مدت (دقیقه)</FieldLabel>
          <LocalizedNumberInput
            id="edit-duration"
            value={durationInput}
            onValueChange={applyDurationInput}
            onBlur={() => {
              void triggerEdit('durationMinutes')
            }}
          />
          {editErrors.durationMinutes && (
            <FieldError>{editErrors.durationMinutes.message}</FieldError>
          )}
        </Field>

        <Field>
          <FieldLabel htmlFor="edit-end">پایان</FieldLabel>
          <TimePicker
            id="edit-end"
            value={endTime ?? ''}
            onChange={applyEndTime}
            label="ساعت پایان"
          />
          {editErrors.endTime && (
            <FieldError>{editErrors.endTime.message}</FieldError>
          )}
        </Field>

        <Field>
          <FieldLabel>وضعیت</FieldLabel>
          <Select value={status} onValueChange={onStatusChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(APPOINTMENT_STATUS).map(([key, info]) => (
                <SelectItem key={key} value={key}>
                  {info.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel htmlFor="edit-notes">توضیحات (اختیاری)</FieldLabel>
          <Input
            id="edit-notes"
            placeholder="یادداشت درباره این نوبت…"
            {...registerEdit('notes')}
          />
        </Field>

        <FormRootError message={editErrors.root?.message} />
      </FieldGroup>
    </form>
  )
}
