import { Link } from '@tanstack/react-router'
import { Check, Sun } from 'lucide-react'
import { Badge } from '@repo/ui/badge'
import { cn } from '@repo/ui/utils'
import { durationMinutesFromRange } from '@repo/salon-core/appointment-time'
import {
  formatPersianTime,
  toPersianDigits,
} from '@repo/salon-core/persian-digits'
import type { AppointmentWithDetails } from '@repo/salon-core/types'

import {
  bookedServiceWithAddonCount,
  DAY_WORK_MINUTES,
  firstNameOf,
  greetingFa,
} from '#/lib/today-view-model'
import { personInitials, staffAccentVar } from '#/lib/roster-visuals'
import type { GroupedAttentionItem } from '#/lib/today-view-model'
import { StatusPill } from '#/components/status-pill'

export function HeaderGreeting({
  name,
  count,
  dateLabel,
  suffix,
}: {
  name: string
  count: number
  dateLabel: string
  suffix?: string
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Sun className="size-3.5 text-amber" strokeWidth={1.8} />
        <span className="truncate">
          {greetingFa()}، {name}
        </span>
      </div>
      <div className="mt-1 truncate text-[22px] font-extrabold tracking-tight text-foreground">
        {toPersianDigits(count)} نوبت امروز
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">
        {dateLabel}
        {suffix}
      </div>
    </div>
  )
}

export function SectionTitle({
  icon: Icon,
  count,
  action,
  children,
}: {
  icon: React.ElementType
  count?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1.5">
        <Icon className="size-4 shrink-0 text-primary" />
        <h2 className="text-[15px] font-bold text-foreground">{children}</h2>
        {count ? (
          <span className="text-[11px] text-muted-foreground">{count}</span>
        ) : null}
      </div>
      {action}
    </div>
  )
}

export function HeroStat({
  label,
  value,
  fg,
}: {
  label: string
  value: string
  fg?: string
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="text-[10px] font-medium opacity-70">{label}</div>
      <div
        className="mt-0.5 text-[17px] font-bold tabular-nums"
        style={fg ? { color: fg } : undefined}
      >
        {value}
      </div>
    </div>
  )
}

export function HeroSep() {
  return <div className="w-px self-stretch bg-white/15" />
}

export function Avatar({
  name,
  color,
  size = 36,
}: {
  name: string
  color?: string | null
  size?: number
}) {
  const cssVar = staffAccentVar(color)
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-bold"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.32),
        background: `color-mix(in oklch, ${cssVar} 20%, transparent)`,
        color: cssVar,
      }}
    >
      {personInitials(name)}
    </div>
  )
}

export function AttentionCard({ item }: { item: GroupedAttentionItem }) {
  const body = (
    <div
      className="flex h-full min-w-[220px] max-w-[240px] flex-col gap-1.5 rounded-[18px] border border-line-soft bg-card p-3.5 shadow-sm"
      style={{
        borderInlineStartWidth: 3,
        borderInlineStartColor: 'var(--amber)',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-bold text-foreground">{item.title}</div>
        {item.labels[0] ? (
          <Badge variant="amber">{item.labels[0]}</Badge>
        ) : null}
      </div>
      <div className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
        {item.detail}
      </div>
      {item.labels.length > 1 ? (
        <div className="mt-auto flex flex-wrap gap-1 pt-1">
          {item.labels.slice(1).map((label) => (
            <Badge key={label} variant="neutral">
              {label}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  )

  if (item.clientId) {
    return (
      <Link
        to="/clients/$id"
        params={{ id: item.clientId }}
        className="shrink-0 active:opacity-80"
      >
        {body}
      </Link>
    )
  }
  return <div className="shrink-0">{body}</div>
}

export function QueueRow({
  appointment,
  isFirst,
  onOpen,
}: {
  appointment: AppointmentWithDetails
  isFirst: boolean
  onOpen: () => void
}) {
  const isDone = appointment.status === 'completed'
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'flex w-full touch-manipulation items-center gap-3 px-4 py-3.5 text-start transition-colors active:bg-accent/40',
        !isFirst && 'border-t border-line-soft',
        isDone && 'opacity-55',
      )}
    >
      <div className="min-w-[48px] text-center">
        <div
          className="text-sm font-bold tabular-nums text-foreground"
          dir="ltr"
        >
          {formatPersianTime(appointment.startTime)}
        </div>
        <div className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
          {toPersianDigits(
            durationMinutesFromRange(
              appointment.startTime,
              appointment.endTime,
            ),
          )}{' '}
          د
        </div>
      </div>
      <div className="h-9 w-px bg-line-soft" />
      <Avatar
        name={appointment.staff.name}
        color={appointment.staff.color}
        size={36}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-foreground">
            {appointment.client.name}
          </span>
          {isDone ? (
            <Check className="size-3.5 shrink-0 text-mint" strokeWidth={2.4} />
          ) : null}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {bookedServiceWithAddonCount(appointment)} ·{' '}
          {firstNameOf(appointment.staff.name)}
        </div>
      </div>
      <StatusPill status={appointment.status} />
    </button>
  )
}

export function TeamRow({
  staffName,
  color,
  appointmentCount,
  bookedMinutes,
  isFirst,
}: {
  staffName: string
  color?: string | null
  appointmentCount: number
  bookedMinutes: number
  isFirst: boolean
}) {
  const pct = Math.min(
    100,
    Math.round((bookedMinutes / DAY_WORK_MINUTES) * 100),
  )
  const cssVar = staffAccentVar(color)
  return (
    <div
      className={cn(
        'flex items-center gap-3 py-2',
        !isFirst && 'border-t border-line-soft',
      )}
    >
      <Avatar name={staffName} color={color} size={34} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[13px] font-semibold text-foreground">
            {staffName}
          </span>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {toPersianDigits(pct)}٪
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-paper-deep">
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, background: cssVar }}
          />
        </div>
        <div className="mt-1 text-[11px] tabular-nums text-muted-foreground">
          {toPersianDigits(appointmentCount)} نوبت ·{' '}
          {toPersianDigits(bookedMinutes)} دقیقه
        </div>
      </div>
    </div>
  )
}
