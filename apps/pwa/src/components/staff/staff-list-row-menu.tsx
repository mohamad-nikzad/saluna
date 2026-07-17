import {
  Clock3,
  ListChecks,
  MoreVertical,
  Pencil,
  RefreshCw,
  Trash2,
  XCircle,
} from 'lucide-react'
import { Button } from '@repo/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/dropdown-menu'
import type { User } from '@repo/salon-core/types'

interface StaffListRowMenuProps {
  member: User
  currentUserId: string
  onEditProfile: () => void
  onEditServices: () => void
  onEditSchedule: () => void
  onResendInvite?: () => void
  onCancelInvite?: () => void
  onDelete: () => void
}

export function StaffListRowMenu({
  member,
  currentUserId,
  onEditProfile,
  onEditServices,
  onEditSchedule,
  onResendInvite,
  onCancelInvite,
  onDelete,
}: StaffListRowMenuProps) {
  const isSelf = member.id === currentUserId
  const isStaffRole = member.role === 'staff'
  const isPendingInvite = member.inviteStatus === 'pending'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-9 shrink-0 touch-manipulation rounded-xl text-muted-foreground"
          aria-label={`گزینه‌های بیشتر برای ${member.name}`}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem
          className="gap-2"
          onSelect={() => {
            onEditProfile()
          }}
        >
          <Pencil className="h-4 w-4" />
          ویرایش پروفایل
        </DropdownMenuItem>

        {isStaffRole ? (
          <>
            <DropdownMenuItem
              className="gap-2"
              onSelect={() => {
                onEditServices()
              }}
            >
              <ListChecks className="h-4 w-4" />
              خدمات قابل ارائه
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2"
              onSelect={() => {
                onEditSchedule()
              }}
            >
              <Clock3 className="h-4 w-4" />
              روزها و ساعات کاری
            </DropdownMenuItem>
          </>
        ) : null}

        {isPendingInvite && onResendInvite ? (
          <DropdownMenuItem
            className="gap-2"
            onSelect={() => {
              onResendInvite()
            }}
          >
            <RefreshCw className="h-4 w-4" />
            ارسال دوباره دعوت
          </DropdownMenuItem>
        ) : null}

        {isPendingInvite && onCancelInvite ? (
          <DropdownMenuItem
            className="gap-2"
            onSelect={() => {
              onCancelInvite()
            }}
          >
            <XCircle className="h-4 w-4" />
            لغو دعوت
          </DropdownMenuItem>
        ) : null}

        {!isSelf ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              className="gap-2"
              onSelect={() => {
                onDelete()
              }}
            >
              <Trash2 className="h-4 w-4" />
              حذف پرسنل
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
