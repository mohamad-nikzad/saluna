import { Button } from '@repo/ui/button'
import { Badge } from '@repo/ui/badge'
import type { AppointmentWithDetails } from '@repo/salon-core/types'
import {
  Phone,
  Clock,
  Scissors,
  ChevronLeft,
  Wallet,
  AlertTriangle,
} from 'lucide-react'
import {
  ClientAvatar,
  clientAccent,
  isVip,
} from '#/components/clients/client-visuals'
import { durationMinutesFromRange } from '@repo/salon-core/appointment-time'
import { displayPhone } from '@repo/salon-core/phone'
import {
  formatPersianTime,
  toPersianDigits,
} from '@repo/salon-core/persian-digits'
import { tomansFormatter } from '#/lib/appointment-surface'
import type { AppointmentStatusActionState } from '#/lib/appointment-surface'
import { AppointmentDetailStatusActions } from '#/components/calendar/appointment-detail/appointment-detail-status-actions'

interface AppointmentDetailReadViewProps {
  appointment: AppointmentWithDetails
  readOnly: boolean
  canChangeStatus: boolean
  statusAction: AppointmentStatusActionState | null
  isMutating: boolean
  onStartEditing: () => void
  onStatusChange: (status: string) => void
  onOpenCompleteClient: () => void
}

export function AppointmentDetailReadView({
  appointment,
  readOnly,
  canChangeStatus,
  statusAction,
  isMutating,
  onStartEditing,
  onStatusChange,
  onOpenCompleteClient,
}: AppointmentDetailReadViewProps) {
  return (
    <div className="flex flex-col gap-3 overflow-auto px-5 py-4">
      <div className="flex items-center gap-3 rounded-2xl bg-blush-soft p-3.5">
        <ClientAvatar
          name={appointment.client.name}
          accent={clientAccent(appointment.client)}
          size={48}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate font-bold text-foreground">
              {appointment.client.name}
            </span>
            {isVip(appointment.client) ? (
              <Badge variant="rose">VIP</Badge>
            ) : null}
            {appointment.client.isPlaceholder ? (
              <Badge variant="amber">اطلاعات ناقص</Badge>
            ) : null}
          </div>
          {appointment.client.phone ? (
            <div
              dir="ltr"
              className="mt-0.5 text-right text-[13px] text-muted-foreground tabular-nums"
            >
              {displayPhone(appointment.client.phone)}
            </div>
          ) : null}
        </div>
        {appointment.client.phone ? (
          <a
            href={`tel:${appointment.client.phone}`}
            aria-label="تماس"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card text-primary transition-colors hover:bg-card/80"
          >
            <Phone className="size-4" />
          </a>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-blush-soft p-3.5 text-right">
          <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
            <span>ساعت</span>
            <Clock className="size-3.5" />
          </div>
          <div
            dir="ltr"
            className="mt-1 text-xl font-extrabold text-foreground tabular-nums"
          >
            {formatPersianTime(appointment.startTime)}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {toPersianDigits(
              durationMinutesFromRange(
                appointment.startTime,
                appointment.endTime,
              ),
            )}{' '}
            دقیقه
          </div>
        </div>
        <div className="rounded-2xl bg-blush-soft p-3.5 text-right">
          <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
            <span>مبلغ</span>
            <Wallet className="size-3.5" />
          </div>
          <div className="mt-1 text-xl font-extrabold text-primary tabular-nums">
            {toPersianDigits(Math.round(appointment.bookedTotalPrice / 1000))}{' '}
            هـ
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">تومان</div>
        </div>
      </div>

      <button
        type="button"
        onClick={onStartEditing}
        disabled={readOnly}
        className="flex items-center gap-3 rounded-2xl bg-blush-soft p-3.5 text-right transition-colors enabled:hover:bg-secondary disabled:cursor-default"
      >
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: `color-mix(in oklch, ${appointment.service.color} 16%, transparent)`,
          }}
        >
          <Scissors
            className="size-4"
            style={{ color: appointment.service.color }}
          />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold text-foreground">
            {appointment.bookedServiceName}
          </div>
          <div className="truncate text-[13px] text-muted-foreground">
            {appointment.staff.name}
            {appointment.bookedAddonCount > 0
              ? ` · +${toPersianDigits(appointment.bookedAddonCount)} افزودنی`
              : ''}
          </div>
        </div>
        {!readOnly ? (
          <ChevronLeft className="size-4 shrink-0 text-muted-foreground" />
        ) : null}
      </button>

      {appointment.bookedAddons && appointment.bookedAddons.length > 0 ? (
        <div className="rounded-2xl bg-blush-soft p-3.5 text-sm">
          <p className="mb-2 font-medium">افزودنی‌های ثبت‌شده</p>
          <div className="space-y-1.5">
            {appointment.bookedAddons.map((addon) => (
              <div
                key={addon.id}
                className="flex items-center justify-between gap-3 text-xs text-muted-foreground"
              >
                <span>{addon.bookedAddonName}</span>
                <span>
                  +{toPersianDigits(addon.bookedAddonDurationDelta)} دقیقه · +
                  {tomansFormatter.format(addon.bookedAddonPriceDelta)} تومان
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <AppointmentDetailStatusActions
        appointment={appointment}
        canChangeStatus={canChangeStatus}
        statusAction={statusAction}
        isMutating={isMutating}
        onStatusChange={onStatusChange}
      />

      {appointment.notes ? (
        <div className="flex items-start gap-2 rounded-2xl bg-amber-soft p-3.5 text-[13px] text-amber-fg">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>{appointment.notes}</p>
        </div>
      ) : null}

      {appointment.client.isPlaceholder && !readOnly ? (
        <div className="rounded-2xl bg-amber-soft p-3.5 text-sm text-amber-fg">
          <p className="font-medium">اطلاعات این مشتری هنوز کامل نشده است.</p>
          <p className="mt-1 text-xs opacity-90">
            شماره تماس و مشخصات نهایی را ثبت کنید تا این نوبت مثل یک مشتری عادی
            ادامه پیدا کند.
          </p>
          <Button
            size="sm"
            className="mt-3"
            variant="outline"
            onClick={onOpenCompleteClient}
          >
            تکمیل اطلاعات مشتری
          </Button>
        </div>
      ) : null}
    </div>
  )
}
