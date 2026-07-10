import { useNavigate } from '@tanstack/react-router'
import { ChevronLeft, Scissors } from 'lucide-react'
import { Avatar, AvatarFallback } from '@repo/ui/avatar'
import { Badge } from '@repo/ui/badge'
import { toPersianDigits } from '@repo/salon-core/persian-digits'
import type { User } from '@repo/salon-core/types'
import { StaffListRowMenu } from '#/components/staff/staff-list-row-menu'
import { StaffRosterChip } from '#/components/staff/staff-roster-chip'
import { personInitials, staffAccentVar } from '#/lib/roster-visuals'
import { staffRoleLabel } from '#/components/staff/staff-utils'
import {
  useCancelStaffInviteMutation,
  useResendStaffInviteMutation,
} from '#/lib/staff-queries'

interface StaffListCardProps {
  member: User
  currentUserId: string
  serviceCount: number
  onEditPassword: () => void
  onEditServices: () => void
  onEditSchedule: () => void
  onDelete: () => void
}

export function StaffListCard({
  member,
  currentUserId,
  serviceCount,
  onEditPassword,
  onEditServices,
  onEditSchedule,
  onDelete,
}: StaffListCardProps) {
  const navigate = useNavigate()
  const cancelInvite = useCancelStaffInviteMutation()
  const resendInvite = useResendStaffInviteMutation()

  return (
    <div className="flex items-center gap-1.5 rounded-[18px] border border-line-soft bg-card p-3.5">
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-start transition-opacity active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        onClick={() =>
          navigate({ to: '/staff/$id', params: { id: member.id } })
        }
      >
        <Avatar className="size-12 shrink-0">
          <AvatarFallback
            className="text-sm font-semibold text-foreground"
            style={{ backgroundColor: staffAccentVar(member.color) }}
          >
            {personInitials(member.name)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[14.5px] font-bold text-foreground">
              {member.name}
            </p>
            <span
              className="size-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: staffAccentVar(member.color) }}
              aria-hidden
            />
            {member.inviteStatus === 'pending' ? (
              <Badge variant="secondary" className="shrink-0 text-[10px]">
                در انتظار دعوت
              </Badge>
            ) : null}
          </div>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">
            {member.inviteStatus === 'pending'
              ? 'دعوت شده — هنوز ورود ندارد'
              : staffRoleLabel(member.role)}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <StaffRosterChip icon={Scissors}>
              {toPersianDigits(serviceCount)} خدمت
            </StaffRosterChip>
          </div>
        </div>
      </button>

      <StaffListRowMenu
        member={member}
        currentUserId={currentUserId}
        onEditProfile={() =>
          navigate({ to: '/staff/$id', params: { id: member.id } })
        }
        onEditPassword={onEditPassword}
        onEditServices={onEditServices}
        onEditSchedule={onEditSchedule}
        onResendInvite={
          member.inviteStatus === 'pending'
            ? () => {
                resendInvite.mutate(member.id)
              }
            : undefined
        }
        onCancelInvite={
          member.inviteStatus === 'pending'
            ? () => {
                cancelInvite.mutate(member.id)
              }
            : undefined
        }
        onDelete={onDelete}
      />

      <ChevronLeft
        className="size-[18px] shrink-0 text-muted-foreground"
        strokeWidth={2}
        aria-hidden
      />
    </div>
  )
}
