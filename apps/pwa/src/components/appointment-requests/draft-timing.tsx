import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { addDaysYmd, salonTodayYmd } from '@repo/salon-core/salon-local-time'
import {
  nextSalonWeekDates,
  normalizeAcceptableDates,
  isStartTimeInPreference,
  TIME_PREFERENCE_BOUNDS,
  type TimePreference,
} from '@repo/salon-core/appointment-request-timing'
import { formatJalaliFullDate } from '@repo/salon-core/jalali'
import { eligibleStaffForService } from '@repo/salon-core/staff-service-autofill'
import { toPersianDigits } from '@repo/salon-core/persian-digits'
import type { User } from '@repo/salon-core/types'
import { Button } from '@repo/ui/button'
import { Input } from '@repo/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/select'
import { Spinner } from '@repo/ui/spinner'
import { Textarea } from '@repo/ui/textarea'

import {
  useUpdateDraftMutation,
  useConvertDraftMutation,
  type FlexibleAppointmentRequestListItem,
} from '#/lib/appointment-requests-queries'
import {
  FormSheet,
  FormSheetBody,
  FormSheetContent,
  FormSheetDescription,
  FormSheetFooter,
  FormSheetHeader,
  FormSheetTitle,
} from '#/components/form-sheet'

export const DRAFT_TIME_PREFERENCE_LABELS = {
  morning: 'صبح',
  afternoon: 'بعدازظهر',
  evening: 'عصر',
  any: 'هر زمان',
} as const

export function DraftTimingFields({
  dates,
  onDatesChange,
  timePreference,
  onTimePreferenceChange,
  notes,
  onNotesChange,
  notesReadOnly = false,
}: {
  dates: string[]
  onDatesChange: (dates: string[]) => void
  timePreference: TimePreference
  onTimePreferenceChange: (preference: TimePreference) => void
  notes: string
  onNotesChange: (notes: string) => void
  notesReadOnly?: boolean
}) {
  const today = salonTodayYmd()
  const maxDate = addDaysYmd(today, 30)
  return (
    <>
      <div className="space-y-2">
        <p className="text-sm font-medium">تاریخ‌های قابل قبول</p>
        {dates.map((date, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              type="date"
              min={today}
              max={maxDate}
              value={date}
              onChange={(event) =>
                onDatesChange(
                  dates.map((value, i) =>
                    i === index ? event.target.value : value,
                  ),
                )
              }
            />
            {dates.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="حذف تاریخ"
                onClick={() =>
                  onDatesChange(dates.filter((_, i) => i !== index))
                }
              >
                <X className="size-4" />
              </Button>
            ) : null}
          </div>
        ))}
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onDatesChange([...dates, ''])}
          >
            <Plus className="size-3.5" /> تاریخ دیگر
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onDatesChange(nextSalonWeekDates(today))}
          >
            هفته آینده
          </Button>
        </div>
      </div>
      <label className="block space-y-2 text-sm font-medium">
        ترجیح زمانی
        <Select
          value={timePreference}
          onValueChange={(value) =>
            onTimePreferenceChange(value as TimePreference)
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(DRAFT_TIME_PREFERENCE_LABELS).map(
              ([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
      </label>
      <label className="block space-y-2 text-sm font-medium">
        {notesReadOnly ? 'یادداشت کپی‌شده' : 'یادداشت (اختیاری)'}
        <Textarea
          value={notes}
          readOnly={notesReadOnly}
          onChange={(event) => onNotesChange(event.target.value)}
        />
      </label>
    </>
  )
}

export function EditDraftSheet({
  draft,
  open,
  onOpenChange,
}: {
  draft: FlexibleAppointmentRequestListItem
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const today = salonTodayYmd()
  const elapsedDates = draft.acceptableDates.filter((date) => date < today)
  const [dates, setDates] = useState(() => {
    const currentDates = draft.acceptableDates.filter((date) => date >= today)
    return currentDates.length > 0 ? currentDates : ['']
  })
  const [timePreference, setTimePreference] = useState(draft.timePreference)
  const [notes, setNotes] = useState(draft.notes ?? '')
  const [errorMessage, setErrorMessage] = useState('')
  const updateDraft = useUpdateDraftMutation()

  const submit = () => {
    let acceptableDates: string[]
    try {
      acceptableDates = normalizeAcceptableDates(dates, salonTodayYmd())
    } catch {
      setErrorMessage('تاریخ‌ها باید یکتا و در ۳۰ روز آینده باشند')
      return
    }
    updateDraft.mutate(
      {
        requestId: draft.id,
        body: {
          acceptableDates,
          timePreference,
          notes: notes.trim() || null,
        },
      },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <FormSheet open={open} onOpenChange={onOpenChange}>
      <FormSheetContent onRequestClose={() => onOpenChange(false)}>
        <FormSheetHeader>
          <FormSheetTitle>ویرایش زمان پیش‌نویس</FormSheetTitle>
        </FormSheetHeader>
        <FormSheetBody className="space-y-5 px-5 py-4">
          <div className="rounded-xl bg-background p-3 text-sm">
            <p className="font-bold">
              {draft.existingClient?.name ?? draft.customerName}
            </p>
            <p className="text-muted-foreground">{draft.bookedServiceName}</p>
            {elapsedDates.length > 0 ? (
              <p className="mt-2 text-xs text-muted-foreground line-through">
                {elapsedDates.map(formatJalaliFullDate).join('، ')}
              </p>
            ) : null}
          </div>
          <DraftTimingFields
            dates={dates}
            onDatesChange={setDates}
            timePreference={timePreference}
            onTimePreferenceChange={setTimePreference}
            notes={notes}
            onNotesChange={setNotes}
          />
          {errorMessage ? (
            <p className="text-xs text-destructive">{errorMessage}</p>
          ) : null}
        </FormSheetBody>
        <FormSheetFooter>
          <Button size="lg" onClick={submit} disabled={updateDraft.isPending}>
            {updateDraft.isPending ? <Spinner className="size-4" /> : 'ذخیره'}
          </Button>
        </FormSheetFooter>
      </FormSheetContent>
    </FormSheet>
  )
}

export function ConvertDraftSheet({
  draft,
  staff,
  open,
  onOpenChange,
}: {
  draft: FlexibleAppointmentRequestListItem
  staff: User[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const today = salonTodayYmd()
  const remainingDates = draft.acceptableDates.filter((date) => date >= today)
  const capableStaff = eligibleStaffForService(
    staff.filter((member) => member.role === 'staff'),
    draft.serviceId,
  )
  const bounds = TIME_PREFERENCE_BOUNDS[draft.timePreference]
  const [finalDate, setFinalDate] = useState(remainingDates[0] ?? '')
  const [startTime, setStartTime] = useState(
    draft.timePreference === 'any' ? '09:00' : bounds.min,
  )
  const [staffId, setStaffId] = useState('')
  const convertDraft = useConvertDraftMutation()
  const startTimeValid = isStartTimeInPreference(
    startTime,
    draft.timePreference,
  )

  const submit = () => {
    if (!finalDate || !startTimeValid || !staffId) return
    convertDraft.mutate(
      {
        requestId: draft.id,
        body: { finalDate, startTime, staffId },
      },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <FormSheet open={open} onOpenChange={onOpenChange}>
      <FormSheetContent onRequestClose={() => onOpenChange(false)}>
        <FormSheetHeader>
          <FormSheetTitle>تبدیل پیش‌نویس به نوبت</FormSheetTitle>
          <FormSheetDescription>
            تاریخ، ساعت شروع و پرسنل نوبت را انتخاب کنید.
          </FormSheetDescription>
        </FormSheetHeader>
        <FormSheetBody className="space-y-5 px-5 py-4">
          <div className="space-y-3 rounded-2xl border border-line-soft bg-background p-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">مشتری</p>
              <p className="font-bold">
                {draft.existingClient?.name ?? draft.customerName}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-dashed border-border pt-3">
              <div>
                <p className="text-xs text-muted-foreground">خدمت ثبت‌شده</p>
                <p className="font-semibold">{draft.bookedServiceName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">مدت و مبلغ</p>
                <p className="font-semibold">
                  {toPersianDigits(draft.bookedServiceDuration)} دقیقه ·{' '}
                  {toPersianDigits(
                    draft.bookedServicePrice.toLocaleString('en-US'),
                  )}{' '}
                  تومان
                </p>
              </div>
            </div>
            <div className="border-t border-dashed border-border pt-3">
              <p className="text-xs text-muted-foreground">
                تاریخ‌های قابل قبول
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {draft.acceptableDates.map((date) => (
                  <span
                    key={date}
                    className={`rounded-lg bg-card px-2 py-1 text-xs ${date < today ? 'text-muted-foreground line-through' : ''}`}
                  >
                    {formatJalaliFullDate(date)}
                  </span>
                ))}
              </div>
            </div>
            <p className="border-t border-dashed border-border pt-3">
              <span className="text-xs text-muted-foreground">
                ترجیح زمانی:{' '}
              </span>
              {DRAFT_TIME_PREFERENCE_LABELS[draft.timePreference]}
            </p>
            {draft.notes ? (
              <p className="border-t border-dashed border-border pt-3 text-muted-foreground">
                {draft.notes}
              </p>
            ) : null}
          </div>

          <label className="block space-y-2 text-sm font-medium">
            تاریخ نهایی
            <Select value={finalDate} onValueChange={setFinalDate}>
              <SelectTrigger>
                <SelectValue placeholder="انتخاب تاریخ" />
              </SelectTrigger>
              <SelectContent>
                {remainingDates.map((date) => (
                  <SelectItem key={date} value={date}>
                    {formatJalaliFullDate(date)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="block space-y-2 text-sm font-medium">
            ساعت شروع
            <Input
              type="time"
              value={startTime}
              min={bounds.min}
              max={bounds.max}
              onChange={(event) => setStartTime(event.target.value)}
            />
          </label>
          <label className="block space-y-2 text-sm font-medium">
            پرسنل
            <Select value={staffId} onValueChange={setStaffId}>
              <SelectTrigger>
                <SelectValue placeholder="انتخاب پرسنل" />
              </SelectTrigger>
              <SelectContent>
                {capableStaff.length > 0 ? (
                  capableStaff.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="__none__" disabled>
                    پرسنل فعالی برای این خدمت وجود ندارد
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </label>
          {remainingDates.length === 0 ? (
            <p className="text-xs text-destructive">
              تاریخ قابل زمان‌بندی برای این پیش‌نویس باقی نمانده است.
            </p>
          ) : null}
        </FormSheetBody>
        <FormSheetFooter>
          <Button
            size="lg"
            onClick={submit}
            disabled={
              convertDraft.isPending ||
              !finalDate ||
              !startTimeValid ||
              !staffId ||
              capableStaff.length === 0
            }
          >
            {convertDraft.isPending ? (
              <Spinner className="size-4" />
            ) : (
              'ثبت نوبت'
            )}
          </Button>
        </FormSheetFooter>
      </FormSheetContent>
    </FormSheet>
  )
}
