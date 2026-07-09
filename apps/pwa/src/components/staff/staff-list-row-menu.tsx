import {
  Clock3,
  KeyRound,
  ListChecks,
  MoreVertical,
  Pencil,
  Trash2,
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
  onEditPassword: () => void
  onEditServices: () => void
  onEditSchedule: () => void
  onDelete: () => void
}

export function StaffListRowMenu({
  member,
  currentUserId,
  onEditProfile,
  onEditPassword,
  onEditServices,
  onEditSchedule,
  onDelete,
}: StaffListRowMenuProps) {
  const isSelf = member.id === currentUserId
  const isStaffRole = member.role === 'staff'

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

        {!isSelf && member.inviteStatus !== 'pending' ? (
          <DropdownMenuItem
            className="gap-2"
            onSelect={() => {
              onEditPassword()
            }}
          >
            <KeyRound className="h-4 w-4" />
            تغییر رمز عبور
          </DropdownMenuItem>
        ) : null}

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
