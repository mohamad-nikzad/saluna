import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { validateAppointmentWindow } from '@repo/salon-core/appointment-time'

import { api } from '#/lib/api-client'
import { staffBookingAvailabilityQueryKey } from '#/lib/query-keys'

type BookingSlot = { date: string; startTime: string; endTime: string }

type StaffBookingRow = { staffId: string; available: boolean }

export function useStaffBookingAvailability(
  open: boolean,
  date: string,
  startTime: string,
  endTime: string,
  isOnline: boolean,
) {
  const [debouncedSlot, setDebouncedSlot] = useState<BookingSlot | null>(null)

  useEffect(() => {
    if (!open || !date || !startTime || !endTime || !isOnline) {
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
  }, [open, date, startTime, endTime, isOnline])

  const query = useQuery({
    queryKey: debouncedSlot
      ? staffBookingAvailabilityQueryKey(debouncedSlot)
      : (['staff', 'booking-availability', 'idle'] as const),
    queryFn: async ({ signal }) => {
      const res = await api.staff.bookingAvailability(debouncedSlot!, {
        signal,
      })
      return (res as unknown as { staff?: StaffBookingRow[] }).staff ?? []
    },
    enabled: open && isOnline && debouncedSlot != null,
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
