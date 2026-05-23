'use client'

import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import type { PublicTheme } from '@repo/salon-core/public-themes'
import type { Service } from '@repo/salon-core/types'
import { useRequestSubmit } from './use-public-booking'

export type PickedSlot = { date: string; startTime: string }

type Props = {
  slug: string
  service: Service
  picked: PickedSlot | null
  theme: PublicTheme
  variant: 'stacked' | 'row'
}

const inputClass =
  'min-w-0 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-black/25'

export function BookingForm({ slug, service, picked, theme, variant }: Props) {
  const { submit, isSubmitting, error, setError } = useRequestSubmit(slug)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')

  const canSubmit = !!picked && name.trim().length > 0 && phone.trim().length > 0

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!picked) {
      setError('لطفاً یک زمان را انتخاب کنید.')
      return
    }
    submit({
      serviceId: service.id,
      duration: service.duration,
      date: picked.date,
      startTime: picked.startTime,
      customerName: name,
      customerPhone: phone,
      notes,
    })
  }

  const submitButton = (
    <button
      type="submit"
      disabled={!canSubmit || isSubmitting}
      className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-extrabold text-white shadow-md transition disabled:cursor-not-allowed disabled:opacity-50"
      style={{ backgroundColor: theme.primary }}
    >
      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
      ارسال درخواست رزرو
    </button>
  )

  if (variant === 'row') {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            placeholder="نام و نام خانوادگی"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={`${inputClass} flex-1`}
          />
          <input
            placeholder="۰۹xxxxxxxxx"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            type="tel"
            inputMode="numeric"
            dir="ltr"
            className={`${inputClass} flex-1`}
          />
          {submitButton}
        </div>
        {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-bold opacity-70">نام و نام خانوادگی</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={`${inputClass} mt-1 w-full`}
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold opacity-70">شماره موبایل</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            type="tel"
            inputMode="numeric"
            placeholder="۰۹xxxxxxxxx"
            dir="ltr"
            className={`${inputClass} mt-1 w-full`}
          />
        </label>
      </div>
      <label className="block">
        <span className="text-xs font-bold opacity-70">یادداشت (اختیاری)</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className={`${inputClass} mt-1 w-full resize-none`}
        />
      </label>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      <button
        type="submit"
        disabled={!canSubmit || isSubmitting}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-base font-extrabold text-white shadow-md transition disabled:cursor-not-allowed disabled:opacity-50"
        style={{ backgroundColor: theme.primary }}
      >
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        ارسال درخواست رزرو
      </button>
    </form>
  )
}
