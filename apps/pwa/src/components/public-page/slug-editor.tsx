import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Check, Copy, Link2 } from 'lucide-react'
import { ApiError } from '@repo/api-client'
import type { ManagerPublicSettingsResult } from '@repo/api-client'
import { Button } from '@repo/ui/button'
import { FieldError } from '@repo/ui/field'
import { Input } from '@repo/ui/input'
import { slugSchema } from '@repo/salon-core/forms/slug'

import { api } from '#/lib/api-client'

import { publicSlugPrefix } from './public-url'

export function SlugEditor({
  currentSlug,
  publicUrl,
  copied,
  onCopy,
  onSaved,
}: {
  currentSlug: string
  publicUrl: string
  copied: boolean
  onCopy: () => void
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

  const saveSlug = useMutation({
    mutationFn: (slug: string) => api.salonPublicSettings.updateSlug({ slug }),
    onSuccess: (result) => {
      setSaveError(null)
      onSaved(result)
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        setSaveError(err.message || 'این آدرس سالن قبلاً ثبت شده است')
        return
      }
      setSaveError(err instanceof Error ? err.message : 'ذخیره آدرس انجام نشد')
    },
  })

  const handleSaveSlug = () => {
    setSaveError(null)
    const parsed = slugSchema.safeParse(slugDraft)
    if (!parsed.success) {
      setFormatError(parsed.error.issues[0]?.message ?? 'آدرس معتبر نیست')
      return
    }
    setFormatError(null)
    if (parsed.data === currentSlug) return
    saveSlug.mutate(parsed.data)
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
      <div>
        <div className="mb-1 text-sm font-medium">لینک کامل</div>
        <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-2.5">
          <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span dir="ltr" className="min-w-0 flex-1 truncate text-xs">
            {publicUrl}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-8 shrink-0"
            onClick={onCopy}
          >
            {copied ? (
              <>
                <Check className="ml-1 h-3 w-3" />
                کپی شد
              </>
            ) : (
              <>
                <Copy className="ml-1 h-3 w-3" />
                کپی
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
