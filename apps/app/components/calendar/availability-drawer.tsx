'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Search,
  Sparkles,
} from 'lucide-react'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@repo/ui/drawer'
import { Button } from '@repo/ui/button'
import { Alert, AlertDescription } from '@repo/ui/alert'
import { Badge } from '@repo/ui/badge'
import { Field, FieldGroup, FieldLabel, FieldError } from '@repo/ui/field'
import { JalaliDatePicker } from '@repo/ui/jalali-date-picker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/select'
import { Spinner } from '@repo/ui/spinner'
import { cn } from '@repo/ui/utils'
import {
  AVAILABILITY_EMPTY_REASONS,
  type AvailabilityEmptyReason,
  type AvailabilityResponse,
  type AvailabilitySlot,
} from '@repo/salon-core/availability'
import { formatJalaliFullDate } from '@repo/salon-core/jalali'
import { formatPersianTime, toPersianDigits } from '@repo/salon-core/persian-digits'
import { addDaysYmd } from '@repo/salon-core/salon-local-time'
import { eligibleStaffForService } from '@repo/salon-core/staff-service-autofill'
import type { Service, User } from '@repo/salon-core/types'
import {
  availabilitySearchSchema,
  type AvailabilitySearchInput,
} from '@repo/salon-core/forms/appointment'
import { ServicePicker } from '@/components/services/service-picker'
import { fetchJsonOrThrow, HttpError, useNetworkStatus } from '@/lib/pwa-client'

const ANY_STAFF_VALUE = '__any__'

type DayAvailabilityResponse = Extract<AvailabilityResponse, { mode: 'day' }>
type NearestAvailabilityResponse = Extract<AvailabilityResponse, { mode: 'nearest' }>

type SlotGroup = {
  staffId: string
  staffName: string
  slots: AvailabilitySlot[]
}

interface AvailabilityDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialDate: string
  staff: User[]
  services: Service[]
  onSelectSlot: (selection: { slot: AvailabilitySlot; serviceId: string }) => void
}

function emptyReasonCopy(reason?: AvailabilityEmptyReason): string {
  switch (reason) {
    case AVAILABILITY_EMPTY_REASONS.NO_QUALIFIED_STAFF:
      return 'برای این خدمت فعلاً پرسنل فعالی تعریف نشده است.'
    case AVAILABILITY_EMPTY_REASONS.STAFF_OFF_DAY:
      return 'پرسنل انتخاب‌شده در این روز شیفت فعالی ندارد.'
    case AVAILABILITY_EMPTY_REASONS.ALL_QUALIFIED_STAFF_OFF_DAY:
      return 'هیچ‌کدام از پرسنل واجد شرایط در این روز شیفت فعالی ندارند.'
    case AVAILABILITY_EMPTY_REASONS.OUTSIDE_SEARCH_WINDOW:
      return 'تا ۷ روز آینده زمان خالی مناسبی پیدا نشد.'
    case AVAILABILITY_EMPTY_REASONS.FULLY_BOOKED:
    default:
      return 'در این روز زمانی پیدا نشد که کل مدت خدمت در آن جا شود.'
  }
}

function compareGroupedSlots(a: SlotGroup, b: SlotGroup): number {
  const aFirst = a.slots[0]?.startTime ?? '99:99'
  const bFirst = b.slots[0]?.startTime ?? '99:99'
  if (aFirst !== bFirst) {
    return aFirst.localeCompare(bFirst)
  }
  return a.staffName.localeCompare(b.staffName, 'fa')
}

function groupSlotsByStaff(slots: AvailabilitySlot[]): SlotGroup[] {
  const groups = new Map<string, SlotGroup>()

  for (const slot of slots) {
    const current = groups.get(slot.staffId)
    if (current) {
      current.slots.push(slot)
      continue
    }
    groups.set(slot.staffId, {
      staffId: slot.staffId,
      staffName: slot.staffName,
      slots: [slot],
    })
  }

  return [...groups.values()].sort(compareGroupedSlots)
}

export function AvailabilityDrawer({
  open,
  onOpenChange,
  initialDate,
  staff,
  services,
  onSelectSlot,
}: AvailabilityDrawerProps) {
  const isOnline = useNetworkStatus()
  const abortRef = useRef<AbortController | null>(null)
  const wasOpenRef = useRef(open)

  const {
    setValue,
    reset,
    watch,
    formState: { errors },
  } = useForm<AvailabilitySearchInput>({
    resolver: zodResolver(availabilitySearchSchema),
    defaultValues: {
      serviceId: '',
      staffSelection: ANY_STAFF_VALUE,
      date: initialDate,
    },
  })
  const serviceId = watch('serviceId') ?? ''
  const staffSelection = watch('staffSelection') ?? ANY_STAFF_VALUE
  const date = watch('date') ?? initialDate
  const [loadingMode, setLoadingMode] = useState<'day' | 'nearest' | null>(null)
  const [error, setError] = useState('')
  const [dayResponse, setDayResponse] = useState<DayAvailabilityResponse | null>(null)
  const [nearestResponse, setNearestResponse] = useState<NearestAvailabilityResponse | null>(null)

  const staffRoleOnly = useMemo(
    () => staff.filter((member) => member.role === 'staff'),
    [staff]
  )
  const activeServices = useMemo(
    () => services.filter((service) => service.active),
    [services]
  )
  const eligibleStaff = useMemo(
    () => (serviceId ? eligibleStaffForService(staffRoleOnly, serviceId) : []),
    [serviceId, staffRoleOnly]
  )
  const groupedSlots = useMemo(
    () => (dayResponse?.slots.length ? groupSlotsByStaff(dayResponse.slots) : []),
    [dayResponse]
  )
  const hasVisibleResults = groupedSlots.length > 0 || nearestResponse?.slot != null

  const clearResults = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setLoadingMode(null)
    setError('')
    setDayResponse(null)
    setNearestResponse(null)
  }, [])

  const resetDrawer = useCallback(() => {
    clearResults()
    reset({
      serviceId: '',
      staffSelection: ANY_STAFF_VALUE,
      date: initialDate,
    })
  }, [clearResults, initialDate, reset])

  const runSearch = useCallback(
    async (mode: 'day' | 'nearest', targetDate = date) => {
      if (!serviceId) {
        return
      }

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setLoadingMode(mode)
      setError('')
      if (mode === 'day') {
        setDayResponse(null)
        setNearestResponse(null)
      } else {
        setNearestResponse(null)
      }

      try {
        const searchParams = new URLSearchParams({
          mode,
          serviceId,
          date: targetDate,
        })
        if (staffSelection !== ANY_STAFF_VALUE) {
          searchParams.set('staffId', staffSelection)
        }

        const response = await fetchJsonOrThrow<AvailabilityResponse>(
          `/api/appointments/availability?${searchParams.toString()}`,
          {
            signal: controller.signal,
          }
        )

        if (controller.signal.aborted) {
          return
        }

        if (mode === 'day' && response.mode === 'day') {
          setDayResponse(response)
          return
        }

        if (mode === 'nearest' && response.mode === 'nearest') {
          setNearestResponse(response)
          return
        }

        setError('پاسخ بررسی زمان کامل نبود.')
      } catch (err) {
        if (controller.signal.aborted) {
          return
        }
        setError(err instanceof HttpError ? err.message : 'خطایی رخ داد. دوباره تلاش کنید.')
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null
        }
        setLoadingMode((current) => (current === mode ? null : current))
      }
    },
    [date, serviceId, staffSelection]
  )

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      resetDrawer()
    } else {
      clearResults()
    }
    onOpenChange(nextOpen)
  }

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      resetDrawer()
    }
    wasOpenRef.current = open
  }, [open, resetDrawer])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const handleServiceChange = (nextServiceId: string) => {
    setValue('serviceId', nextServiceId, { shouldValidate: false })
    const nextEligibleStaff = eligibleStaffForService(staffRoleOnly, nextServiceId)
    if (
      staffSelection !== ANY_STAFF_VALUE &&
      !nextEligibleStaff.some((member) => member.id === staffSelection)
    ) {
      setValue('staffSelection', ANY_STAFF_VALUE, { shouldValidate: false })
    }
    clearResults()
  }

  const handleStaffChange = (nextStaffSelection: string) => {
    setValue('staffSelection', nextStaffSelection, { shouldValidate: false })
    clearResults()
  }

  const handleDateChange = (nextDate: string) => {
    setValue('date', nextDate, { shouldValidate: false })
    clearResults()
  }

  const handleDayNavigation = (deltaDays: number) => {
    const nextDate = addDaysYmd(date, deltaDays)
    setValue('date', nextDate, { shouldValidate: false })
    setError('')
    if (!serviceId) {
      setDayResponse(null)
      setNearestResponse(null)
      return
    }
    void runSearch('day', nextDate)
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="data-[vaul-drawer-direction=bottom]:max-h-[96lvh] flex min-h-0 flex-col">
        <DrawerHeader className="pb-3 text-start">
          <DrawerTitle>بررسی زمان خالی</DrawerTitle>
          <DrawerDescription>
            خدمت و تاریخ را انتخاب کنید تا زمان‌های قابل رزرو برای مدیر نمایش داده شود.
          </DrawerDescription>
        </DrawerHeader>

        <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel>خدمت</FieldLabel>
              <ServicePicker
                services={activeServices}
                value={serviceId || undefined}
                onChange={handleServiceChange}
                showPrice={false}
              />
              {errors.serviceId && <FieldError>{errors.serviceId.message}</FieldError>}
            </Field>

            <Field>
              <FieldLabel>پرسنل</FieldLabel>
              <Select
                value={staffSelection}
                onValueChange={handleStaffChange}
                disabled={!serviceId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={serviceId ? 'انتخاب پرسنل' : 'اول خدمت را انتخاب کنید'}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY_STAFF_VALUE}>هر پرسنل واجد شرایط</SelectItem>
                  {eligibleStaff.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="availability-date">تاریخ</FieldLabel>
              <JalaliDatePicker
                id="availability-date"
                value={date}
                onChange={handleDateChange}
                required
              />
              {errors.date && <FieldError>{errors.date.message}</FieldError>}
            </Field>

            <Button
              type="button"
              className="h-11 gap-2 rounded-2xl"
              disabled={!serviceId || !isOnline || loadingMode === 'day'}
              onClick={() => void runSearch('day')}
            >
              {loadingMode === 'day' ? <Spinner className="size-4" /> : <Search className="size-4" />}
              {loadingMode === 'day' ? 'در حال بررسی...' : 'بررسی زمان'}
            </Button>

            {!isOnline ? (
              <Alert className="border-amber-400/30 bg-amber-50/80 text-amber-900">
                <AlertTriangle className="size-4" />
                <AlertDescription className="text-amber-900/80">
                  بررسی زمان در نسخه اول فقط به‌صورت آنلاین کار می‌کند.
                </AlertDescription>
              </Alert>
            ) : null}

            {error ? <FieldError>{error}</FieldError> : null}

            {hasVisibleResults ? (
              <Alert className="border-primary/20 bg-primary/5 text-primary">
                <AlertTriangle className="size-4" />
                <AlertDescription className="text-primary/85">
                  این زمان‌ها پیشنهادی هستند و تایید نهایی هنگام ثبت نوبت انجام می‌شود.
                </AlertDescription>
              </Alert>
            ) : null}

            {dayResponse ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card px-3 py-3 shadow-sm">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">تاریخ انتخاب‌شده</p>
                    <p className="truncate text-sm font-semibold">{formatJalaliFullDate(date)}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    <CalendarDays className="size-3.5" />
                    {groupedSlots.length > 0
                      ? `${toPersianDigits(dayResponse.slots.length)} زمان`
                      : 'بدون زمان'}
                  </Badge>
                </div>

                {groupedSlots.length > 0 ? (
                  <div className="space-y-3">
                    {groupedSlots.map((group) => (
                      <div
                        key={group.staffId}
                        className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm"
                      >
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{group.staffName}</p>
                            <p className="text-xs text-muted-foreground">
                              {toPersianDigits(group.slots.length)} زمان قابل رزرو
                            </p>
                          </div>
                          <Badge variant="secondary" className="text-[10px]">
                            اولین زمان {formatPersianTime(group.slots[0]!.startTime)}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          {group.slots.map((slot) => (
                            <button
                              key={`${slot.staffId}:${slot.date}:${slot.startTime}`}
                              type="button"
                              onClick={() => onSelectSlot({ slot, serviceId })}
                              className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background px-3 py-3 text-start transition-colors hover:border-primary/30 hover:bg-primary/5"
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-medium">
                                  {formatPersianTime(slot.startTime)} تا {formatPersianTime(slot.endTime)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  رزرو با {slot.staffName}
                                </p>
                              </div>
                              <Sparkles className="size-4 shrink-0 text-primary" />
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3 rounded-2xl border border-dashed border-border/70 bg-muted/30 p-4 text-center">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">زمان خالی پیدا نشد</p>
                      <p className="text-sm text-muted-foreground">
                        {emptyReasonCopy(dayResponse.emptyReason)}
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full gap-2 rounded-2xl"
                      disabled={!serviceId || !isOnline || loadingMode === 'nearest'}
                      onClick={() => void runSearch('nearest')}
                    >
                      {loadingMode === 'nearest' ? (
                        <Spinner className="size-4" />
                      ) : (
                        <Clock3 className="size-4" />
                      )}
                      {loadingMode === 'nearest'
                        ? 'در حال جستجوی نزدیک‌ترین زمان...'
                        : 'نزدیک‌ترین زمان را پیدا کن'}
                    </Button>

                    {nearestResponse?.slot ? (
                      <button
                        type="button"
                        onClick={() => onSelectSlot({ slot: nearestResponse.slot!, serviceId })}
                        className={cn(
                          'w-full rounded-2xl border border-primary/30 bg-primary/5 px-4 py-4 text-start shadow-sm transition-colors hover:bg-primary/8'
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <p className="text-sm font-semibold">نزدیک‌ترین زمان</p>
                            <p className="text-xs text-muted-foreground">
                              {formatJalaliFullDate(nearestResponse.slot.date)}
                            </p>
                          </div>
                          <Badge className="bg-primary text-primary-foreground hover:bg-primary">
                            {nearestResponse.slot.staffName}
                          </Badge>
                        </div>
                        <p className="mt-3 text-sm font-medium">
                          {formatPersianTime(nearestResponse.slot.startTime)} تا{' '}
                          {formatPersianTime(nearestResponse.slot.endTime)}
                        </p>
                      </button>
                    ) : nearestResponse ? (
                      <p className="text-xs text-muted-foreground">
                        {emptyReasonCopy(nearestResponse.emptyReason)}
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                className="gap-2 rounded-2xl"
                onClick={() => handleDayNavigation(-1)}
              >
                <ChevronRight className="size-4" />
                روز قبل
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-2 rounded-2xl"
                onClick={() => handleDayNavigation(1)}
              >
                روز بعد
                <ChevronLeft className="size-4" />
              </Button>
            </div>
          </FieldGroup>
        </div>

        <DrawerFooter className="border-t border-border/60 bg-background">
          <DrawerClose asChild>
            <Button variant="outline">بستن</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
