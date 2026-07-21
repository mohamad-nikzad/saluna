import { useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { salonTodayYmd } from '@repo/salon-core/salon-local-time'
import {
  nextSalonWeekDates,
  normalizeAcceptableDates,
  isStartTimeInPreference,
  TIME_PREFERENCE_BOUNDS,
  type TimePreference,
} from '@repo/salon-core/appointment-request-timing'
import {
  formatJalaliFullDate,
  JALALI_MONTHS,
  JALALI_WEEKDAYS_SHORT,
  parseGregorianToJalali,
} from '@repo/salon-core/jalali'
import { eligibleStaffForService } from '@repo/salon-core/staff-service-autofill'
import { toPersianDigits } from '@repo/salon-core/persian-digits'
import type { User } from '@repo/salon-core/types'
import { Button } from '@repo/ui/button'
import { Field, FieldError, FieldLabel } from '@repo/ui/field'
import { JalaliDatePicker } from '@repo/ui/jalali-date-picker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/select'
import { Spinner } from '@repo/ui/spinner'
import { Textarea } from '@repo/ui/textarea'
import { TimePicker } from '@repo/ui/time-picker'
import { cn } from '@repo/ui/utils'

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

const TIME_PREFERENCE_OPTIONS = Object.entries(
  DRAFT_TIME_PREFERENCE_LABELS,
) as Array<[TimePreference, string]>

const numFmt = new Intl.NumberFormat('fa-IR')

/** Compact chip label: "ش ۱۲ تیر" */
export function formatAcceptableDateChip(ymd: string): string {
  const { jd, jm } = parseGregorianToJalali(ymd)
  const weekdayIndex =
    (new Date(`${ymd}T12:00:00Z`).getUTCDay() + 1) % 7
  return `${JALALI_WEEKDAYS_SHORT[weekdayIndex]} ${numFmt.format(jd)} ${JALALI_MONTHS[jm - 1]}`
}

export function formatNextWeekRangeLabel(weekDates: string[]): string {
  const start = parseGregorianToJalali(weekDates[0]!)
  const end = parseGregorianToJalali(weekDates[6]!)
  if (start.jm === end.jm) {
    return `${numFmt.format(start.jd)} تا ${numFmt.format(end.jd)} ${JALALI_MONTHS[start.jm - 1]}`
  }
  return `${numFmt.format(start.jd)} ${JALALI_MONTHS[start.jm - 1]} تا ${numFmt.format(end.jd)} ${JALALI_MONTHS[end.jm - 1]}`
}

function TimePreferencePicker({
  value,
  onChange,
}: {
  value: TimePreference
  onChange: (preference: TimePreference) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label="ترجیح زمانی"
      className="grid grid-cols-2 gap-2"
      dir="rtl"
    >
      {TIME_PREFERENCE_OPTIONS.map(([option, label]) => {
        const selected = value === option
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option)}
            className={cn(
              'min-h-11 rounded-xl border px-3 text-sm font-semibold transition-colors touch-manipulation',
              selected
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-line-soft bg-blush-soft text-foreground hover:border-primary/30',
            )}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

function NextWeekDayStrip({
  weekDates,
  selectedDates,
  onToggle,
}: {
  weekDates: string[]
  selectedDates: ReadonlySet<string>
  onToggle: (ymd: string) => void
}) {
  return (
    <div
      role="group"
      aria-label="روزهای هفته آینده"
      className="grid grid-cols-7 gap-1.5"
      dir="rtl"
    >
      {weekDates.map((ymd, index) => {
        const { jd } = parseGregorianToJalali(ymd)
        const selected = selectedDates.has(ymd)
        return (
          <button
            key={ymd}
            type="button"
            aria-pressed={selected}
            aria-label={`${JALALI_WEEKDAYS_SHORT[index]} ${numFmt.format(jd)}`}
            onClick={() => onToggle(ymd)}
            className={cn(
              'relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-center transition-colors touch-manipulation',
              selected
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted/45 text-muted-foreground ring-1 ring-inset ring-border/70 hover:bg-muted hover:text-foreground hover:ring-border',
            )}
          >
            <span
              className={cn(
                'text-[10px] font-bold leading-none',
                selected ? 'text-primary-foreground/90' : 'text-muted-foreground/80',
              )}
            >
              {JALALI_WEEKDAYS_SHORT[index]}
            </span>
            <span
              className={cn(
                'text-sm font-semibold tabular-nums leading-none',
                !selected && 'opacity-55',
              )}
            >
              {numFmt.format(jd)}
            </span>
            {!selected ? (
              <span
                aria-hidden="true"
                className="absolute inset-x-2 top-1/2 h-px -translate-y-1/2 rotate-[-28deg] bg-muted-foreground/25"
              />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

function AcceptableDatesField({
  dates,
  onDatesChange,
}: {
  dates: string[]
  onDatesChange: (dates: string[]) => void
}) {
  const today = salonTodayYmd()
  const weekDates = useMemo(() => nextSalonWeekDates(today), [today])
  const weekSet = useMemo(() => new Set(weekDates), [weekDates])
  const selected = useMemo(
    () => new Set(dates.filter(Boolean)),
    [dates],
  )
  const weekSelectedCount = weekDates.filter((date) => selected.has(date)).length
  const [weekPanelOpen, setWeekPanelOpen] = useState(weekSelectedCount > 0)
  const [pickerOpen, setPickerOpen] = useState(false)

  const extraDates = dates
    .filter((date) => date && !weekSet.has(date))
    .sort()

  const commitDates = (next: Iterable<string>) => {
    onDatesChange([...new Set(next)].filter(Boolean).sort())
  }

  const toggleWeekDay = (ymd: string) => {
    const next = new Set(selected)
    if (next.has(ymd)) next.delete(ymd)
    else next.add(ymd)
    commitDates(next)
    setWeekPanelOpen(true)
  }

  const selectWholeWeek = () => {
    const next = new Set(selected)
    for (const date of weekDates) next.add(date)
    commitDates(next)
    setWeekPanelOpen(true)
  }

  const clearWeek = () => {
    commitDates([...selected].filter((date) => !weekSet.has(date)))
    setWeekPanelOpen(false)
  }

  const removeDate = (ymd: string) => {
    commitDates([...selected].filter((date) => date !== ymd))
  }

  const addDate = (ymd: string) => {
    if (weekSet.has(ymd)) {
      const next = new Set(selected)
      next.add(ymd)
      commitDates(next)
      setWeekPanelOpen(true)
      return
    }
    commitDates([...selected, ymd])
  }

  const showWeekPanel = weekPanelOpen || weekSelectedCount > 0

  return (
    <Field>
      <FieldLabel>تاریخ‌های قابل قبول</FieldLabel>
      <div className="space-y-3">
        {showWeekPanel ? (
          <div className="space-y-3 rounded-2xl border border-line-soft bg-background p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">هفته آینده</p>
                <p className="text-xs text-muted-foreground">
                  {formatNextWeekRangeLabel(weekDates)}
                  {weekSelectedCount > 0
                    ? ` · ${toPersianDigits(weekSelectedCount)} روز`
                    : ' · روزها را انتخاب کنید'}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                {weekSelectedCount < 7 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={selectWholeWeek}
                  >
                    همه
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs text-muted-foreground"
                  onClick={clearWeek}
                >
                  حذف
                </Button>
              </div>
            </div>
            <NextWeekDayStrip
              weekDates={weekDates}
              selectedDates={selected}
              onToggle={toggleWeekDay}
            />
            <p className="text-[11px] text-muted-foreground">
              روزهای روشن یعنی مشتری در آن روزها در دسترس است.
            </p>
          </div>
        ) : null}

        {extraDates.length > 0 ? (
          <div className="flex flex-wrap gap-1.5" dir="rtl">
            {extraDates.map((date) => {
              const label = formatAcceptableDateChip(date)
              return (
                <span
                  key={date}
                  className="inline-flex h-9 items-center gap-1 rounded-full border border-line-soft bg-blush-soft py-1 pe-1 ps-3 text-xs font-semibold text-foreground"
                >
                  {label}
                  <button
                    type="button"
                    aria-label={`حذف ${label}`}
                    onClick={() => removeDate(date)}
                    className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              )
            })}
          </div>
        ) : null}

        {!showWeekPanel && extraDates.length === 0 ? (
          <p className="rounded-xl bg-blush-soft/70 px-3 py-2.5 text-xs text-muted-foreground">
            چند تاریخ پیشنهادی انتخاب کنید، یا یک‌ضرب هفته آینده را باز کنید.
          </p>
        ) : null}

        <div
          className={cn(
            'grid gap-2',
            showWeekPanel ? 'grid-cols-1' : 'grid-cols-2',
          )}
        >
          <Button
            type="button"
            variant="outline"
            onClick={() => setPickerOpen(true)}
          >
            <Plus className="size-3.5" /> افزودن تاریخ
          </Button>
          {showWeekPanel ? null : (
            <Button type="button" variant="outline" onClick={selectWholeWeek}>
              هفته آینده
            </Button>
          )}
        </div>

        <JalaliDatePicker
          id="acceptable-date-add"
          value=""
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onChange={(date) => {
            addDate(date)
            setPickerOpen(false)
          }}
          className="hidden"
        />
      </div>
    </Field>
  )
}

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
  return (
    <>
      <AcceptableDatesField dates={dates} onDatesChange={onDatesChange} />
      <Field>
        <FieldLabel>ترجیح زمانی</FieldLabel>
        <TimePreferencePicker
          value={timePreference}
          onChange={onTimePreferenceChange}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="draft-notes">
          {notesReadOnly ? 'یادداشت کپی‌شده' : 'یادداشت (اختیاری)'}
        </FieldLabel>
        <Textarea
          id="draft-notes"
          value={notes}
          readOnly={notesReadOnly}
          onChange={(event) => onNotesChange(event.target.value)}
          rows={3}
          placeholder={notesReadOnly ? undefined : 'توضیح کوتاه برای سالن…'}
        />
      </Field>
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
  const [dates, setDates] = useState(() =>
    draft.acceptableDates.filter((date) => date >= today),
  )
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
            <FieldError>{errorMessage}</FieldError>
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

function ConvertFinalDatePicker({
  remainingDates,
  value,
  onChange,
}: {
  remainingDates: string[]
  value: string
  onChange: (ymd: string) => void
}) {
  const suggested = new Set(remainingDates)
  const isManual = Boolean(value) && !suggested.has(value)

  return (
    <Field>
      <FieldLabel htmlFor="convert-final-date">تاریخ نهایی</FieldLabel>
      <div className="space-y-2.5">
        {remainingDates.length > 0 ? (
          <div
            role="radiogroup"
            aria-label="تاریخ‌های پیشنهادی"
            className="flex flex-wrap gap-1.5"
            dir="rtl"
          >
            {remainingDates.map((date) => {
              const { jd } = parseGregorianToJalali(date)
              const weekdayIndex =
                (new Date(`${date}T12:00:00Z`).getUTCDay() + 1) % 7
              const selected = value === date
              return (
                <button
                  key={date}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={formatAcceptableDateChip(date)}
                  onClick={() => onChange(date)}
                  className={cn(
                    'flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-xl px-2.5 py-1.5 transition-colors touch-manipulation',
                    selected
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted/45 text-muted-foreground ring-1 ring-inset ring-border/70 hover:bg-muted hover:text-foreground',
                  )}
                >
                  <span className="text-[10px] font-bold leading-none">
                    {JALALI_WEEKDAYS_SHORT[weekdayIndex]}
                  </span>
                  <span className="text-sm font-semibold tabular-nums leading-none">
                    {numFmt.format(jd)}
                  </span>
                </button>
              )
            })}
          </div>
        ) : null}
        <JalaliDatePicker
          id="convert-final-date"
          value={value}
          onChange={onChange}
        />
        {isManual ? (
          <p className="text-xs text-muted-foreground">
            تاریخ دستی انتخاب شد — خارج از پیشنهادهای ثبت‌شده مشتری.
          </p>
        ) : remainingDates.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            تاریخ پیشنهادی باقی نمانده؛ یک تاریخ دستی انتخاب کنید.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            از پیشنهادها انتخاب کنید یا با تقویم تاریخ دیگری بگذارید.
          </p>
        )}
      </div>
    </Field>
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
                    {formatAcceptableDateChip(date)}
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

          <ConvertFinalDatePicker
            remainingDates={remainingDates}
            value={finalDate}
            onChange={setFinalDate}
          />
          <Field>
            <FieldLabel htmlFor="convert-start-time">ساعت شروع</FieldLabel>
            <TimePicker
              id="convert-start-time"
              value={startTime}
              onChange={setStartTime}
              label="ساعت شروع"
            />
            <p className="text-xs text-muted-foreground">
              بازه ترجیحی:{' '}
              <span className="tabular-nums" dir="ltr">
                {bounds.min} – {bounds.max}
              </span>
            </p>
            {!startTimeValid ? (
              <FieldError>ساعت شروع باید داخل بازه ترجیحی باشد</FieldError>
            ) : null}
          </Field>
          <Field>
            <FieldLabel>پرسنل</FieldLabel>
            <Select value={staffId} onValueChange={setStaffId}>
              <SelectTrigger className="w-full" aria-label="پرسنل">
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
          </Field>
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
