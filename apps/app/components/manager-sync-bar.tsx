'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import type { SyncReviewItem, SyncState } from '@repo/data-client'
import { Button } from '@repo/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@repo/ui/alert-dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@repo/ui/sheet'
import { Spinner } from '@repo/ui/spinner'
import { cn } from '@repo/ui/utils'
import { useAuth } from '@/components/auth-provider'
import { useBumpOfflineData, useManagerDataClient } from '@/components/manager-data-client-provider'

function formatLastSync(iso: string | null): string {
  if (!iso) return 'هنوز همگام نشده'
  try {
    const d = new Date(iso)
    return d.toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function reviewHref(item: SyncReviewItem): string {
  if (item.href) return item.href
  if (item.entityType === 'client') return `/clients/${item.entityId}`
  if (item.entityType === 'appointment') return '/calendar'
  if (item.entityType === 'service') return '/services'
  if (item.entityType === 'business_settings') return '/settings'
  if (item.entityType === 'staff_services' || item.entityType === 'staff_schedule') return '/staff'
  return '/calendar'
}

function reviewActionLabel(item: SyncReviewItem): string {
  if (item.actionLabel) return item.actionLabel
  if (item.entityType === 'client' || item.entityType === 'appointment') return 'ویرایش و تلاش مجدد'
  if (item.entityType === 'service') return 'رفتن به خدمات'
  if (item.entityType === 'business_settings') return 'رفتن به تنظیمات'
  return 'رفتن به پرسنل'
}

export function ManagerSyncBar() {
  const { user } = useAuth()
  const client = useManagerDataClient()
  const bumpOfflineData = useBumpOfflineData()
  const [state, setState] = useState<SyncState | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [reviewItems, setReviewItems] = useState<SyncReviewItem[]>([])
  const [discardItem, setDiscardItem] = useState<SyncReviewItem | null>(null)

  const refreshReview = useCallback(async () => {
    if (!client) {
      setReviewItems([])
      return
    }
    setReviewItems(await client.sync.listReviewItems())
  }, [client])

  useEffect(() => {
    if (!client || user?.role !== 'manager') {
      setState(null)
      return
    }
    let cancelled = false
    void client.sync.getState().then((s) => {
      if (!cancelled) setState(s)
    })
    const unsub = client.sync.subscribe((s) => {
      if (!cancelled) setState(s)
    })
    return () => {
      cancelled = true
      unsub()
    }
  }, [client, user?.role])

  useEffect(() => {
    if (!sheetOpen || !client) return
    void refreshReview()
  }, [sheetOpen, client, refreshReview, state?.needsReviewCount])

  if (!client || user?.role !== 'manager' || !state) return null

  const visible =
    state.pendingCount > 0 ||
    state.needsReviewCount > 0 ||
    state.authBlocked ||
    state.isSyncing

  if (!visible) return null

  const tone =
    state.needsReviewCount > 0 || state.authBlocked
      ? 'border-amber-500/40 bg-amber-500/10'
      : 'border-border/60 bg-muted/40'

  return (
    <>
      <div
        className={cn(
          'flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2 text-xs sm:text-sm',
          tone
        )}
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-start text-foreground/90"
          onClick={() => setSheetOpen(true)}
        >
          {state.isSyncing ? (
            <Spinner className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <span className="size-2 shrink-0 rounded-full bg-primary/80" aria-hidden />
          )}
          <span className="min-w-0 truncate">
            {state.authBlocked
              ? 'همگام‌سازی متوقف شده است؛ لطفا دوباره وارد شوید.'
              : state.needsReviewCount > 0
                ? 'برخی تغییرات نیاز به بررسی دارند.'
                : state.pendingCount > 0
                  ? 'در حالت آفلاین ثبت شده و با اتصال اینترنت تکمیل می‌شود.'
                  : 'در حال همگام‌سازی…'}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            disabled={state.isSyncing || state.authBlocked}
            onClick={() => void client.sync.processPending()}
          >
            همگام‌سازی
          </Button>
        </div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
          <SheetHeader className="text-start">
            <SheetTitle>جزئیات همگام‌سازی</SheetTitle>
            <SheetDescription className="text-start">
              آخرین ارسال موفق: {formatLastSync(state.lastSyncAt)}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-3 px-1 pb-6">
            <p className="text-sm text-muted-foreground">
              {state.authBlocked
                ? 'همگام‌سازی به دلیل اتمام ورود متوقف شده است.'
                : state.needsReviewCount > 0
                  ? 'برخی تغییرات نیاز به بررسی دستی دارند.'
                  : state.pendingCount > 0
                    ? 'تغییرات محلی ذخیره شده‌اند و با اتصال اینترنت ارسال می‌شوند.'
                    : 'همه چیز همگام است.'}
            </p>

            {reviewItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">موردی برای بازبینی ثبت نشده است.</p>
            ) : (
              <ul className="space-y-3">
                {reviewItems.map((item) => (
                  <li
                    key={item.queueRowId}
                    className="rounded-lg border border-border/80 bg-card p-3 text-sm shadow-sm"
                  >
                    <div className="font-medium text-foreground">{item.title}</div>
                    {item.conflictCode && (
                      <div className="mt-1 font-mono text-xs text-muted-foreground">{item.conflictCode}</div>
                    )}
                    {item.lastError && (
                      <div className="mt-1 text-xs text-muted-foreground">{item.lastError}</div>
                    )}
                    {item.description && (
                      <div className="mt-2 text-xs leading-5 text-foreground/80">{item.description}</div>
                    )}
                    <div className="mt-2 text-xs text-muted-foreground">
                      {item.reviewReason === 'max_attempts'
                        ? 'پس از چند تلاش ناموفق متوقف شد.'
                        : 'سرور این تغییر را نپذیرفت.'}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="default"
                        disabled={state.isSyncing}
                        onClick={() =>
                          void client.sync.retryMutation(item.queueRowId).then(() => {
                            bumpOfflineData()
                            void refreshReview()
                            void client.sync.processPending()
                          })
                        }
                      >
                        تلاش مجدد
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setDiscardItem(item)}
                      >
                        حذف تغییر محلی
                      </Button>
                      <Button type="button" size="sm" variant="secondary" asChild>
                        <Link
                          href={reviewHref(item)}
                          onClick={() => setSheetOpen(false)}
                        >
                          {reviewActionLabel(item)}
                        </Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={discardItem !== null} onOpenChange={(open) => !open && setDiscardItem(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader className="text-start">
            <AlertDialogTitle>حذف تغییر محلی؟</AlertDialogTitle>
            <AlertDialogDescription className="text-start">
              این تغییر هنوز با سرور همگام نشده است. با حذف آن، نسخه محلی از صف خارج می‌شود و قابل بازیابی نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!discardItem) return
                void client.sync.discardMutation(discardItem.queueRowId).then(() => {
                  setDiscardItem(null)
                  bumpOfflineData()
                  void refreshReview()
                  void client.sync.getState().then(setState)
                })
              }}
            >
              حذف تغییر
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
