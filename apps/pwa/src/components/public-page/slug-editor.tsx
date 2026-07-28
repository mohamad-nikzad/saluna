import { useEffect, useState } from 'react'
import { ApiError } from '@repo/api-client'
import type { ManagerPublicSettingsResult } from '@repo/api-client/types'
import { Button } from '@repo/ui/button'
import { FieldError } from '@repo/ui/field'
import { Input } from '@repo/ui/input'
import { slugSchema } from '@repo/salon-core/forms/slug'

import { useUpdateSalonSlugMutation } from '#/lib/salon-public-settings-queries'

import { publicSlugPrefix } from './public-url'

export function SlugEditor({
  currentSlug,
  onSaved,
}: {
  currentSlug: string
  onSaved: (result: ManagerPublicSettingsResult) => void
}) {
  const [slugDraft, setSlugDraft] = useState(currentSlug)
  const [formatError, setFormatError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    setSlugDraft(currentSlug)
    setFormatError(null)
    setSaveError(null)
  }, [currentSlug])

  const saveSlug = useUpdateSalonSlugMutation()

  const handleSaveSlug = () => {
    setSaveError(null)
    const parsed = slugSchema.safeParse(slugDraft)
    if (!parsed.success) {
      setFormatError(parsed.error.issues[0]?.message ?? 'آدرس معتبر نیست')
      return
    }
    setFormatError(null)
    if (parsed.data === currentSlug) return
    saveSlug.mutate(parsed.data, {
      onSuccess: (result) => {
        setSaveError(null)
        onSaved(result)
      },
      onError: (err) => {
        if (err instanceof ApiError && err.status === 409) {
          setSaveError(err.message || 'این آدرس سالن قبلاً ثبت شده است')
          return
        }
        setSaveError(
          err instanceof Error ? err.message : 'ذخیره آدرس انجام نشد',
        )
      },
    })
  }

  const prefix = publicSlugPrefix()
  const unchanged = slugDraft.trim() === currentSlug

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="mb-1 text-sm font-medium">آدرس صفحه عمومی</div>
        <div
          className="flex items-center gap-1 rounded-lg border bg-muted/30 p-2"
          dir="ltr"
        >
          <span className="shrink-0 text-xs text-muted-foreground">
            {prefix}
          </span>
          <Input
            value={slugDraft}
            onChange={(e) => {
              setSlugDraft(e.target.value.toLowerCase())
              setFormatError(null)
              setSaveError(null)
            }}
            className="h-8 border-0 bg-transparent px-1 text-left shadow-none focus-visible:ring-0"
            aria-label="آدرس سالن"
          />
        </div>
        {formatError && <FieldError className="mt-1">{formatError}</FieldError>}
        {saveError && <FieldError className="mt-1">{saveError}</FieldError>}
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          با تغییر آدرس، لینک‌های قبلی که به اشتراک گذاشته‌اید دیگر کار
          نمی‌کنند.
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        disabled={saveSlug.isPending || unchanged}
        onClick={handleSaveSlug}
      >
        {saveSlug.isPending ? 'در حال ذخیره…' : 'ذخیره آدرس'}
      </Button>
    </div>
  )
}
