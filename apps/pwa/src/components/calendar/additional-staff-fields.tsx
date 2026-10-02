import { X } from 'lucide-react'
import { Button } from '@repo/ui/button'
import { Field, FieldError, FieldLabel } from '@repo/ui/field'
import { equalWorkAllocations } from '@repo/salon-core/commissions'
import { toPersianDigits } from '@repo/salon-core/persian-digits'
import type { Service, User } from '@repo/salon-core/types'

import { LocalizedNumberInput } from '#/components/localized-number-input'
import {
  StaffPicker,
  type StaffPickerStatus,
} from '#/components/calendar/staff-picker'

type WorkAllocation = {
  staffId: string
  allocationBasisPoints: number
}

export function AdditionalStaffFields({
  service,
  staff,
  leadStaffId,
  additionalStaffIds,
  workAllocations,
  getStatus,
  onAdditionalStaffIdsChange,
  onWorkAllocationsChange,
}: {
  service?: Service
  staff: User[]
  leadStaffId: string
  additionalStaffIds: string[]
  workAllocations: WorkAllocation[]
  getStatus?: (member: User) => StaffPickerStatus | undefined
  onAdditionalStaffIdsChange: (staffIds: string[]) => void
  onWorkAllocationsChange: (allocations: WorkAllocation[]) => void
}) {
  if (!service?.allowMultipleStaff || !leadStaffId) return null

  const staffIds = [leadStaffId, ...additionalStaffIds]
  const selected = new Set(staffIds)
  const available = staff.filter((member) => !selected.has(member.id))
  const allocationByStaff = new Map(
    (workAllocations.length > 0
      ? workAllocations
      : equalWorkAllocations(staffIds)
    ).map((allocation) => [allocation.staffId, allocation]),
  )
  const total = staffIds.reduce(
    (sum, staffId) =>
      sum + (allocationByStaff.get(staffId)?.allocationBasisPoints ?? 0),
    0,
  )

  const changeRoster = (nextAdditionalIds: string[]) => {
    onAdditionalStaffIdsChange(nextAdditionalIds)
    onWorkAllocationsChange(
      equalWorkAllocations([leadStaffId, ...nextAdditionalIds]),
    )
  }

  return (
    <>
      <Field>
        <FieldLabel>پرسنل همکار (اختیاری)</FieldLabel>
        <div className="space-y-2">
          {additionalStaffIds.map((staffId) => {
            const member = staff.find((candidate) => candidate.id === staffId)
            return (
              <div
                key={staffId}
                className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-blush-soft px-3"
              >
                <span className="truncate text-sm font-medium">
                  {member?.name ?? staffId}
                </span>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`حذف ${member?.name ?? 'پرسنل'}`}
                  onClick={() =>
                    changeRoster(
                      additionalStaffIds.filter((id) => id !== staffId),
                    )
                  }
                >
                  <X className="size-4" />
                </Button>
              </div>
            )
          })}
          {available.length > 0 ? (
            <StaffPicker
              staff={available}
              onChange={(staffId) =>
                changeRoster([...additionalStaffIds, staffId])
              }
              placeholder="افزودن پرسنل همکار"
              getStatus={getStatus}
            />
          ) : null}
        </div>
      </Field>

      {staffIds.length > 1 ? (
        <Field>
          <FieldLabel>سهم کار</FieldLabel>
          <div className="space-y-2 rounded-xl bg-blush-soft p-3">
            {staffIds.map((staffId, index) => {
              const member = staff.find((candidate) => candidate.id === staffId)
              const allocation = allocationByStaff.get(staffId)
              return (
                <label
                  key={staffId}
                  className="grid grid-cols-[1fr_7rem] items-center gap-3 text-sm"
                >
                  <span className="truncate">
                    {member?.name ?? staffId}
                    {index === 0 ? ' · مسئول اصلی' : ''}
                  </span>
                  <span className="relative">
                    <LocalizedNumberInput
                      value={(allocation?.allocationBasisPoints ?? 0) / 100}
                      inputMode="decimal"
                      aria-label={`درصد سهم ${member?.name ?? 'پرسنل'}`}
                      className="pl-8 text-right tabular-nums"
                      onValueChange={(value) => {
                        const allocationBasisPoints = Math.round(
                          Math.min(100, Math.max(0, Number(value) || 0)) * 100,
                        )
                        onWorkAllocationsChange(
                          staffIds.map((id) => ({
                            staffId: id,
                            allocationBasisPoints:
                              id === staffId
                                ? allocationBasisPoints
                                : (allocationByStaff.get(id)
                                    ?.allocationBasisPoints ?? 0),
                          })),
                        )
                      }}
                    />
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      ٪
                    </span>
                  </span>
                </label>
              )
            })}
          </div>
          {total !== 10_000 ? (
            <FieldError>
              مجموع سهم‌ها باید ۱۰۰٪ باشد؛ اکنون {toPersianDigits(total / 100)}٪
              است.
            </FieldError>
          ) : null}
        </Field>
      ) : null}
    </>
  )
}
