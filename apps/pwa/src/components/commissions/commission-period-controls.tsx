import { JalaliDatePicker } from '@repo/ui/jalali-date-picker'
import { cn } from '@repo/ui/utils'
import { salonTodayYmd } from '@repo/salon-core/salon-local-time'

import type { CommissionPeriodQuery } from '#/lib/commission-queries'

const periods = [
  ['today', 'امروز'],
  ['week', 'این هفته'],
  ['month', 'این ماه'],
  ['custom', 'بازه دلخواه'],
] as const

export function CommissionPeriodControls({
  value,
  onChange,
}: {
  value: CommissionPeriodQuery
  onChange: (value: CommissionPeriodQuery) => void
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-1 rounded-[14px] bg-blush-soft p-1">
        {periods.map(([period, label]) => (
          <button
            key={period}
            type="button"
            onClick={() => {
              if (period === 'custom') {
                const today = salonTodayYmd()
                onChange({
                  period,
                  startDate: value.startDate ?? today,
                  endDate: value.endDate ?? today,
                })
              } else {
                onChange({ period })
              }
            }}
            className={cn(
              'min-h-9 rounded-[10px] px-1 text-[11px] font-bold transition-colors touch-manipulation',
              value.period === period
                ? 'bg-card text-primary shadow-sm'
                : 'text-muted-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {value.period === 'custom' ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-xs text-muted-foreground">
            <span>از تاریخ</span>
            <JalaliDatePicker
              value={value.startDate!}
              onChange={(startDate) => onChange({ ...value, startDate })}
            />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            <span>تا تاریخ (شامل این روز)</span>
            <JalaliDatePicker
              value={value.endDate!}
              onChange={(endDate) => onChange({ ...value, endDate })}
            />
          </label>
        </div>
      ) : null}
    </div>
  )
}
