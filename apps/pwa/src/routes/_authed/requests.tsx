import { useCallback, useEffect, useMemo, useState } from 'react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Ban,
  Calendar,
  Check,
  ChevronLeft,
  Clock,
  Inbox,
  MessageCircle,
  Phone,
  Plus,
  Scissors,
  Sparkles,
  X,
} from 'lucide-react'
import { Badge } from '@repo/ui/badge'
import { Button } from '@repo/ui/button'
import { Spinner } from '@repo/ui/spinner'
import { SakuraMark } from '@repo/ui/sakura-mark'
import { cn } from '@repo/ui/utils'
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
import { Input } from '@repo/ui/input'
import { scrollFocusedInputIntoView } from '#/lib/scroll-focused-input-into-view'
import {
  toPersianDigits,
  formatPersianTime,
} from '@repo/salon-core/persian-digits'
import { formatJalaliFullDate } from '@repo/salon-core/jalali'
import { displayPhone } from '@repo/salon-core/phone'
import type { User, Service } from '@repo/salon-core/types'

import {
  appointmentRequestsListQueryOptions,
  getApiV1AppointmentRequestsQueryKey,
  pendingAppointmentRequestsQueryOptions,
  pendingDraftsQueryOptions,
  useCreateDraftMutation,
  useApproveAppointmentRequestMutation,
  useRejectAppointmentRequestMutation,
  type AppointmentRequestStatus,
  type ExactAppointmentRequestListItem,
  type FlexibleAppointmentRequestListItem,
} from '#/lib/appointment-requests-queries'
import { servicesListQueryOptions } from '#/lib/services-queries'
import {
  clientsListQueryOptions,
  getApiV1ClientsQueryKey,
} from '#/lib/clients-queries'
import { staffListQueryOptions } from '#/lib/staff-queries'
import { ClientAvatar } from '#/components/clients/client-visuals'
import { ClientPicker } from '#/components/calendar/client-picker'
import { ServicePicker } from '#/components/services/service-picker'
import {
  FormSheet,
  FormSheetBody,
  FormSheetContent,
  FormSheetFooter,
  FormSheetHeader,
  FormSheetTitle,
} from '#/components/form-sheet'
import type { Client } from '@repo/salon-core/types'

type StatusTab = AppointmentRequestStatus
type RequestsTab = StatusTab | 'drafts'

const TABS: { id: StatusTab; label: string }[] = [
  { id: 'pending', label: 'در انتظار' },
  { id: 'approved', label: 'تأیید شده' },
  { id: 'rejected', label: 'رد شده' },
  { id: 'cancelled', label: 'لغو شده' },
  { id: 'expired', label: 'منقضی شده' },
]

const DECIDED = {
  approved: {
    tone: 'mint',
    label: 'تأیید شد',
    icon: Check,
    tile: 'bg-mint-soft text-mint-fg',
  },
  rejected: {
    tone: 'danger',
    label: 'رد شد',
    icon: X,
    tile: 'bg-destructive-soft text-destructive',
  },
  cancelled: {
    tone: 'neutral',
    label: 'لغو شد',
    icon: Ban,
    tile: 'bg-paper-deep text-sage-deep',
  },
  expired: {
    tone: 'neutral',
    label: 'منقضی شد',
    icon: Clock,
    tile: 'bg-paper-deep text-sage-deep',
  },
} as const satisfies Record<
  Exclude<StatusTab, 'pending'>,
  { tone: string; label: string; icon: React.ElementType; tile: string }
>

const EMPTY_COPY: Record<StatusTab, { title: string; sub: string }> = {
  pending: {
    title: 'فعلاً درخواستی نیست',
    sub: 'وقتی مشتری از صفحه عمومی سالن نوبت بخواهد، اینجا نمایش داده می‌شود.',
  },
  approved: {
    title: 'موردی نیست',
    sub: 'درخواست‌های تأییدشده اینجا فهرست می‌شوند.',
  },
  rejected: {
    title: 'موردی نیست',
    sub: 'درخواست‌های ردشده اینجا فهرست می‌شوند.',
  },
  cancelled: {
    title: 'موردی نیست',
    sub: 'درخواست‌های لغوشده اینجا فهرست می‌شوند.',
  },
  expired: {
    title: 'موردی نیست',
    sub: 'درخواست‌های منقضی‌شده اینجا فهرست می‌شوند.',
  },
}

const searchSchema = z.object({
  focus: z.string().optional(),
})

export const Route = createFileRoute('/_authed/requests')({
  validateSearch: searchSchema,
  beforeLoad: ({ context }) => {
    if (context.user.role !== 'manager') {
      throw redirect({ to: '/today' })
    }
  },
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      pendingAppointmentRequestsQueryOptions(),
    ),
  component: RequestsPage,
  pendingComponent: RequestsPending,
  errorComponent: RequestsError,
})

function RequestsPending() {
  return (
    <div className="flex h-full items-center justify-center">
      <Spinner className="h-6 w-6" />
    </div>
  )
}

function RequestsError({ error }: { error: Error }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-sm text-muted-foreground">درخواست‌ها بارگذاری نشد</p>
      <p className="text-xs text-destructive">{error.message}</p>
    </div>
  )
}

function RequestsPage() {
  const { focus } = Route.useSearch()
  const [tab, setTab] = useState<RequestsTab>('pending')
  const [counts, setCounts] = useState<Partial<Record<StatusTab, number>>>({})
  const initial = Route.useLoaderData()

  // A focused request is only meaningful while pending.
  const activeTab: RequestsTab = focus ? 'pending' : tab

  const { data: pendingData } = useQuery({
    ...pendingAppointmentRequestsQueryOptions(),
    initialData: initial,
    refetchInterval: 60_000,
  })
  const pendingCount = pendingData.requests.length

  const navigate = useNavigate()

  const reportCount = useCallback((status: StatusTab, n: number) => {
    setCounts((prev) => (prev[status] === n ? prev : { ...prev, [status]: n }))
  }, [])

  const selectTab = useCallback(
    (id: RequestsTab) => {
      setTab(id)
      // Changing tabs is an explicit action that clears any focused request.
      if (focus) void navigate({ to: '/requests' })
    },
    [focus, navigate],
  )

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-line-soft bg-card px-5 pt-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] font-extrabold tracking-tight text-foreground">
              درخواست‌ها
            </h1>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {pendingCount > 0 ? (
                <>
                  <span className="tabular-nums">
                    {toPersianDigits(pendingCount)}
                  </span>{' '}
                  درخواست منتظر بررسی شماست
                </>
              ) : (
                'تمام درخواست‌ها بررسی شده'
              )}
            </p>
          </div>
        </div>

        <div className="-mx-5 mt-3.5 flex gap-2 overflow-x-auto px-5 scrollbar-hide">
          <button
            type="button"
            onClick={() => selectTab('drafts')}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-[13px] whitespace-nowrap transition-colors',
              activeTab === 'drafts'
                ? 'border-primary font-bold text-foreground'
                : 'border-transparent font-medium text-muted-foreground',
            )}
          >
            پیش‌نویس‌ها
          </button>
          {TABS.map(({ id, label }) => {
            const active = activeTab === id
            const count = id === 'pending' ? pendingCount : counts[id]
            return (
              <button
                key={id}
                type="button"
                onClick={() => selectTab(id)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-[13px] whitespace-nowrap transition-colors',
                  active
                    ? 'border-primary font-bold text-foreground'
                    : 'border-transparent font-medium text-muted-foreground',
                )}
              >
                {label}
                {count != null && count > 0 && (
                  <span
                    className={cn(
                      'rounded-lg px-1.5 py-px text-[10px] font-bold tabular-nums',
                      active
                        ? 'bg-blush-soft text-plum-deep'
                        : 'bg-paper-deep text-muted-foreground',
                    )}
                  >
                    {toPersianDigits(count)}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </header>

      {!focus && activeTab === 'pending' && pendingCount > 0 && (
        <div className="px-5 pt-3.5">
          <div className="flex items-center gap-2.5 rounded-2xl border border-line-soft bg-blush-soft px-3.5 py-2.5 text-plum-deep">
            <Sparkles className="size-4 shrink-0" />
            <p className="flex-1 text-[11.5px] leading-relaxed">
              این درخواست‌ها از صفحه عمومی سالن ثبت شده‌اند.
            </p>
            <a
              href="/public-page"
              className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-bold text-primary"
            >
              مدیریت لینک
              <ChevronLeft className="size-3.5" />
            </a>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto px-5 pb-24 pt-4">
        {activeTab === 'drafts' ? (
          <DraftsPanel />
        ) : (
          <RequestsList
            status={activeTab}
            focus={focus}
            onCount={reportCount}
          />
        )}
      </div>
    </div>
  )
}

function RequestsList({
  status,
  focus,
  onCount,
}: {
  status: StatusTab
  focus?: string
  onCount: (status: StatusTab, n: number) => void
}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const { data, error, isLoading } = useQuery(
    appointmentRequestsListQueryOptions(status),
  )

  const { data: staffData } = useQuery({
    ...staffListQueryOptions(),
    enabled: status === 'pending',
  })
  const { data: servicesData } = useQuery({
    ...servicesListQueryOptions(),
    enabled: status === 'pending',
  })

  const requests = data?.requests

  useEffect(() => {
    if (requests) onCount(status, requests.length)
  }, [requests, status, onCount])

  const onChanged = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: getApiV1AppointmentRequestsQueryKey({ query: { status } }),
    })
    void queryClient.invalidateQueries({
      queryKey: getApiV1AppointmentRequestsQueryKey({
        query: { status: 'pending' },
      }),
    })
  }, [queryClient, status])

  const clearFocus = useCallback(
    () => navigate({ to: '/requests' }),
    [navigate],
  )

  // Focus only applies to the pending tab (enforced in RequestsPage).
  const focused = focus
    ? requests?.find(
        (req): req is ExactAppointmentRequestListItem =>
          req.id === focus && req.timingMode === 'exact',
      )
    : undefined

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner className="h-5 w-5" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-10 text-center text-sm text-destructive">
        خطا در بارگذاری درخواست‌ها
      </div>
    )
  }

  if (focus) {
    if (!focused) {
      return (
        <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
          <p className="text-[14px] font-bold text-foreground">
            این درخواست دیگر در انتظار نیست
          </p>
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => void clearFocus()}
          >
            نمایش همه درخواست‌ها
          </Button>
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-3">
        <FocusBanner onClear={() => void clearFocus()} />
        <PendingCard
          request={focused}
          staff={staffData ?? []}
          services={servicesData ?? []}
          onChanged={onChanged}
        />
      </div>
    )
  }

  if (!requests || requests.length === 0) {
    return <EmptyState status={status} />
  }

  return (
    <div className="flex flex-col gap-3">
      {requests.map((req) =>
        req.timingMode !== 'exact' ? null : status === 'pending' ? (
          <PendingCard
            key={req.id}
            request={req}
            staff={staffData ?? []}
            services={servicesData ?? []}
            onChanged={onChanged}
          />
        ) : (
          <DecidedCard key={req.id} request={req} status={status} />
        ),
      )}
    </div>
  )
}

const TIME_PREFERENCE_LABELS = {
  morning: 'صبح',
  afternoon: 'بعدازظهر',
  evening: 'عصر',
  any: 'هر زمان',
} as const

function DraftsPanel() {
  const { data, isLoading } = useQuery(pendingDraftsQueryOptions())
  const { data: clients = [] } = useQuery(clientsListQueryOptions())
  const { data: services = [] } = useQuery(servicesListQueryOptions())
  const [open, setOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner className="size-5" />
      </div>
    )
  }

  const drafts = (data?.requests ?? []).filter(
    (request): request is FlexibleAppointmentRequestListItem =>
      request.timingMode === 'flexible',
  )

  return (
    <div className="space-y-3">
      <Button className="w-full rounded-xl" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        پیش‌نویس جدید
      </Button>
      {drafts.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm font-bold">پیش‌نویسی ثبت نشده</p>
          <p className="mt-1 text-xs text-muted-foreground">
            درخواست‌های تلفنی و پیام‌ها را اینجا ثبت کنید.
          </p>
        </div>
      ) : (
        drafts.map((draft) => <DraftCard key={draft.id} draft={draft} />)
      )}
      <NewDraftSheet
        open={open}
        onOpenChange={setOpen}
        clients={clients}
        services={services.filter((service) => service.active)}
      />
    </div>
  )
}

function DraftCard({ draft }: { draft: FlexibleAppointmentRequestListItem }) {
  const clientName = draft.existingClient?.name ?? draft.customerName
  return (
    <div className="space-y-3 rounded-[var(--radius)] border border-line-soft border-s-[3px] border-s-primary bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <ClientAvatar name={clientName} accent="var(--mint)" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold">{clientName}</p>
          <p className="text-xs text-muted-foreground">
            {draft.bookedServiceName} ·{' '}
            {toPersianDigits(draft.bookedServiceDuration)} دقیقه
          </p>
        </div>
        <Badge variant="neutral">پیش‌نویس</Badge>
      </div>
      <div className="space-y-2 rounded-2xl bg-background p-3 text-xs">
        <p className="flex items-center gap-2">
          <Calendar className="size-3.5 text-primary" />
          {draft.acceptableDates.map(formatJalaliFullDate).join('، ')}
        </p>
        <p className="flex items-center gap-2">
          <Clock className="size-3.5 text-primary" />
          {TIME_PREFERENCE_LABELS[draft.timePreference]}
        </p>
        {draft.notes && (
          <p className="border-t border-dashed border-border pt-2 text-muted-foreground">
            {draft.notes}
          </p>
        )}
      </div>
    </div>
  )
}

function NewDraftSheet({
  open,
  onOpenChange,
  clients,
  services,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  clients: Client[]
  services: Service[]
}) {
  const queryClient = useQueryClient()
  const [localClients, setLocalClients] = useState(clients)
  const [clientId, setClientId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [dates, setDates] = useState([''])
  const [timePreference, setTimePreference] =
    useState<keyof typeof TIME_PREFERENCE_LABELS>('any')
  const [notes, setNotes] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const createDraft = useCreateDraftMutation()

  useEffect(() => setLocalClients(clients), [clients])

  const close = () => {
    onOpenChange(false)
    setClientId('')
    setServiceId('')
    setDates([''])
    setTimePreference('any')
    setNotes('')
    setErrorMessage('')
  }

  const submit = () => {
    const acceptableDates = dates.filter(Boolean)
    if (!clientId || !serviceId || acceptableDates.length === 0) {
      setErrorMessage('مشتری، خدمت و حداقل یک تاریخ را انتخاب کنید')
      return
    }
    createDraft.mutate(
      {
        clientId,
        serviceId,
        acceptableDates,
        timePreference,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      },
      { onSuccess: close },
    )
  }

  return (
    <FormSheet open={open} onOpenChange={onOpenChange}>
      <FormSheetContent onRequestClose={close}>
        <FormSheetHeader>
          <FormSheetTitle>پیش‌نویس جدید</FormSheetTitle>
        </FormSheetHeader>
        <FormSheetBody className="space-y-5 px-5 py-4">
          <label className="block space-y-2 text-sm font-medium">
            مشتری
            <ClientPicker
              clients={localClients}
              value={clientId}
              onChange={setClientId}
              onClientCreated={(client) => {
                setLocalClients((current) => [...current, client])
                void queryClient.invalidateQueries({
                  queryKey: getApiV1ClientsQueryKey(),
                })
              }}
              hostActive={open}
            />
          </label>
          <label className="block space-y-2 text-sm font-medium">
            خدمت
            <ServicePicker
              services={services}
              value={serviceId}
              onChange={setServiceId}
            />
          </label>
          <div className="space-y-2">
            <p className="text-sm font-medium">تاریخ‌های قابل قبول</p>
            {dates.map((date, index) => (
              <Input
                key={index}
                type="date"
                value={date}
                onChange={(event) =>
                  setDates((current) =>
                    current.map((value, i) =>
                      i === index ? event.target.value : value,
                    ),
                  )
                }
              />
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDates((current) => [...current, ''])}
            >
              <Plus className="size-3.5" /> تاریخ دیگر
            </Button>
          </div>
          <label className="block space-y-2 text-sm font-medium">
            ترجیح زمانی
            <Select
              value={timePreference}
              onValueChange={(value) =>
                setTimePreference(value as keyof typeof TIME_PREFERENCE_LABELS)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TIME_PREFERENCE_LABELS).map(
                  ([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </label>
          <label className="block space-y-2 text-sm font-medium">
            یادداشت (اختیاری)
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
          {errorMessage && (
            <p className="text-xs text-destructive">{errorMessage}</p>
          )}
        </FormSheetBody>
        <FormSheetFooter>
          <Button onClick={submit} disabled={createDraft.isPending}>
            {createDraft.isPending ? (
              <Spinner className="size-4" />
            ) : (
              'ثبت پیش‌نویس'
            )}
          </Button>
        </FormSheetFooter>
      </FormSheetContent>
    </FormSheet>
  )
}

function FocusBanner({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-line-soft bg-blush-soft px-3.5 py-2.5 text-plum-deep">
      <Sparkles className="size-4 shrink-0" />
      <p className="flex-1 text-[12px] font-semibold">نمایش یک درخواست</p>
      <button
        type="button"
        onClick={onClear}
        className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-bold text-primary"
      >
        نمایش همه
        <ChevronLeft className="size-3.5" />
      </button>
    </div>
  )
}

function PhoneActions({ phone, name }: { phone: string; name: string }) {
  const waPhone = phone.replace(/^0/, '98')
  return (
    <div className="flex shrink-0 gap-2">
      <a
        href={`tel:${phone}`}
        aria-label={`تماس با ${name}`}
        className="flex size-9 items-center justify-center rounded-xl bg-paper-deep text-foreground transition-opacity active:opacity-70"
      >
        <Phone className="size-4" />
      </a>
      <a
        href={`https://wa.me/${waPhone}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`واتس‌اپ ${name}`}
        className="flex size-9 items-center justify-center rounded-xl bg-paper-deep text-foreground transition-opacity active:opacity-70"
      >
        <MessageCircle className="size-4" />
      </a>
    </div>
  )
}

function PendingCard({
  request,
  staff,
  services,
  onChanged,
}: {
  request: ExactAppointmentRequestListItem
  staff: User[]
  services: Service[]
  onChanged: () => void
}) {
  const [staffId, setStaffId] = useState('')
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [errMsg, setErrMsg] = useState<string | null>(null)

  const capableStaff = useMemo(
    () =>
      staff.filter((u) => {
        if (u.serviceIds == null) return true
        return u.serviceIds.includes(request.serviceId)
      }),
    [staff, request.serviceId],
  )

  const service = services.find((s) => s.id === request.serviceId)
  const serviceVariantChanged =
    service != null &&
    (service.name !== request.bookedServiceName ||
      service.duration !== request.bookedServiceDuration ||
      service.price !== request.bookedServicePrice)

  const isReturning = request.existingClient != null
  const name = request.existingClient?.name ?? request.customerName

  const approveMutation = useApproveAppointmentRequestMutation()
  const rejectMutation = useRejectAppointmentRequestMutation()

  const submitting = approveMutation.isPending || rejectMutation.isPending

  const approve = () => {
    if (!staffId) {
      setErrMsg('لطفاً پرسنل را انتخاب کنید')
      return
    }
    setErrMsg(null)
    approveMutation.mutate(
      { requestId: request.id, staffId },
      {
        onSuccess: () => {
          setErrMsg(null)
          onChanged()
        },
        onError: (e: unknown) => {
          setErrMsg(e instanceof Error ? e.message : 'تأیید درخواست انجام نشد')
        },
      },
    )
  }

  const reject = () => {
    setErrMsg(null)
    rejectMutation.mutate(
      {
        requestId: request.id,
        ...(rejectReason.trim() ? { reason: rejectReason.trim() } : {}),
      },
      {
        onSuccess: () => {
          setErrMsg(null)
          setRejectOpen(false)
          setRejectReason('')
          onChanged()
        },
        onError: (e: unknown) => {
          setErrMsg(e instanceof Error ? e.message : 'رد درخواست انجام نشد')
        },
      },
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius)] border border-line-soft border-s-[3px] border-s-amber bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <ClientAvatar
          name={name}
          accent={isReturning ? 'var(--mint)' : 'var(--sky)'}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[15px] font-bold text-foreground">
              {name}
            </span>
            <Badge variant={isReturning ? 'mint' : 'sky'}>
              {isReturning ? 'بازگشتی' : 'جدید'}
            </Badge>
          </div>
          <p
            className="mt-0.5 truncate text-[12px] tabular-nums text-muted-foreground"
            dir="ltr"
          >
            {displayPhone(request.customerPhone)}
          </p>
        </div>
        <PhoneActions phone={request.customerPhone} name={name} />
      </div>

      <div className="flex flex-col gap-2 rounded-2xl bg-background p-3.5">
        <div className="flex items-center gap-2">
          <Scissors className="size-3.5 shrink-0 text-primary" />
          <span className="flex-1 text-[13px] font-semibold text-foreground">
            {request.bookedServiceName}
          </span>
          {serviceVariantChanged && (
            <Badge variant="danger">خدمت تغییر کرده</Badge>
          )}
          <span className="text-[12px] tabular-nums text-muted-foreground">
            {toPersianDigits(
              request.bookedServicePrice.toLocaleString('en-US'),
            )}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11.5px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Calendar className="size-3" />
            {formatJalaliFullDate(request.requestedDate)}
          </span>
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Clock className="size-3" />
            {formatPersianTime(request.requestedStartTime)} تا{' '}
            {formatPersianTime(request.requestedEndTime)} ·{' '}
            {toPersianDigits(request.bookedServiceDuration)} دقیقه
          </span>
        </div>
        {request.notes && (
          <p className="border-t border-dashed border-border pt-2 text-[11.5px] italic leading-relaxed text-sage-deep">
            «‌ {request.notes} ‌»
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Select value={staffId} onValueChange={setStaffId}>
          <SelectTrigger className="h-10 rounded-xl border-line-soft">
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

        {errMsg && <p className="text-xs text-destructive">{errMsg}</p>}

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="rounded-xl text-destructive"
            disabled={submitting}
            onClick={() => setRejectOpen(true)}
          >
            <X className="size-4" strokeWidth={2.2} />
            رد
          </Button>
          <Button
            className="flex-1 rounded-xl"
            disabled={submitting || !staffId}
            onClick={approve}
          >
            <Check className="size-4" strokeWidth={2.2} />
            تأیید
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
            onFocus={(e) => scrollFocusedInputIntoView(e.target)}
          />
          {errMsg && <p className="text-xs text-destructive">{errMsg}</p>}
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
    </div>
  )
}

function DecidedCard({
  request,
  status,
}: {
  request: ExactAppointmentRequestListItem
  status: Exclude<StatusTab, 'pending'>
}) {
  const meta = DECIDED[status]
  const Icon = meta.icon
  const name = request.existingClient?.name ?? request.customerName

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-[var(--radius)] border border-line-soft bg-card p-3.5 shadow-sm',
        status !== 'approved' && 'opacity-80',
      )}
    >
      <div
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-xl',
          meta.tile,
        )}
      >
        <Icon className="size-[18px]" strokeWidth={2.2} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-semibold text-foreground">{name}</span>
          <Badge variant={meta.tone}>{meta.label}</Badge>
        </div>
        <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
          {request.bookedServiceName} ·{' '}
          {formatJalaliFullDate(request.requestedDate)} ·{' '}
          <span className="tabular-nums">
            {formatPersianTime(request.requestedStartTime)}
          </span>
        </p>
        {status === 'rejected' && request.rejectionReason && (
          <p className="mt-0.5 text-[11px] text-destructive">
            {request.rejectionReason}
          </p>
        )}
      </div>
    </div>
  )
}

function EmptyState({ status }: { status: StatusTab }) {
  const copy = EMPTY_COPY[status]
  return (
    <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
      <div className="relative mb-1 flex size-[88px] items-center justify-center overflow-hidden rounded-full bg-blush-soft text-primary">
        <SakuraMark
          size={70}
          color="color-mix(in oklch, var(--primary) 18%, transparent)"
          className="absolute"
          style={{ insetInlineStart: 9, top: 9 }}
        />
        <Inbox className="relative size-[30px]" strokeWidth={1.6} />
      </div>
      <p className="text-[15px] font-bold text-foreground">{copy.title}</p>
      <p className="max-w-[260px] text-[12.5px] leading-relaxed text-muted-foreground">
        {copy.sub}
      </p>
    </div>
  )
}
