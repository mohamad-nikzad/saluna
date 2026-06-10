import { Clock3, Scissors } from 'lucide-react'
import { Skeleton } from '@repo/ui/skeleton'
import { eligibleServicesForStaff } from '@repo/salon-core/staff-service-autofill'
import type {
  BusinessHours,
  Service,
  StaffSchedule,
  User,
} from '@repo/salon-core/types'
import {
  formatPersianTime,
  toPersianDigits,
} from '@repo/salon-core/persian-digits'
import { cn } from '@repo/ui/utils'

import {
  StaffDetailSection,
  StaffSectionAction,
} from '#/components/staff/staff-detail-section'
import {
  DEFAULT_WORKING_END,
  DEFAULT_WORKING_START,
  getScheduleSummary,
  STAFF_SCHEDULE_DAYS,
} from '#/components/staff/staff-schedule'

interface StaffSchedulePreviewProps {
  member: User
  scheduleBundle: {
    schedule?: StaffSchedule[]
    businessHours?: BusinessHours
    isPending: boolean
  }
  services: Service[]
  onOpenSchedule: () => void
  onOpenServices: () => void
}

export function StaffSchedulePreview({
  member,
  scheduleBundle,
  services,
  onOpenSchedule,
  onOpenServices,
}: StaffSchedulePreviewProps) {
  const eligibleServices = eligibleServicesForStaff(member, services)
  const unrestrictedServices = member.serviceIds == null
  const activeServicesCount = services.filter(
    (service) => service.active,
  ).length

  const summary = getScheduleSummary(scheduleBundle.schedule, {
    businessHours: scheduleBundle.businessHours,
  })
  const firstActiveDay = summary.activeDays[0]
  const firstRowTimes = firstActiveDay
    ? summary.displayRows.find(
        (row) => row.dayOfWeek === firstActiveDay.dayOfWeek,
      )
    : null

  return (
    <>
      <StaffDetailSection
        title="خدمات قابل ارائه"
        icon={Scissors}
        action={
          <StaffSectionAction onClick={onOpenServices}>
            مدیریت
          </StaffSectionAction>
        }
      >
        <div className="flex flex-col gap-1.5">
          {eligibleServices.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2.5 rounded-[11px] border border-line-soft bg-paper px-3 py-2"
            >
              <div className="flex size-[30px] shrink-0 items-center justify-center rounded-[9px] bg-blush-soft text-primary">
                <Scissors className="size-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-semibold text-foreground">
                  {item.name}
                </div>
                <div className="mt-0.5 text-[10.5px] tabular-nums text-muted-foreground">
                  {toPersianDigits(item.duration)} دقیقه
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10.5px] leading-relaxed text-muted-foreground">
          <span className="tabular-nums">
            {toPersianDigits(eligibleServices.length)}
          </span>{' '}
          از{' '}
          <span className="tabular-nums">
            {toPersianDigits(activeServicesCount)}
          </span>{' '}
          خدمت سالن
          {unrestrictedServices ? ' (همه خدمات فعال)' : ''} به این پرسنل اختصاص
          دارد.
        </p>
      </StaffDetailSection>

      <StaffDetailSection
        title="روزها و ساعات کاری"
        icon={Clock3}
        action={
          <StaffSectionAction onClick={onOpenSchedule}>
            ویرایش
          </StaffSectionAction>
        }
      >
        {scheduleBundle.isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            <div className="mb-3 flex gap-1">
              {STAFF_SCHEDULE_DAYS.map((day) => {
                const row = summary.displayRows.find(
                  (entry) => entry.dayOfWeek === day.dayOfWeek,
                )
                const active = row?.active ?? false
                return (
                  <div
                    key={day.dayOfWeek}
                    className={cn(
                      'flex h-[38px] flex-1 items-center justify-center rounded-[11px] text-[12.5px] font-bold',
                      active
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-line-soft bg-paper text-muted-foreground',
                    )}
                  >
                    {day.label.slice(0, 1)}
                  </div>
                )
              })}
            </div>
            <div className="flex items-center gap-2.5 rounded-xl border border-line-soft bg-paper px-3.5 py-2.5">
              <Clock3 className="size-[15px] text-primary" strokeWidth={1.9} />
              <div className="flex-1 text-[12.5px] font-semibold text-foreground">
                ساعت کاری
              </div>
              <div
                className="text-[13px] font-bold tabular-nums text-foreground"
                dir="ltr"
              >
                {formatPersianTime(
                  firstRowTimes?.start ?? DEFAULT_WORKING_START,
                )}{' '}
                – {formatPersianTime(firstRowTimes?.end ?? DEFAULT_WORKING_END)}
              </div>
            </div>
            <div className="mt-2 flex flex-col gap-1">
              {summary.displayRows.map((row) => (
                <div
                  key={row.dayOfWeek}
                  className="flex items-center justify-between gap-3 text-[12px]"
                >
                  <span className="font-semibold text-foreground">
                    {row.label}
                  </span>
                  {row.active ? (
                    <span
                      className="tabular-nums text-muted-foreground"
                      dir="ltr"
                    >
                      {formatPersianTime(row.start)} –{' '}
                      {formatPersianTime(row.end)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">تعطیل</span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </StaffDetailSection>
    </>
  )
}
