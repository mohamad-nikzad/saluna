import {
  Check,
  CircleAlert,
  Copy,
  ExternalLink,
  Globe2,
  Link2,
  Share2,
} from 'lucide-react'
import { Button } from '@repo/ui/button'
import { Switch } from '@repo/ui/switch'
import { cn } from '@repo/ui/utils'

export function PublicationCard({
  draftEnabled,
  savedEnabled,
  url,
  missingDetails,
  copied,
  error,
  onEnabledChange,
  onShare,
  onCopy,
  onOpen,
}: {
  draftEnabled: boolean
  savedEnabled: boolean
  url: string
  missingDetails: string[]
  copied: boolean
  error: string | null
  onEnabledChange: (enabled: boolean) => void
  onShare: () => void
  onCopy: () => void
  onOpen: () => void
}) {
  const canShare = draftEnabled && savedEnabled
  const explanation = !draftEnabled
    ? 'برای اشتراک‌گذاری، صفحه را فعال و ذخیره کنید.'
    : !savedEnabled
      ? 'برای فعال شدن لینک، تغییرات را ذخیره کنید.'
      : 'صفحه عمومی منتشر شده و آماده اشتراک‌گذاری است.'

  return (
    <section
      aria-label="انتشار صفحه عمومی"
      className="shrink-0 overflow-hidden rounded-3xl border border-primary/20 bg-card shadow-sm"
    >
      <div className="bg-gradient-to-l from-primary/15 via-primary/5 to-card p-4">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Globe2 className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">
                  وضعیت انتشار
                </p>
                <h2 className="mt-0.5 text-base font-extrabold">
                  {canShare
                    ? 'صفحه شما منتشر شده'
                    : draftEnabled
                      ? 'تغییرات ذخیره نشده'
                      : 'انتشار صفحه'}
                </h2>
              </div>
              <Switch
                checked={draftEnabled}
                aria-label="فعال بودن صفحه عمومی"
                onCheckedChange={onEnabledChange}
              />
            </div>
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
              {explanation}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div
          dir="ltr"
          className={cn(
            'flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2.5',
            !canShare && 'opacity-55',
          )}
        >
          <Link2 className="size-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate text-left text-xs font-medium">
            {url}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-auto flex-col gap-1.5 py-2.5 text-xs"
            disabled={!canShare}
            onClick={onShare}
          >
            <Share2 className="size-4" />
            اشتراک
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-auto flex-col gap-1.5 py-2.5 text-xs"
            disabled={!canShare}
            onClick={onCopy}
          >
            {copied ? (
              <>
                <Check className="size-4" />
                کپی شد
              </>
            ) : (
              <>
                <Copy className="size-4" />
                کپی لینک
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-auto flex-col gap-1.5 py-2.5 text-xs"
            disabled={!canShare}
            onClick={onOpen}
          >
            <ExternalLink className="size-4" />
            باز کردن
          </Button>
        </div>

        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}

        <div className="border-t border-line-soft pt-3">
          {missingDetails.length ? (
            <div className="flex items-start gap-2 text-xs leading-5 text-amber-800 dark:text-amber-300">
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              <span>
                برای نتیجه بهتر تکمیل کنید:{' '}
                <strong>{missingDetails.join('، ')}</strong>
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400">
              <Check className="size-4" />
              اطلاعات اصلی صفحه کامل است
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
