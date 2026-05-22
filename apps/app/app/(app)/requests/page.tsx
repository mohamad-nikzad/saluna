'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { Check, Phone, MessageCircle, X } from 'lucide-react'
import { Badge } from '@repo/ui/badge'
import { Button } from '@repo/ui/button'
import { Card, CardContent } from '@repo/ui/card'
import { Spinner } from '@repo/ui/spinner'
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@repo/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/dialog'
import { Textarea } from '@repo/ui/textarea'
import { useAuth } from '@/components/auth-provider'
import {
  toPersianDigits,
  formatPersianTime,
} from '@repo/salon-core/persian-digits'
import { formatJalaliFullDate } from '@repo/salon-core/jalali'
import { displayPhone } from '@repo/salon-core/phone'
import type { AppointmentRequestListItem } from '@repo/database/appointment-requests'
import type { User, Service } from '@repo/salon-core/types'

type StatusTab = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired'

const TAB_LABELS: Record<StatusTab, string> = {
  pending: 'در انتظار',
  approved: 'تأیید شده',
  rejected: 'رد شده',
  cancelled: 'لغو شده',
  expired: 'منقضی شده',
}

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) throw new Error('failed')
  return res.json()
}

export default function RequestsPage() {
  const { user, loading: authLoading } = useAuth()
  const [tab, setTab] = useState<StatusTab>('pending')

  const isManager = user?.role === 'manager'

  if (authLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  if (!isManager) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
        دسترسی به این بخش فقط برای مدیر سالن است.
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="bg-card px-4 py-3 border-b border-border/50">
        <h1 className="text-lg font-bold">درخواست‌های رزرو</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          درخواست‌های ارسال‌شده از صفحه عمومی سالن
        </p>
      </header>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as StatusTab)}
        className="flex-1 overflow-hidden flex flex-col"
      >
        <TabsList className="mx-4 mt-3 grid grid-cols-5">
          {(Object.keys(TAB_LABELS) as StatusTab[]).map((s) => (
            <TabsTrigger key={s} value={s} className="text-xs">
              {TAB_LABELS[s]}
            </TabsTrigger>
          ))}
        </TabsList>

        {(Object.keys(TAB_LABELS) as StatusTab[]).map((s) => (
          <TabsContent
            key={s}
            value={s}
            className="flex-1 overflow-auto p-4 space-y-3"
          >
            {tab === s && <RequestsList status={s} />}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

function RequestsList({ status }: { status: StatusTab }) {
  const { data, error, isLoading, mutate } = useSWR<{
    requests: AppointmentRequestListItem[]
  }>(`/api/appointment-requests?status=${status}`, fetcher)

  const { data: staffData } = useSWR<{ staff: User[] }>(
    status === 'pending' ? '/api/staff' : null,
    fetcher,
  )
  const { data: servicesData } = useSWR<{ services: Service[] }>(
    status === 'pending' ? '/api/services' : null,
    fetcher,
  )

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner className="h-5 w-5" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center text-sm text-destructive py-8">
        خطا در بارگذاری درخواست‌ها
      </div>
    )
  }

  const requests = data?.requests ?? []

  if (requests.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-8">
        موردی وجود ندارد.
      </div>
    )
  }

  return (
    <>
      {requests.map((req) => (
        <RequestRow
          key={req.id}
          request={req}
          staff={staffData?.staff ?? []}
          services={servicesData?.services ?? []}
          onChanged={() => void mutate()}
        />
      ))}
    </>
  )
}

function RequestRow({
  request,
  staff,
  services,
  onChanged,
}: {
  request: AppointmentRequestListItem
  staff: User[]
  services: Service[]
  onChanged: () => void
}) {
  const [staffId, setStaffId] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [errMsg, setErrMsg] = useState<string | null>(null)

  const capableStaff = useMemo(() => {
    return staff.filter((u) => {
      if (u.role !== 'staff' && u.role !== 'manager') return false
      if (u.serviceIds == null) return true
      return u.serviceIds.includes(request.serviceId)
    })
  }, [staff, request.serviceId])

  const service = services.find((s) => s.id === request.serviceId)
  const serviceVariantChanged =
    service != null &&
    (service.name !== request.bookedServiceName ||
      service.duration !== request.bookedServiceDuration ||
      service.price !== request.bookedServicePrice)

  const phoneFa = displayPhone(request.customerPhone)
  const waPhone = request.customerPhone.replace(/^0/, '98')

  const approve = async () => {
    if (!staffId) {
      setErrMsg('لطفاً پرسنل را انتخاب کنید')
      return
    }
    setSubmitting(true)
    setErrMsg(null)
    try {
      const res = await fetch(`/api/appointment-requests/${request.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ staffId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setErrMsg(body.error ?? 'تأیید درخواست انجام نشد')
        return
      }
      onChanged()
    } finally {
      setSubmitting(false)
    }
  }

  const reject = async () => {
    setSubmitting(true)
    setErrMsg(null)
    try {
      const res = await fetch(`/api/appointment-requests/${request.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(
          rejectReason.trim() ? { reason: rejectReason.trim() } : {},
        ),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setErrMsg(body.error ?? 'رد درخواست انجام نشد')
        return
      }
      setRejectOpen(false)
      setRejectReason('')
      onChanged()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="border-border/60">
      <CardContent className="space-y-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{request.bookedServiceName}</span>
              {request.existingClient ? (
                <Badge variant="secondary" className="text-[10px]">
                  مشتری ثبت‌شده
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px]">
                  مشتری جدید
                </Badge>
              )}
              {serviceVariantChanged && request.status === 'pending' && (
                <Badge variant="destructive" className="text-[10px]">
                  خدمت تغییر کرده
                </Badge>
              )}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {formatJalaliFullDate(request.requestedDate)} ·{' '}
              {formatPersianTime(request.requestedStartTime)} تا{' '}
              {formatPersianTime(request.requestedEndTime)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              مدت: {toPersianDigits(request.bookedServiceDuration)} دقیقه · قیمت:{' '}
              {toPersianDigits(request.bookedServicePrice.toLocaleString('en-US'))}
            </div>
          </div>
        </div>

        <div className="rounded-md bg-muted/40 p-2 space-y-1">
          <div className="text-sm font-medium">
            {request.existingClient?.name ?? request.customerName}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span dir="ltr">{phoneFa}</span>
            <a
              href={`tel:${request.customerPhone}`}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-border/60 px-2 hover:bg-accent"
              aria-label="تماس"
            >
              <Phone className="h-3.5 w-3.5" />
            </a>
            <a
              href={`https://wa.me/${waPhone}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-7 items-center gap-1 rounded-md border border-border/60 px-2 hover:bg-accent"
              aria-label="واتس‌اپ"
            >
              <MessageCircle className="h-3.5 w-3.5" />
            </a>
          </div>
          {request.notes && (
            <div className="text-xs text-muted-foreground">
              یادداشت: {request.notes}
            </div>
          )}
        </div>

        {request.status === 'pending' && (
          <>
            <div className="space-y-2">
              <Select value={staffId} onValueChange={setStaffId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="انتخاب پرسنل" />
                </SelectTrigger>
                <SelectContent>
                  {capableStaff.length === 0 ? (
                    <SelectItem value="__none__" disabled>
                      پرسنلی برای این خدمت وجود ندارد
                    </SelectItem>
                  ) : (
                    capableStaff.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>

              {errMsg && (
                <p className="text-xs text-destructive">{errMsg}</p>
              )}

              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  disabled={submitting || !staffId}
                  onClick={approve}
                >
                  <Check className="ml-1 h-4 w-4" />
                  تأیید
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-destructive"
                  disabled={submitting}
                  onClick={() => setRejectOpen(true)}
                >
                  <X className="ml-1 h-4 w-4" />
                  رد
                </Button>
              </div>
            </div>

            <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>رد درخواست</DialogTitle>
                </DialogHeader>
                <Textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="دلیل (اختیاری)"
                  rows={3}
                />
                {errMsg && (
                  <p className="text-xs text-destructive">{errMsg}</p>
                )}
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setRejectOpen(false)}
                    disabled={submitting}
                  >
                    انصراف
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={reject}
                    disabled={submitting}
                  >
                    رد درخواست
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}

        {request.status === 'rejected' && request.rejectionReason && (
          <div className="text-xs text-muted-foreground">
            دلیل: {request.rejectionReason}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
