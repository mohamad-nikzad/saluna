import type {
  AdminSetupSalonConfigurationResponse,
  AdminSetupSalonHoursPatchRequest,
  AdminSetupSalonPresencePatchRequest,
} from '@repo/api-client/types'
import { Save } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'

import { FormField, TextAreaField } from '#/components/admin/form-field'
import { LiveDataWarning } from '#/components/admin/live-data-warning'
import { MutationError } from '#/components/admin/mutation-error'
import { Button } from '#/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'

import { Panel } from '#/components/admin/panel'
import { SalonLocationFields } from '#/components/admin/salon-location-fields'
import type { MutationSubmitOptions } from './salon-governance'

const WEEKDAYS = [
  { value: '0', label: 'ش' },
  { value: '1', label: 'ی' },
  { value: '2', label: 'د' },
  { value: '3', label: 'س' },
  { value: '4', label: 'چ' },
  { value: '5', label: 'پ' },
  { value: '6', label: 'ج' },
] as const

function selectedDays(mask: number): string[] {
  return WEEKDAYS.flatMap((day) =>
    (mask & (1 << Number(day.value))) !== 0 ? [day.value] : [],
  )
}

function workingDaysMask(values: string[]) {
  return values.reduce((mask, value) => mask | (1 << Number(value)), 0)
}

type Configuration = AdminSetupSalonConfigurationResponse

export function SalonSetupHoursForm({
  configuration,
  error,
  pending,
  isLiveData,
  onSave,
}: {
  configuration: Configuration
  error: unknown
  pending: boolean
  isLiveData: boolean
  onSave: (
    input: AdminSetupSalonHoursPatchRequest,
    options?: MutationSubmitOptions,
  ) => void
}) {
  const [days, setDays] = useState(() =>
    selectedDays(configuration.hours.workingDays),
  )
  const daysLabelId = useId()

  function submitHours(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    onSave({
      workingStart: String(form.get('workingStart') ?? ''),
      workingEnd: String(form.get('workingEnd') ?? ''),
      slotDurationMinutes: Number(form.get('slotDurationMinutes')),
      workingDays: workingDaysMask(days),
    })
  }

  return (
    <Panel title="روزها و ساعت کاری">
      <form className="flex flex-col gap-5" onSubmit={submitHours}>
        <LiveDataWarning
          show={isLiveData}
          message="تغییر ساعت کاری روی داده‌های زنده اعمال می‌شود."
        />
        <FieldSet>
          <FieldLegend variant="label" id={daysLabelId}>
            روزهای کاری سالن
          </FieldLegend>
          <FieldDescription>
            حداقل یک روز باید باز باشد. ترتیب روزها از شنبه تا جمعه است.
          </FieldDescription>
          <ToggleGroup
            type="multiple"
            value={days}
            onValueChange={setDays}
            aria-labelledby={daysLabelId}
            variant="outline"
            className="justify-start"
          >
            {WEEKDAYS.map((day) => (
              <ToggleGroupItem key={day.value} value={day.value}>
                {day.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </FieldSet>
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="ساعت باز شدن"
            name="workingStart"
            type="time"
            defaultValue={configuration.hours.workingStart}
            required
          />
          <FormField
            label="ساعت بسته شدن"
            name="workingEnd"
            type="time"
            defaultValue={configuration.hours.workingEnd}
            required
          />
          <FormField
            label="فاصله نوبت‌ها (دقیقه)"
            name="slotDurationMinutes"
            type="number"
            defaultValue={String(configuration.hours.slotDurationMinutes)}
            required
          />
        </FieldGroup>
        <MutationError error={error} />
        <Button type="submit" disabled={pending || days.length === 0}>
          <Save data-icon="inline-start" />
          ذخیره ساعت کاری
        </Button>
      </form>
    </Panel>
  )
}

export function SalonSetupPresenceForm({
  configuration,
  error,
  pending,
  isLiveData,
  onSave,
}: {
  configuration: Configuration
  error: unknown
  pending: boolean
  isLiveData: boolean
  onSave: (
    input: AdminSetupSalonPresencePatchRequest,
    options?: MutationSubmitOptions,
  ) => void
}) {
  const [location, setLocation] = useState({
    province: configuration.presence.province ?? '',
    city: configuration.presence.city ?? '',
    neighborhood: configuration.presence.neighborhood ?? '',
  })

  function submitPresence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    onSave({
      ...location,
      address: String(form.get('address') ?? ''),
      mapGoogle: String(form.get('mapGoogle') ?? ''),
      mapNeshan: String(form.get('mapNeshan') ?? ''),
      mapBalad: String(form.get('mapBalad') ?? ''),
      socialInstagram: String(form.get('socialInstagram') ?? ''),
      socialTelegram: String(form.get('socialTelegram') ?? ''),
      socialWhatsapp: String(form.get('socialWhatsapp') ?? ''),
      website: String(form.get('website') ?? ''),
    })
  }

  return (
    <Panel title="حضور سالن">
      <form className="flex flex-col gap-5" onSubmit={submitPresence}>
        <LiveDataWarning
          show={isLiveData}
          message="تغییر حضور سالن روی داده‌های زنده اعمال می‌شود."
        />
        <SalonLocationFields value={location} onChange={setLocation} />
        <TextAreaField
          label="آدرس"
          name="address"
          rows={3}
          defaultValue={configuration.presence.address ?? ''}
        />
        <PresenceInput
          label="نقشه گوگل"
          name="mapGoogle"
          value={configuration.presence.mapGoogle}
        />
        <PresenceInput
          label="نشان"
          name="mapNeshan"
          value={configuration.presence.mapNeshan}
        />
        <PresenceInput
          label="بلد"
          name="mapBalad"
          value={configuration.presence.mapBalad}
        />
        <PresenceInput
          label="وب‌سایت"
          name="website"
          value={configuration.presence.website}
        />
        <PresenceInput
          label="اینستاگرام"
          name="socialInstagram"
          value={configuration.presence.socialInstagram}
        />
        <PresenceInput
          label="تلگرام"
          name="socialTelegram"
          value={configuration.presence.socialTelegram}
        />
        <PresenceInput
          label="واتس‌اپ"
          name="socialWhatsapp"
          value={configuration.presence.socialWhatsapp}
        />
        <MutationError error={error} />
        <Button type="submit" disabled={pending}>
          <Save data-icon="inline-start" />
          ذخیره حضور سالن
        </Button>
      </form>
    </Panel>
  )
}

function PresenceInput({
  label,
  name,
  value,
}: {
  label: string
  name: keyof Configuration['presence']
  value: string | null
}) {
  const id = useId()
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} name={name} defaultValue={value ?? ''} dir="ltr" />
    </Field>
  )
}
