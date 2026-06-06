import { useMemo } from 'react'
import type { User } from '@repo/salon-core/types'
import { Users } from 'lucide-react'
import { personInitials, staffAccentVar } from '#/lib/roster-visuals'
import { CalendarDrawerFilter } from './calendar-drawer-filter'

interface StaffFilterProps {
  staff: User[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

export function StaffFilter({
  staff,
  selectedIds,
  onChange,
}: StaffFilterProps) {
  const options = useMemo(
    () =>
      staff.map((member) => ({
        id: member.id,
        label: member.name,
        marker: personInitials(member.name),
        colorVar: staffAccentVar(member.color),
        searchText: member.name,
      })),
    [staff],
  )

  return (
    <CalendarDrawerFilter
      ariaLabel="فیلتر پرسنل"
      triggerLabel="پرسنل"
      title="انتخاب پرسنل"
      description="پرسنل مورد نظر را جستجو و برای فیلتر کردن تقویم انتخاب کنید."
      searchPlaceholder="جستجو بین پرسنل…"
      allLabel="همه پرسنل"
      allDescription="نمایش نوبت‌های همه اعضا"
      allMarker="ه"
      emptyText="پرسنلی با این جستجو پیدا نشد"
      icon={Users}
      options={options}
      selectedIds={selectedIds}
      onChange={onChange}
    />
  )
}
