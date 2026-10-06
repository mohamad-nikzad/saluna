import { Button } from '@repo/ui/button'
import { useQuery } from '@tanstack/react-query'
import { getApiV1AppointmentsById } from '@repo/api-client/sdk'
import { APPOINTMENT_STATUS } from '@repo/salon-core/types'
import type { AppointmentStatusTransition } from '@repo/salon-core/types'

const timestamp = new Intl.DateTimeFormat('fa-IR', {
  timeZone: 'Asia/Tehran',
  dateStyle: 'short',
  timeStyle: 'short',
})

export function AppointmentStatusHistory({
  appointmentId,
}: {
  appointmentId: string
}) {
  const history = useQuery({
    queryKey: [{ _id: 'getApiV1Appointments', historyFor: appointmentId }],
    queryFn: async ({ signal }) => {
      const { data } = await getApiV1AppointmentsById({
        path: { id: appointmentId },
        signal,
        throwOnError: true,
      })
      return (data.appointment?.statusHistory ??
        []) as unknown as AppointmentStatusTransition[]
    },
  })
  return (
    <section aria-label="تاریخچه وضعیت" className="flex flex-col gap-2 text-xs">
      <h3 className="font-medium">تاریخچه وضعیت</h3>
      {history.isPending ? (
        <p role="status">در حال دریافت تاریخچه...</p>
      ) : history.isError ? (
        <p role="alert">
          دریافت تاریخچه انجام نشد.{' '}
          <Button
            variant="link"
            size="sm"
            type="button"
            onClick={() => void history.refetch()}
          >
            تلاش دوباره
          </Button>
        </p>
      ) : history.data.length === 0 ? (
        <p>هنوز تغییری ثبت نشده است.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {history.data.map((entry) => (
            <li key={entry.id}>
              <p>
                {APPOINTMENT_STATUS[entry.previousStatus].label} ←{' '}
                {APPOINTMENT_STATUS[entry.newStatus].label}
              </p>
              <p className="text-muted-foreground">
                {entry.actorName} ·{' '}
                {timestamp.format(new Date(entry.changedAt))}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
