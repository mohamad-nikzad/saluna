import { KeyRound, Trash2, User as UserIcon } from 'lucide-react'
import { PageHeaderBackButton } from '#/components/page-header-back-button'
import { STAFF_COLORS } from '@repo/salon-core/types'
import { normalizeCalendarColorId } from '@repo/salon-core/calendar-colors'
import { displayPhone } from '@repo/salon-core/phone'
import type {
  BusinessHours,
  Service,
  StaffSchedule,
  User,
} from '@repo/salon-core/types'
import { cn } from '@repo/ui/utils'

import { StaffDetailHero } from '#/components/staff/staff-detail-hero'
import {
  StaffDetailSection,
  StaffReadonlyField,
  StaffSectionAction,
} from '#/components/staff/staff-detail-section'
import { StaffSchedulePreview } from '#/components/staff/staff-schedule-preview'
import { getScheduleSummary } from '#/components/staff/staff-schedule'
import {
  staffRoleLabel,
  staffServiceCount,
} from '#/components/staff/staff-utils'
import { staffAccentVar } from '#/lib/roster-visuals'
import { ManagerStaffCommissionPanel } from '#/components/commissions/manager-staff-commission-panel'

export interface StaffDetailViewProps {
  member: User
  services: Service[]
  scheduleBundle: {
    schedule?: StaffSchedule[]
    businessHours?: BusinessHours
    isPending: boolean
  }
  isSelf: boolean
  onOpenProfile: (member: User) => void
  onOpenPassword: (member: User) => void
  onOpenSchedule: (member: User) => void
  onOpenServices: (member: User) => void
  onDelete: (member: User) => void
}

export function StaffDetailView({
  member,
  services,
  scheduleBundle,
  isSelf,
  onOpenProfile,
  onOpenPassword,
  onOpenSchedule,
  onOpenServices,
  onDelete,
}: StaffDetailViewProps) {
  const isStaffRole = member.role === 'staff'
  const serviceCount = staffServiceCount(member, services)
  const scheduleSummary = isStaffRole
    ? getScheduleSummary(scheduleBundle.schedule, {
        businessHours: scheduleBundle.businessHours,
      })
    : null
  const workDaysCount = scheduleSummary?.workDaysCount ?? null

  return (
    <div className="flex h-full flex-col bg-card">
      <header className="flex items-center gap-3 border-b border-line-soft px-[18px] py-3">
        <PageHeaderBackButton to="/staff" aria-label="بازگشت" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold text-foreground">
            ویرایش پرسنل
          </h1>
          <p className="truncate text-[11.5px] text-muted-foreground">
            {member.name}
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-auto pb-8">
        <StaffDetailHero
          member={member}
          serviceCount={serviceCount}
          workDaysCount={workDaysCount}
        />

        <StaffDetailSection
          title="اطلاعات شخصی"
          icon={UserIcon}
          action={
            <StaffSectionAction onClick={() => onOpenProfile(member)}>
              ویرایش
            </StaffSectionAction>
          }
        >
          <div className="flex flex-col gap-3">
            <StaffReadonlyField
              label="نام و نام خانوادگی"
              value={member.fullName ?? member.name}
            />
            <StaffReadonlyField
              label="نقش / تخصص"
              value={staffRoleLabel(member.role)}
            />
            <StaffReadonlyField
              label="شماره موبایل"
              hint="برای ورود به اپ استفاده می‌شود"
              value={displayPhone(member.phone)}
              dir="ltr"
            />
            {member.nickname?.trim() ? (
              <StaffReadonlyField label="نام نمایشی" value={member.nickname} />
            ) : null}
            <StaffReadonlyField
              label="رنگ در تقویم"
              value={
                <div className="flex flex-wrap gap-2 pt-0.5">
                  {STAFF_COLORS.map((color) => {
                    const normalized = normalizeCalendarColorId(color)
                    const selected =
                      normalizeCalendarColorId(member.color) === normalized
                    return (
                      <div
                        key={color}
                        className={cn(
                          'flex size-9 items-center justify-center rounded-xl',
                          selected &&
                            'ring-2 ring-card ring-offset-2 ring-offset-paper',
                        )}
                        style={{
                          backgroundColor: staffAccentVar(color),
                          boxShadow: selected
                            ? undefined
                            : 'inset 0 0 0 1px rgba(0,0,0,0.06)',
                        }}
                        aria-label={selected ? 'رنگ فعال' : undefined}
                      />
                    )
                  })}
                </div>
              }
            />
          </div>
        </StaffDetailSection>

        {!isSelf ? (
          <StaffDetailSection title="رمز عبور" icon={KeyRound}>
            <div className="flex items-center gap-3 rounded-[14px] border border-line bg-paper px-3.5 py-3">
              <div className="flex size-[38px] shrink-0 items-center justify-center rounded-[11px] bg-blush-soft text-primary">
                <KeyRound className="size-[17px]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold text-foreground">
                  رمز ورود
                </div>
                <div
                  className="mt-0.5 text-xs tracking-[0.18em] text-muted-foreground"
                  aria-hidden
                >
                  ••••••••
                </div>
              </div>
              <StaffSectionAction onClick={() => onOpenPassword(member)}>
                تغییر
              </StaffSectionAction>
            </div>
          </StaffDetailSection>
        ) : null}

        {isStaffRole ? (
          <>
            <StaffSchedulePreview
              member={member}
              scheduleBundle={scheduleBundle}
              services={services}
              onOpenSchedule={() => onOpenSchedule(member)}
              onOpenServices={() => onOpenServices(member)}
            />
            <ManagerStaffCommissionPanel staffId={member.id} />
          </>
        ) : null}

        {!isSelf ? (
          <div className="px-[18px] pt-4">
            <button
              type="button"
              onClick={() => onDelete(member)}
              className="flex w-full items-center justify-center gap-1.5 rounded-[14px] border border-destructive/20 bg-paper px-3.5 py-3 text-[13px] font-bold text-destructive touch-manipulation"
            >
              <Trash2 className="size-[15px]" strokeWidth={2} />
              حذف این پرسنل
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
