import { useRef } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  createSupportTicketSchema,
  type CreateSupportTicketInput,
  type CreateSupportTicketPayload,
} from '@repo/salon-core/support-tickets'
import { toPersianDigits } from '@repo/salon-core/persian-digits'
import { Button } from '@repo/ui/button'
import { Input } from '@repo/ui/input'
import { Label } from '@repo/ui/label'
import { Spinner } from '@repo/ui/spinner'
import { Textarea } from '@repo/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/select'
import { useCreateSupportTicketMutation } from '#/lib/support-ticket-queries'
import { supportCategoryLabels } from './support-ticket-status'

const errorText = (message?: string) =>
  message === 'Required' || message?.startsWith('Invalid option')
    ? 'این فیلد الزامی است.'
    : message?.startsWith('Must')
      ? 'متن طولانی‌تر از حد مجاز است.'
      : message

export function SupportTicketCreateForm() {
  const submittingRef = useRef(false)
  const mutation = useCreateSupportTicketMutation()
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateSupportTicketInput, unknown, CreateSupportTicketPayload>({
    resolver: zodResolver(createSupportTicketSchema),
    defaultValues: { category: undefined, subject: '', body: '' },
  })
  const subject = watch('subject') ?? ''
  const body = watch('body') ?? ''
  const submit = handleSubmit(async (values) => {
    if (submittingRef.current) return
    submittingRef.current = true
    try {
      await mutation.mutateAsync(values)
    } catch {
      /* mutation cache displays server error; retain form values */
    } finally {
      submittingRef.current = false
    }
  })
  const busy = isSubmitting || mutation.isPending
  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor="support-category">دسته‌بندی</Label>
        <Controller
          name="category"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value ?? ''}
              onValueChange={field.onChange}
              disabled={busy}
            >
              <SelectTrigger
                id="support-category"
                className="w-full"
                aria-invalid={Boolean(errors.category)}
              >
                <SelectValue placeholder="انتخاب دسته‌بندی" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(supportCategoryLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.category ? (
          <p className="text-xs text-destructive">
            {errorText(errors.category.message)}
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <div className="flex justify-between">
          <Label htmlFor="support-subject">موضوع</Label>
          <span className="text-xs text-muted-foreground">
            {toPersianDigits(Array.from(subject).length)} / ۱۲۰
          </span>
        </div>
        <Input
          id="support-subject"
          maxLength={120}
          disabled={busy}
          aria-invalid={Boolean(errors.subject)}
          {...register('subject')}
        />
        {errors.subject ? (
          <p className="text-xs text-destructive">
            {errorText(errors.subject.message)}
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <div className="flex justify-between">
          <Label htmlFor="support-body">شرح درخواست</Label>
          <span className="text-xs text-muted-foreground">
            {toPersianDigits(Array.from(body).length)} / ۴۰۰۰
          </span>
        </div>
        <Textarea
          id="support-body"
          maxLength={4000}
          rows={8}
          disabled={busy}
          aria-invalid={Boolean(errors.body)}
          {...register('body')}
        />
        {errors.body ? (
          <p className="text-xs text-destructive">
            {errorText(errors.body.message)}
          </p>
        ) : null}
      </div>
      {mutation.isError ? (
        <p role="alert" className="text-sm text-destructive">
          ارسال درخواست انجام نشد. متن شما حفظ شده است؛ دوباره تلاش کنید.
        </p>
      ) : null}
      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={isSubmitting || mutation.isPending}
      >
        {isSubmitting || mutation.isPending ? (
          <>
            <Spinner className="size-4" />
            در حال ارسال…
          </>
        ) : (
          'ارسال درخواست'
        )}
      </Button>
    </form>
  )
}
