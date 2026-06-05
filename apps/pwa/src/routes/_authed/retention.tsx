import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowRight, CalendarPlus, Check, Phone, X } from 'lucide-react'
import { Badge } from '@repo/ui/badge'
import { Button } from '@repo/ui/button'
import { Card, CardContent } from '@repo/ui/card'
import { Spinner } from '@repo/ui/spinner'
import { displayPhone } from '@repo/salon-core/phone'
import { toPersianDigits } from '@repo/salon-core/persian-digits'
import type {
  FollowUpReason,
  FollowUpStatus,
  RetentionItem,
} from '@repo/salon-core/types'
import type { RetentionQueueResponse } from '@repo/api-client'

import { api } from '#/lib/api-client'
import { HEAVY_QUERY_STALE_TIME_MS } from '#/lib/query-client'

const retentionQueryKey = ['retention'] as const

export const Route = createFileRoute('/_authed/retention')({
  beforeLoad: ({ context }) => {
    if (context.user.role !== 'manager') {
      throw redirect({ to: '/today' })
    }
  },
  loader: ({ context }) =>
    context.queryClient.ensureQueryData<RetentionQueueResponse>({
      queryKey: retentionQueryKey,
      queryFn: ({ signal }) => api.retention.list({ signal }),
      staleTime: HEAVY_QUERY_STALE_TIME_MS,
    }),
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

function RetentionPage() {
  const navigate = useNavigate()
  const initial = Route.useLoaderData()
  const { data } = useQuery({
    queryKey: retentionQueryKey,
    queryFn: ({ signal }) => api.retention.list({ signal }),
    initialData: initial,
    staleTime: HEAVY_QUERY_STALE_TIME_MS,
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: FollowUpStatus }) =>
      api.retention.updateStatus(id, status),
    meta: {
      skipToast: true,
      invalidatesQuery: retentionQueryKey,
    },
  })

  const items: RetentionItem[] = data.items
  const busyId = updateStatus.isPending ? updateStatus.variables.id : null

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex items-start gap-3 border-b border-border/50 bg-card px-3 py-3">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="بازگشت به بیشتر"
          onClick={() => navigate({ to: '/settings' })}
          className="h-10 w-10 shrink-0 rounded-2xl touch-manipulation"
        >
          <ArrowRight className="h-5 w-5" />
        </Button>
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
                    variant="secondary"
                    className="touch-manipulation gap-1"
                    asChild
                  >
                    <a href={`/calendar?clientId=${item.client.id}`}>
                      <CalendarPlus className="h-3.5 w-3.5" />
                      نوبت
                    </a>
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
    </div>
  )
}
