import { Switch } from '@repo/ui/switch'
import { Textarea } from '@repo/ui/textarea'
import { FieldError } from '@repo/ui/field'
import { cn } from '@repo/ui/utils'
import { toPersianDigits } from '@repo/salon-core/persian-digits'

function BioCharCounter({
  length,
  maxLength,
  className,
}: {
  length: number
  maxLength: number
  className?: string
}) {
  const over = length > maxLength
  return (
    <span
      className={cn(
        'text-[11px] tabular-nums',
        over ? 'text-destructive' : 'text-muted-foreground',
        className,
      )}
    >
      {toPersianDigits(length)}/{toPersianDigits(maxLength)}
    </span>
  )
}

export function PublicEnabledSwitch({
  enabled,
  onEnabledChange,
  label = 'صفحه‌ی عمومی فعال باشد',
}: {
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  label?: string
}) {
  return (
    <label className="flex items-center gap-3 rounded-2xl border border-line-soft bg-card p-4">
      <Switch checked={enabled} onCheckedChange={onEnabledChange} />
      <span className="flex-1 text-sm font-bold text-foreground">{label}</span>
    </label>
  )
}

export function PublicBioField({
  bio,
  onBioChange,
  maxLength,
  error,
  placeholder = 'یک خط کوتاه درباره سالن‌تان',
  rows,
  className,
  label,
}: {
  bio: string
  onBioChange: (bio: string) => void
  maxLength: number
  error?: string
  placeholder?: string
  rows?: number
  className?: string
  label?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={cn(
          'px-1',
          label ? 'flex items-center justify-between' : 'flex justify-end',
        )}
      >
        {label && (
          <span className="text-xs font-semibold text-sage-deep">{label}</span>
        )}
        <BioCharCounter length={bio.length} maxLength={maxLength} />
      </div>
      <Textarea
        placeholder={placeholder}
        rows={rows}
        className={cn('min-h-24 text-right', className)}
        dir="rtl"
        value={bio}
        maxLength={maxLength + 50}
        onChange={(e) => onBioChange(e.target.value)}
      />
      {error && <FieldError>{error}</FieldError>}
    </div>
  )
}

export function PublicPageBasicsFields({
  enabled,
  onEnabledChange,
  bio,
  onBioChange,
  bioMaxLength,
  bioError,
  showCustomizeHint = true,
}: {
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  bio: string
  onBioChange: (bio: string) => void
  bioMaxLength: number
  bioError?: string
  showCustomizeHint?: boolean
}) {
  return (
    <>
      <PublicEnabledSwitch
        enabled={enabled}
        onEnabledChange={onEnabledChange}
      />

      <PublicBioField
        label="معرفی کوتاه سالن"
        bio={bio}
        onBioChange={onBioChange}
        maxLength={bioMaxLength}
        error={bioError}
      />

      {showCustomizeHint && (
        <p className="rounded-xl bg-blush-soft px-3.5 py-3 text-xs leading-relaxed text-sage-deep">
          می‌توانید بعداً تم، چیدمان و خدمات قابل نمایش را در «صفحه عمومی»
          سفارشی کنید.
        </p>
      )}
    </>
  )
}

export function PublicBioCard({
  bio,
  onBioChange,
  maxLength,
}: {
  bio: string
  onBioChange: (bio: string) => void
  maxLength: number
}) {
  return (
    <div className="rounded-2xl bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold text-muted-foreground">
          درباره
        </div>
        <BioCharCounter length={bio.length} maxLength={maxLength} />
      </div>
      <Textarea
        rows={3}
        value={bio}
        maxLength={maxLength + 50}
        onChange={(e) => onBioChange(e.target.value)}
        placeholder="چند خط معرفی کوتاه از سالن…"
        className="resize-none rounded-lg bg-muted/30 px-3 py-2.5 leading-relaxed"
      />
    </div>
  )
}
