'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { JALALI_MONTHS, parseGregorianToJalali } from '@repo/salon-core/jalali'
import { toPersianDigits } from '@repo/salon-core/persian-digits'
import {
  fetchPublicAvailability,
  submitAppointmentRequest,
  type PublicAvailabilitySlot,
} from '../../_lib/public-api'

const PERSIAN_WEEKDAYS = [
  'شنبه',
  'یک‌شنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنج‌شنبه',
  'جمعه',
]
const PERSIAN_WEEKDAYS_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'] // Saturday-first

function dayOfWeekIranian(ymd: string): number {
  const date = new Date(ymd + 'T00:00:00')
  return (date.getDay() + 1) % 7
}

export type PublicDate = {
  ymd: string
  weekday: string
  weekdayShort: string
  /** Jalali day-of-month, already converted to Persian digits. */
  day: string
  month: string
  /** Jalali month number (1–12), for grouping/month-break detection. */
  jm: number
}

export function toPublicDates(ymds: string[]): PublicDate[] {
  return ymds.map((ymd) => {
    const { jm, jd } = parseGregorianToJalali(ymd)
    const dow = dayOfWeekIranian(ymd)
    return {
      ymd,
      weekday: PERSIAN_WEEKDAYS[dow]!,
      weekdayShort: PERSIAN_WEEKDAYS_SHORT[dow]!,
      day: toPersianDigits(jd),
      month: JALALI_MONTHS[jm - 1]!,
      jm,
    }
  })
}

export function usePublicDates(ymds: string[]): PublicDate[] {
  return useMemo(() => toPublicDates(ymds), [ymds])
}

export function addMinutesToHm(hm: string, minutes: number): string {
  const [h, m] = hm.split(':').map(Number)
  const total = h! * 60 + m! + minutes
  const hh = Math.floor(total / 60) % 24
  const mm = total % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function dedupeSlotsByStart(
  slots: PublicAvailabilitySlot[],
): PublicAvailabilitySlot[] {
  const seen = new Set<string>()
  const out: PublicAvailabilitySlot[] = []
  for (const slot of slots) {
    if (seen.has(slot.startTime)) continue
    seen.add(slot.startTime)
    out.push(slot)
  }
  return out.sort((a, b) => a.startTime.localeCompare(b.startTime))
}

export function emptyReasonMessage(reason?: string): string {
  switch (reason) {
    case 'NO_QUALIFIED_STAFF':
      return 'هیچ پرسنلی برای این خدمت در دسترس نیست.'
    case 'STAFF_OFF_DAY':
    case 'ALL_QUALIFIED_STAFF_OFF_DAY':
      return 'این روز تعطیل است.'
    case 'FULLY_BOOKED':
      return 'نوبت‌های این روز پر شده است.'
    case 'OUTSIDE_SEARCH_WINDOW':
      return 'این تاریخ خارج از بازه رزرو است.'
    default:
      return 'برای این روز نوبتی پیدا نشد.'
  }
}

export type DayAvailability = {
  slots: PublicAvailabilitySlot[]
  loading: boolean
  error: string | null
  emptyReason?: string
}

/**
 * Loads availability for a single day. `active` gates the fetch so the agenda
 * layout can lazy-load each day only when it scrolls into view.
 */
export function useDayAvailability(
  slug: string,
  serviceId: string,
  ymd: string | null,
  active: boolean,
): DayAvailability {
  const [state, setState] = useState<DayAvailability>({
    slots: [],
    loading: false,
    error: null,
  })

  useEffect(() => {
    if (!active || !ymd) return
    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: null }))
    fetchPublicAvailability(slug, { serviceId, date: ymd })
      .then((res) => {
        if (cancelled) return
        setState({
          slots: dedupeSlotsByStart(res.slots),
          loading: false,
          error: null,
          emptyReason: res.emptyReason,
        })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setState({
          slots: [],
          loading: false,
          error:
            err instanceof Error
              ? err.message
              : 'خطا در دریافت زمان‌های موجود. لطفاً دوباره تلاش کنید.',
          emptyReason: undefined,
        })
      })
    return () => {
      cancelled = true
    }
  }, [slug, serviceId, ymd, active])

  return state
}

export type SubmitArgs = {
  serviceId: string
  duration: number
  date: string
  startTime: string
  customerName: string
  customerPhone: string
  notes?: string
}

export function useRequestSubmit(slug: string) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, startSubmit] = useTransition()

  function submit(args: SubmitArgs) {
    setError(null)
    const endTime = addMinutesToHm(args.startTime, args.duration)
    startSubmit(async () => {
      try {
        const { token } = await submitAppointmentRequest(slug, {
          serviceId: args.serviceId,
          date: args.date,
          startTime: args.startTime,
          endTime,
          customerName: args.customerName.trim(),
          customerPhone: args.customerPhone.trim(),
          notes: args.notes?.trim() ? args.notes.trim() : undefined,
        })
        router.push(`/salons/${slug}/requests/${token}`)
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'ثبت درخواست با خطا مواجه شد. لطفاً دوباره تلاش کنید.',
        )
      }
    })
  }

  return { submit, isSubmitting, error, setError }
}
