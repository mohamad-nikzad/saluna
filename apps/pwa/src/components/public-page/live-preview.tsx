import { Sparkles } from 'lucide-react'
import type { PublicTheme } from '@repo/salon-core/public-themes'
import { toPersianDigits } from '@repo/salon-core/persian-digits'

import { monogramFor } from './public-url'
import { formatTomansPrice } from './types'
import type { ServiceRow } from './types'

export function LivePreview({
  theme,
  layoutId,
  salonName,
  bio,
  services,
}: {
  theme: PublicTheme
  layoutId: string
  salonName: string
  bio: string
  services: ServiceRow[]
}) {
  const allVisible = services.filter((s) => s.visible)
  const totalVisible = allVisible.length
  const isAgenda = layoutId !== 'inline'
  const limit = isAgenda ? 6 : 5
  const visible = allVisible.slice(0, limit)

  return (
    <div
      className="overflow-hidden rounded-2xl border shadow-sm"
      style={{ background: theme.bg, color: theme.text }}
      dir="rtl"
    >
      <div className="h-16" style={{ background: theme.swatch }} />
      <div className="-mt-8 px-4">
        <div
          className="grid h-16 w-16 place-items-center rounded-2xl border-4 bg-white text-xl font-bold shadow"
          style={{ borderColor: theme.bg, color: theme.primary }}
        >
          {monogramFor(salonName)}
        </div>
        <div className="mt-2 text-sm font-bold">{salonName}</div>
        <p className="mt-1 line-clamp-2 text-[11px] opacity-70">
          {bio || 'بدون توضیحات'}
        </p>
      </div>

      {visible.length === 0 ? (
        <p className="px-4 py-4 text-xs opacity-60">خدمتی نمایش داده نشده</p>
      ) : isAgenda ? (
        <div className="mt-3 grid grid-cols-2 gap-1.5 px-4 pb-4">
          {visible.map((s) => (
            <div
              key={s.serviceId}
              className="flex items-center gap-2 rounded-lg bg-white/70 p-2 text-[11px]"
            >
              <span
                className="grid h-6 w-6 shrink-0 place-items-center rounded-md"
                style={{
                  background: `${theme.primary}1a`,
                  color: theme.primary,
                }}
              >
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <span className="truncate font-medium">{s.name}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 space-y-1.5 px-4 pb-4">
          {visible.map((s) => (
            <div
              key={s.serviceId}
              className="flex items-center justify-between rounded-lg bg-white/70 px-2.5 py-1.5 text-[11px]"
            >
              <span>{s.name}</span>
              <span style={{ color: theme.primary }} className="font-medium">
                {formatTomansPrice(s.price)}
              </span>
            </div>
          ))}
        </div>
      )}
      {totalVisible > limit && (
        <div className="px-4 pb-4 text-center text-[11px] opacity-60">
          + {toPersianDigits(totalVisible - limit)} خدمت دیگر
        </div>
      )}
    </div>
  )
}
