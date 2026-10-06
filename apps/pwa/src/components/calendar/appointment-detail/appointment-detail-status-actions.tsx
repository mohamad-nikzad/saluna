import { Button } from '@repo/ui/button'
import { Alert, AlertDescription } from '@repo/ui/alert'
import { APPOINTMENT_STATUS } from '@repo/salon-core/types'
import { Spinner } from '@repo/ui/spinner'
import { STATUS_CHANGE_SEGMENTS } from '#/lib/appointment-surface'
import type { AppointmentStatusActionState } from '#/lib/appointment-surface'
import type { AppointmentWithDetails } from '@repo/salon-core/types'

interface AppointmentDetailStatusActionsProps {
  appointment: AppointmentWithDetails
  canChangeStatus: boolean
  allowedStatuses?: AppointmentWithDetails['status'][]
  statusAction: AppointmentStatusActionState | null
  isMutating: boolean
  onStatusChange: (status: string) => void
}

export function AppointmentDetailStatusActions({
  appointment,
  canChangeStatus,
  allowedStatuses,
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
          {(allowedStatuses
            ? allowedStatuses.map((key) => ({
                key,
                label: APPOINTMENT_STATUS[key].label,
              }))
            : STATUS_CHANGE_SEGMENTS
          ).map(({ key, label }) => {
            const active = appointment.status === key
            const saving =
              statusAction?.mode === 'saving' && statusAction.status === key
            return (
              <Button
                variant={active ? 'default' : 'outline'}
                size="sm"
                key={key}
                type="button"
                disabled={isMutating || active}
                onClick={() => !active && onStatusChange(key)}
              >
                {saving ? <Spinner data-icon="inline-start" /> : null}
                {label}
              </Button>
            )
          })}
        </div>
      </div>

      {statusAction ? (
        <Alert
          variant={statusAction.mode === 'error' ? 'destructive' : 'default'}
        >
          <AlertDescription>{statusAction.message}</AlertDescription>
        </Alert>
      ) : null}
    </>
  )
}
