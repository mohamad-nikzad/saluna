import { Trash2, User as UserIcon } from 'lucide-react'
import { PageHeaderBackButton } from '#/components/page-header-back-button'
import { displayPhone } from '@repo/salon-core/phone'
import type {
  BusinessHours,
  Service,
  StaffSchedule,
  User,
} from '@repo/salon-core/types'

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
  onOpenSchedule,
  onOpenServices,
  onDelete,
}: StaffDetailViewProps) {
  const serviceCount = staffServiceCount(member, services)
  const scheduleSummary = getScheduleSummary(scheduleBundle.schedule, {
    businessHours: scheduleBundle.businessHours,
  })
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
              hint="شماره تماس ثبت‌شده در این سالن"
              value={displayPhone(member.phone)}
              dir="ltr"
            />
            {member.nickname?.trim() ? (
              <StaffReadonlyField label="نام نمایشی" value={member.nickname} />
            ) : null}
          </div>
        </StaffDetailSection>

        <StaffSchedulePreview
          member={member}
          scheduleBundle={scheduleBundle}
          services={services}
          onOpenSchedule={() => onOpenSchedule(member)}
          onOpenServices={() => onOpenServices(member)}
        />
        <ManagerStaffCommissionPanel staffId={member.id} services={services} />

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
