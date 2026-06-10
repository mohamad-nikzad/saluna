import { Calendar, Scissors } from 'lucide-react'
import { Avatar, AvatarFallback } from '@repo/ui/avatar'
import { SakuraMark } from '@repo/ui/sakura-mark'
import { toPersianDigits } from '@repo/salon-core/persian-digits'
import type { User } from '@repo/salon-core/types'

import { StaffRosterChip } from '#/components/staff/staff-roster-chip'
import { personInitials, staffAccentVar } from '#/lib/roster-visuals'
import { staffRoleLabel } from '#/components/staff/staff-utils'

interface StaffDetailHeroProps {
  member: User
  serviceCount: number
  workDaysCount: number | null
}

export function StaffDetailHero({
  member,
  serviceCount,
  workDaysCount,
}: StaffDetailHeroProps) {
  const accent = staffAccentVar(member.color)

  return (
    <div
      className="relative overflow-hidden border-b border-line-soft px-[18px] pb-[18px] pt-5"
      style={{
        backgroundColor: `color-mix(in srgb, ${accent} 14%, var(--card))`,
      }}
    >
      <SakuraMark
        size={150}
        color={`color-mix(in srgb, ${accent} 20%, transparent)`}
        className="pointer-events-none absolute -end-[26px] -top-[26px]"
      />
      <div className="relative flex items-center gap-3.5">
        <Avatar className="size-[66px] shrink-0">
          <AvatarFallback
            className="text-lg font-bold text-foreground"
            style={{ backgroundColor: accent }}
          >
            {personInitials(member.name)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-extrabold tracking-tight text-foreground">
            {member.name}
          </h1>
          <p className="mt-0.5 text-[12.5px] text-sage-deep">
            {staffRoleLabel(member.role)}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <StaffRosterChip icon={Scissors}>
              <span className="tabular-nums">
                {toPersianDigits(serviceCount)}
              </span>{' '}
              خدمت
            </StaffRosterChip>
            {member.role === 'staff' && workDaysCount != null ? (
              <StaffRosterChip icon={Calendar}>
                <span className="tabular-nums">
                  {toPersianDigits(workDaysCount)}
                </span>{' '}
                روز کاری
              </StaffRosterChip>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
