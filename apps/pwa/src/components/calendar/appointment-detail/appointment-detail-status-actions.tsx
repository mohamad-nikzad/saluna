import { Spinner } from '@repo/ui/spinner'
import { STATUS_CHANGE_SEGMENTS } from '#/lib/appointment-surface'
import type { AppointmentStatusActionState } from '#/lib/appointment-surface'
import type { AppointmentWithDetails } from '@repo/salon-core/types'
import { cn } from '@repo/ui/utils'

interface AppointmentDetailStatusActionsProps {
  appointment: AppointmentWithDetails
  canChangeStatus: boolean
  statusAction: AppointmentStatusActionState | null
  isMutating: boolean
  onStatusChange: (status: string) => void
}

export function AppointmentDetailStatusActions({
  appointment,
  canChangeStatus,
  statusAction,
  isMutating,
  onStatusChange,
}: AppointmentDetailStatusActionsProps) {
  if (!canChangeStatus) return null

  return (
    <>
      <div>
        <div className="mb-2 text-xs text-muted-foreground">وضعیت</div>
        <div className="flex flex-wrap gap-2">
          {STATUS_CHANGE_SEGMENTS.map(({ key, label }) => {
            const active = appointment.status === key
            const saving =
              statusAction?.mode === 'saving' && statusAction.status === key
            return (
              <button
                key={key}
                type="button"
                disabled={isMutating || active}
                onClick={() => !active && onStatusChange(key)}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-full border px-4 py-2 text-[13px] font-medium transition-colors',
                  active
                    ? 'border-transparent bg-primary text-primary-foreground shadow-sm'
                    : 'border-transparent bg-blush-soft text-muted-foreground hover:text-foreground disabled:opacity-50',
                )}
              >
                {saving ? <Spinner className="size-3.5" /> : null}
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {statusAction && statusAction.mode !== 'saving' ? (
        <p
          className={cn(
            'rounded-2xl px-3.5 py-2.5 text-xs',
            statusAction.mode === 'queued'
              ? 'bg-amber-soft text-amber-fg'
              : 'bg-mint-soft text-mint-fg',
          )}
        >
          {statusAction.message}
        </p>
      ) : null}
    </>
  )
}
