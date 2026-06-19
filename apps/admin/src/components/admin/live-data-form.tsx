import { CircleAlert } from 'lucide-react'

import { FormField } from '#/components/admin/form-field'

export function LiveDataWarning({
  show,
  message,
}: {
  show: boolean
  message: string
}) {
  if (!show) return null
  return (
    <div className="flex items-start gap-2 rounded-md border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive">
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="leading-6">{message}</p>
    </div>
  )
}

export function LiveConfirmationInput({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <FormField
      label="تأیید داده LIVE"
      name="liveConfirmation"
      placeholder="LIVE"
      pattern="LIVE"
      required
    />
  )
}

export function liveConfirmationFromForm(form: FormData, isLiveData: boolean) {
  if (!isLiveData) return undefined
  return String(form.get('liveConfirmation') ?? '')
}
