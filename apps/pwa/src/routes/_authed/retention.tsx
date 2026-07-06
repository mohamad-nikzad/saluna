import { useState } from 'react'
import {
  Link,
  createFileRoute,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { CalendarPlus, Check, Phone, Send, X } from 'lucide-react'
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
import { Badge } from '@repo/ui/badge'
import { PageHeaderBackButton } from '#/components/page-header-back-button'
import { Button } from '@repo/ui/button'
import { Card, CardContent } from '@repo/ui/card'
import { Spinner } from '@repo/ui/spinner'
import { displayPhone } from '@repo/salon-core/phone'
import { toPersianDigits } from '@repo/salon-core/persian-digits'
import type { FollowUpReason, RetentionItem } from '@repo/salon-core/types'

import {
  retentionListQueryOptions,
  useSendRetentionBaleMessageMutation,
  useUpdateRetentionStatusMutation,
} from '#/lib/retention-queries'

export const Route = createFileRoute('/_authed/retention')({
  beforeLoad: ({ context }) => {
    if (context.user.role !== 'manager') {
      throw redirect({ to: '/today' })
    }
  },
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(retentionListQueryOptions()),
  component: RetentionPage,
  pendingComponent: RetentionPending,
  errorComponent: RetentionError,
})

function RetentionPending() {
  return (
    <div className="flex h-full items-center justify-center">
      <Spinner />
    </div>
  )
}

function RetentionError({ error }: { error: Error }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-sm text-muted-foreground">
        پیگیری مشتریان بارگذاری نشد
      </p>
      <p className="text-xs text-destructive">{error.message}</p>
    </div>
  )
}

function reasonLabel(reason: FollowUpReason): string {
  switch (reason) {
    case 'inactive':
      return 'مراجعه قدیمی'
    case 'no-show':
      return 'غیبت'
    case 'new-client':
      return 'بدون نوبت دوم'
    case 'vip':
      return 'ارزشمند'
    case 'manual':
      return 'دستی'
    default:
      return reason
  }
}

function baleDeliveryLabel(status: 'sent' | 'failed' | 'skipped'): string {
  switch (status) {
    case 'sent':
      return 'پیام بله ارسال شد'
    case 'failed':
      return 'ارسال بله ناموفق بود'
    case 'skipped':
      return 'ارسال بله انجام نشد'
    default:
      return status
  }
}

function RetentionPage() {
  const navigate = useNavigate()
  const [confirmItem, setConfirmItem] = useState<RetentionItem | null>(null)
  const [baleDeliveryById, setBaleDeliveryById] = useState<
    Record<
      string,
      {
        status: 'sent' | 'failed' | 'skipped'
        error?: string | null
      }
    >
  >({})
  const initial = Route.useLoaderData()
  const { data } = useQuery({
    ...retentionListQueryOptions(),
    initialData: initial,
  })

  const updateStatus = useUpdateRetentionStatusMutation()
  const sendBaleMessage = useSendRetentionBaleMessageMutation()

  const items = data.items as unknown as RetentionItem[]
  const busyId = updateStatus.isPending ? updateStatus.variables.id : null
  const baleBusyId = sendBaleMessage.isPending
    ? sendBaleMessage.variables.id
    : null

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex items-start gap-3 border-b border-border/50 bg-card px-3 py-3">
        <PageHeaderBackButton
          aria-label="بازگشت به بیشتر"
          onClick={() => navigate({ to: '/settings' })}
        />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold">پیگیری مشتریان</h1>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            لیست بر اساس داده واقعی نوبت‌ها ساخته می‌شود؛ پیام خودکار ارسال
            نمی‌شود.
          </p>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-auto p-4">
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            موردی در صف نیست.
          </p>
        ) : (
          items.map((item) => (
            <Card key={item.id} className="border-border/50">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{item.client.name}</p>
                    <p className="text-xs text-muted-foreground" dir="ltr">
                      <Phone className="me-1 inline h-3 w-3" />
                      {displayPhone(item.client.phone)}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {reasonLabel(item.reason)}
                  </Badge>
                </div>

                <p className="text-sm text-muted-foreground">
                  {item.suggestedReason}
                </p>

                {baleDeliveryById[item.id] ? (
                  <div
                    className={
                      baleDeliveryById[item.id].status === 'sent'
                        ? 'rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800'
                        : 'rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive'
                    }
                  >
                    <span className="font-medium">
                      {baleDeliveryLabel(baleDeliveryById[item.id].status)}
                    </span>
                    {baleDeliveryById[item.id].error ? (
                      <span className="ms-1">
                        {baleDeliveryById[item.id].error}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                  <div>
                    <span className="block text-[10px]">آخرین مراجعه</span>
                    <span className="font-medium text-foreground" dir="ltr">
                      {item.lastVisitDate
                        ? toPersianDigits(item.lastVisitDate)
                        : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px]">آخرین خدمت</span>
                    <span className="font-medium text-foreground">
                      {item.lastServiceName ?? '—'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px]">مراجعات</span>
                    <span className="font-medium text-foreground" dir="ltr">
                      {new Intl.NumberFormat('fa-IR').format(
                        item.completedCount,
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px]">غیبت</span>
                    <span className="font-medium text-foreground" dir="ltr">
                      {new Intl.NumberFormat('fa-IR').format(item.noShowCount)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {item.client.phone ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="touch-manipulation gap-1"
                      asChild
                    >
                      <a href={`tel:${item.client.phone}`}>
                        <Phone className="h-3.5 w-3.5" />
                        تماس
                      </a>
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    className="touch-manipulation gap-1"
                    disabled={
                      baleBusyId === item.id ||
                      baleDeliveryById[item.id]?.status === 'sent' ||
                      !item.client.phone
                    }
                    onClick={() => setConfirmItem(item)}
                  >
                    <Send className="h-3.5 w-3.5" />
                    پیام بله
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="touch-manipulation gap-1"
                    asChild
                  >
                    <Link to="/calendar" search={{ clientId: item.client.id }}>
                      <CalendarPlus className="h-3.5 w-3.5" />
                      نوبت
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    className="touch-manipulation gap-1"
                    disabled={busyId === item.id}
                    onClick={() =>
                      updateStatus.mutate({ id: item.id, status: 'reviewed' })
                    }
                  >
                    <Check className="h-3.5 w-3.5" />
                    بررسی شد
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="touch-manipulation gap-1 text-muted-foreground"
                    disabled={busyId === item.id}
                    onClick={() =>
                      updateStatus.mutate({ id: item.id, status: 'dismissed' })
                    }
                  >
                    <X className="h-3.5 w-3.5" />
                    رد
                  </Button>
                  <Button
                    size="sm"
                    variant="link"
                    className="touch-manipulation px-0"
                    asChild
                  >
                    <a href={`/clients/${item.client.id}`}>پروفایل</a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <AlertDialog
        open={confirmItem !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmItem(null)
        }}
      >
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader className="text-start">
            <AlertDialogTitle>ارسال پیام بله؟</AlertDialogTitle>
            <AlertDialogDescription className="text-start">
              {confirmItem ? (
                <>
                  برای {confirmItem.client.name} یک پیام کوتاه پیگیری از طرف
                  سالن ارسال می‌شود. این پیام در صف پیگیری ثبت می‌شود و ارسال
                  خودکار دوره‌ای فعال نمی‌کند.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sendBaleMessage.isPending}>
              انصراف
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={!confirmItem || sendBaleMessage.isPending}
              onClick={(event) => {
                event.preventDefault()
                if (!confirmItem) return
                sendBaleMessage.mutate(
                  {
                    id: confirmItem.id,
                    retry:
                      baleDeliveryById[confirmItem.id]?.status === 'failed',
                  },
                  {
                    onSuccess: (response) => {
                      setBaleDeliveryById((current) => ({
                        ...current,
                        [confirmItem.id]: {
                          status: response.delivery.status,
                          error: response.delivery.error,
                        },
                      }))
                    },
                    onError: (error) => {
                      setBaleDeliveryById((current) => ({
                        ...current,
                        [confirmItem.id]: {
                          status: 'failed',
                          error: error instanceof Error ? error.message : null,
                        },
                      }))
                    },
                    onSettled: () => setConfirmItem(null),
                  },
                )
              }}
            >
              ارسال پیام
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
