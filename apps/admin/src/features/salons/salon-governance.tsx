import type {
  AdminNoteCreateRequest,
  AdminNotesResponse,
  AdminSalonStatus,
  AdminSalonStatusUpdateRequest,
} from '@repo/api-client/types'
import { Plus, RefreshCw } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { TextAreaField } from '#/components/admin/form-field'
import {
  LiveConfirmationInput,
  LiveDataWarning,
  liveConfirmationFromForm,
} from '#/components/admin/live-data-form'
import { MutationError } from '#/components/admin/mutation-error'
import { ScreenSkeleton } from '#/components/admin/screen-skeleton'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { formatDate } from '#/lib/admin-format'

import { ErrorPanel } from '#/components/admin/error-panel'

import { normalizeStatus, StatusBadge } from './salon-columns'
import { Panel } from '#/components/admin/panel'

export type MutationSubmitOptions = {
  onSuccess?: () => void
}

export function StatusForm({
  current,
  error,
  isLiveData,
  pending,
  onSubmit,
}: {
  current: AdminSalonStatus
  error: unknown
  isLiveData: boolean
  pending: boolean
  onSubmit: (
    input: AdminSalonStatusUpdateRequest,
    options?: MutationSubmitOptions,
  ) => void
}) {
  const [open, setOpen] = useState(false)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(event.currentTarget)
    onSubmit(
      {
        status: normalizeStatus(form.get('status')),
        reason: String(form.get('reason') ?? ''),
        liveConfirmation: liveConfirmationFromForm(form, isLiveData),
      },
      {
        onSuccess: () => {
          formElement.reset()
          setOpen(false)
        },
      },
    )
  }

  return (
    <Panel title="تغییر وضعیت">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">وضعیت فعلی</span>
          <StatusBadge status={current} />
        </div>
        <MutationError error={error} />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full" type="button">
              <RefreshCw className="h-4 w-4" />
              تغییر وضعیت
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>تغییر وضعیت سالن</DialogTitle>
              <DialogDescription>
                دلیل این تغییر را برای ثبت در گزارش ممیزی وارد کنید.
              </DialogDescription>
            </DialogHeader>
            <form
              aria-label="تغییر وضعیت سالن"
              className="space-y-3"
              onSubmit={submit}
            >
              <LiveDataWarning
                show={isLiveData}
                message="تغییر وضعیت سالن روی داده‌های زنده تولیدی اعمال می‌شود. برای ادامه LIVE را وارد کنید."
              />
              <SelectField
                label="وضعیت"
                name="status"
                defaultValue={current}
                options={[
                  ['active', 'فعال'],
                  ['suspended', 'تعلیق‌شده'],
                  ['archived', 'آرشیوشده'],
                ]}
              />
              <TextAreaField
                label="دلیل"
                name="reason"
                placeholder="ثبت دلیل برای گزارش ممیزی الزامی است"
                rows={3}
                required
              />
              <LiveConfirmationInput show={isLiveData} />
              <DialogFooter>
                <Button type="submit" disabled={pending}>
                  <RefreshCw className="h-4 w-4" />
                  به‌روزرسانی وضعیت
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </Panel>
  )
}

export function NotesPanel({
  error,
  isError,
  isLoading,
  notes,
  pending,
  onRetry,
  onSubmit,
}: {
  error: unknown
  isError: boolean
  isLoading: boolean
  notes: AdminNotesResponse['notes']
  pending: boolean
  onRetry: () => void
  onSubmit: (
    input: AdminNoteCreateRequest,
    options?: MutationSubmitOptions,
  ) => void
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(event.currentTarget)
    onSubmit(
      {
        body: String(form.get('body') ?? ''),
        reason: String(form.get('reason') ?? ''),
      },
      {
        onSuccess: () => {
          formElement.reset()
        },
      },
    )
  }

  return (
    <Panel title="یادداشت‌های داخلی">
      <form className="space-y-3" onSubmit={submit}>
        <TextAreaField label="یادداشت" name="body" rows={3} required />
        <Input name="reason" placeholder="ثبت دلیل برای گزارش ممیزی الزامی است" required />
        <MutationError error={error} />
        <Button type="submit" disabled={pending}>
          <Plus className="h-4 w-4" />
          افزودن یادداشت
        </Button>
      </form>
      <div className="mt-4 space-y-2">
        {isLoading ? <ScreenSkeleton label="در حال بارگذاری یادداشت‌ها" /> : null}
        {isError ? (
          <ErrorPanel message="بارگذاری یادداشت‌ها ناموفق بود." onRetry={onRetry} />
        ) : null}
        {!isLoading && !isError && notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            هنوز یادداشتی ثبت نشده است.
          </p>
        ) : null}
        {!isLoading && !isError
          ? notes.map((note) => (
              <div key={note.id} className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>{note.authorName}</span>
                  <span>{formatDate(note.createdAt)}</span>
                </div>
                <p className="mt-2 text-sm leading-6">{note.body}</p>
              </div>
            ))
          : null}
      </div>
    </Panel>
  )
}

function SelectField({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string
  name: string
  defaultValue: string
  options: Array<[string, string]>
}) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {options.map(([value, optionLabel]) => (
          <option key={value} value={value}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  )
}
