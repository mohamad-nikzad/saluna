import {
  AlertCircle,
  Camera,
  Check,
  ChevronLeft,
  Globe,
  MapPin,
  MessageCircle,
  Plus,
  Send,
} from 'lucide-react'
import type { FieldErrors, UseFormRegister } from 'react-hook-form'
import { Input } from '@repo/ui/input'
import { Textarea } from '@repo/ui/textarea'
import { FieldError } from '@repo/ui/field'
import { cn } from '@repo/ui/utils'
import type { PresenceInput } from '@repo/salon-core/forms/presence'

import { presenceFieldInputId, type PresenceField } from './presence-validation'

export type { PresenceField }

type RowConfig = {
  field: PresenceField
  icon: typeof MapPin
  label: string
  color: string
  placeholder: string
  dir?: 'rtl' | 'ltr'
  textarea?: boolean
}

const ADDRESS_ROWS: ReadonlyArray<RowConfig> = [
  {
    field: 'address',
    icon: MapPin,
    label: 'آدرس سالن',
    color: '#6B3A4A',
    placeholder: 'خیابان، کوچه، پلاک…',
    dir: 'rtl',
    textarea: true,
  },
  {
    field: 'mapGoogle',
    icon: MapPin,
    label: 'گوگل مپ',
    color: '#5F8FAA',
    placeholder: 'https://maps.app.goo.gl/…',
  },
  {
    field: 'mapNeshan',
    icon: MapPin,
    label: 'نشان',
    color: '#6FA889',
    placeholder: 'https://neshan.org/…',
  },
  {
    field: 'mapBalad',
    icon: MapPin,
    label: 'بلد',
    color: '#C99746',
    placeholder: 'https://balad.ir/…',
  },
]

const SOCIAL_ROWS: ReadonlyArray<RowConfig> = [
  {
    field: 'socialInstagram',
    icon: Camera,
    label: 'اینستاگرام',
    color: '#C26878',
    placeholder: '@username',
    dir: 'ltr',
  },
  {
    field: 'socialTelegram',
    icon: Send,
    label: 'تلگرام',
    color: '#5F8FAA',
    placeholder: '@username',
    dir: 'ltr',
  },
  {
    field: 'socialWhatsapp',
    icon: MessageCircle,
    label: 'واتساپ',
    color: '#6FA889',
    placeholder: '۰۹۱۲۰۰۰۰۰۰۰',
    dir: 'ltr',
  },
  {
    field: 'website',
    icon: Globe,
    label: 'وب‌سایت',
    color: '#6B3A4A',
    placeholder: 'https://…',
    dir: 'ltr',
  },
]

export type PresenceFieldsProps = {
  register: UseFormRegister<PresenceInput>
  errors: FieldErrors<PresenceInput>
  values: PresenceInput
  open: PresenceField | null
  setOpen: (field: PresenceField | null) => void
}

export function PresenceFields({
  register,
  errors,
  values,
  open,
  setOpen,
}: PresenceFieldsProps) {
  const renderRow = (config: RowConfig) => {
    const value = values[config.field] ?? ''
    const filled = value.trim().length > 0
    const isOpen = open === config.field
    const Icon = config.icon
    const fieldError = errors[config.field]
    const hasError = Boolean(fieldError?.message)

    return (
      <div
        key={config.field}
        data-presence-field={config.field}
        className={cn(
          'overflow-hidden rounded-2xl border bg-card',
          hasError ? 'border-destructive' : 'border-line-soft',
        )}
      >
        <button
          type="button"
          aria-invalid={hasError || undefined}
          aria-describedby={
            hasError ? `${presenceFieldInputId(config.field)}-error` : undefined
          }
          onClick={() => setOpen(isOpen ? null : config.field)}
          className="flex w-full items-center gap-3 p-2.5 text-right"
        >
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-xl"
            style={{
              backgroundColor: `${config.color}${filled ? '29' : '1a'}`,
              color: config.color,
            }}
          >
            <Icon className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-foreground">
              {config.label}
            </span>
            <span
              dir={config.dir}
              className={cn(
                'block truncate text-xs',
                hasError ? 'text-destructive' : 'text-muted-foreground',
                config.dir === 'ltr' && 'text-left',
              )}
            >
              {hasError ? fieldError?.message : filled ? value : 'افزودن'}
            </span>
          </span>
          {hasError ? (
            <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-destructive-soft text-destructive">
              <AlertCircle className="size-3.5" />
            </span>
          ) : filled ? (
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="size-3" />
            </span>
          ) : (
            <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-blush-soft text-primary">
              <Plus className="size-3.5" />
            </span>
          )}
        </button>
        {isOpen && (
          <div className="border-t border-line-soft p-3">
            {config.textarea ? (
              <Textarea
                id={presenceFieldInputId(config.field)}
                dir={config.dir}
                placeholder={config.placeholder}
                className="min-h-20 text-right"
                aria-invalid={hasError || undefined}
                {...register(config.field)}
              />
            ) : (
              <Input
                id={presenceFieldInputId(config.field)}
                dir={config.dir}
                placeholder={config.placeholder}
                className={cn('h-11', config.dir === 'ltr' && 'text-left')}
                aria-invalid={hasError || undefined}
                {...register(config.field)}
              />
            )}
            {fieldError && (
              <FieldError id={`${presenceFieldInputId(config.field)}-error`}>
                {fieldError.message}
              </FieldError>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2 px-1 text-[11px] font-extrabold text-sage-deep">
        <span>آدرس و نقشه</span>
        <span className="h-px flex-1 bg-line-soft" />
        <ChevronLeft className="size-3 opacity-0" />
      </div>
      {ADDRESS_ROWS.map(renderRow)}

      <div className="mt-2 flex items-center gap-2 px-1 text-[11px] font-extrabold text-sage-deep">
        <span>شبکه‌های اجتماعی</span>
        <span className="h-px flex-1 bg-line-soft" />
      </div>
      {SOCIAL_ROWS.map(renderRow)}
    </div>
  )
}

export function countFilledPresenceFields(values: PresenceInput): number {
  return (Object.values(values) as Array<string | undefined>).filter((v) =>
    v?.trim(),
  ).length
}
