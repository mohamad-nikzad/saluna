import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { validateAppointmentWindow } from '@repo/salon-core/appointment-time'

import { staffBookingAvailabilityQueryOptions } from '#/lib/staff-queries'

type BookingSlot = { date: string; startTime: string; endTime: string }

export function useStaffBookingAvailability(
  open: boolean,
  date: string,
  startTime: string,
  endTime: string,
) {
  const [debouncedSlot, setDebouncedSlot] = useState<BookingSlot | null>(null)

  useEffect(() => {
    if (!open || !date || !startTime || !endTime) {
      setDebouncedSlot(null)
      return
    }
    const windowCheck = validateAppointmentWindow(startTime, endTime)
    if (!windowCheck.ok) {
      setDebouncedSlot(null)
      return
    }
    const timer = window.setTimeout(() => {
      setDebouncedSlot({ date, startTime, endTime })
    }, 280)
    return () => window.clearTimeout(timer)
  }, [open, date, startTime, endTime])

  const query = useQuery({
    ...staffBookingAvailabilityQueryOptions(
      debouncedSlot ?? { date: '', startTime: '', endTime: '' },
    ),
    enabled: open && debouncedSlot != null,
  })

  const staffSlotOk = useMemo(() => {
    const next: Record<string, boolean> = {}
    for (const row of query.data ?? []) {
      next[row.staffId] = row.available
    }
    return next
  }, [query.data])

  return staffSlotOk
}
