import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { addDaysYmd, salonTodayYmd } from '@repo/salon-core/salon-local-time'
import {
  nextSalonWeekDates,
  normalizeAcceptableDates,
  type TimePreference,
} from '@repo/salon-core/appointment-request-timing'
import { formatJalaliFullDate } from '@repo/salon-core/jalali'
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
  type FlexibleAppointmentRequestListItem,
} from '#/lib/appointment-requests-queries'
import {
  FormSheet,
  FormSheetBody,
  FormSheetContent,
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
}: {
  dates: string[]
  onDatesChange: (dates: string[]) => void
  timePreference: TimePreference
  onTimePreferenceChange: (preference: TimePreference) => void
  notes: string
  onNotesChange: (notes: string) => void
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
        یادداشت (اختیاری)
        <Textarea
          value={notes}
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
