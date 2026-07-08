import { useMemo } from 'react'
import type { Service } from '@repo/salon-core/types'
import { toPersianDigits } from '@repo/salon-core/persian-digits'
import { staffAccentVar } from '#/lib/roster-visuals'
import { Scissors } from 'lucide-react'
import { CalendarDrawerFilter } from './calendar-drawer-filter'

interface ServiceFilterProps {
  services: Service[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

function serviceMarker(name: string) {
  return name.trim().slice(0, 1) || 'خ'
}

export function ServiceFilter({
  services,
  selectedIds,
  onChange,
}: ServiceFilterProps) {
  const options = useMemo(
    () =>
      services.map((service) => ({
        id: service.id,
        label: service.name,
        subtitle: `${toPersianDigits(service.duration)} دقیقه`,
        marker: serviceMarker(service.name),
        colorVar: staffAccentVar(service.color),
        searchText: [
          service.name,
          service.categoryName,
          service.active ? 'فعال' : 'غیرفعال',
        ]
          .filter(Boolean)
          .join(' '),
      })),
    [services],
  )

  return (
    <CalendarDrawerFilter
      ariaLabel="فیلتر خدمت"
      triggerLabel="خدمت"
      title="انتخاب خدمت"
      description="خدمت مورد نظر را جستجو و برای فیلتر کردن تقویم انتخاب کنید."
      searchPlaceholder="جستجو بین خدمات…"
      allLabel="همه خدمات"
      allDescription="نمایش نوبت‌های همه خدمات"
      allMarker="ه"
      emptyText="خدمتی با این جستجو پیدا نشد"
      icon={Scissors}
      options={options}
      selectedIds={selectedIds}
      onChange={onChange}
    />
  )
}
