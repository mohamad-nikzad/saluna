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
  MoreVertical,
  Phone,
  Pencil,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@repo/ui/dropdown-menu'
import { scrollFocusedInputIntoView } from '#/lib/scroll-focused-input-into-view'
import {
  toPersianDigits,
  formatPersianTime,
} from '@repo/salon-core/persian-digits'
import {
  formatJalaliFullDate,
  JALALI_WEEKDAYS_SHORT,
} from '@repo/salon-core/jalali'
import { salonTodayYmd } from '@repo/salon-core/salon-local-time'
import {
  nextSalonWeekDates,
  normalizeAcceptableDates,
} from '@repo/salon-core/appointment-request-timing'
import { displayPhone } from '@repo/salon-core/phone'
import type { User, Service } from '@repo/salon-core/types'

import {
  appointmentRequestsListQueryOptions,
  getApiV1AppointmentRequestsQueryKey,
  pendingAppointmentRequestsQueryOptions,
  pendingDraftsQueryOptions,
  useCreateDraftMutation,
  useApproveAppointmentRequestMutation,
  useCancelAppointmentRequestMutation,
  useRejectAppointmentRequestMutation,
  useRenewTerminalRequestMutation,
  type AppointmentRequestStatus,
  type ExactAppointmentRequestListItem,
  type FlexibleAppointmentRequestListItem,
} from '#/lib/appointment-requests-queries'
import { organizeDrafts } from '#/lib/draft-queue'
import { servicesListQueryOptions } from '#/lib/services-queries'
import {
  clientsListQueryOptions,
  getApiV1ClientsQueryKey,
} from '#/lib/clients-queries'
import { staffListQueryOptions } from '#/lib/staff-queries'
import { ClientAvatar } from '#/components/clients/client-visuals'
import {
  DRAFT_TIME_PREFERENCE_LABELS,
  DraftTimingFields,
  ConvertDraftSheet,
  EditDraftSheet,
  formatAcceptableDateChip,
  formatNextWeekRangeLabel,
} from '#/components/appointment-requests/draft-timing'
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
  tab: z.literal('drafts').optional(),
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
  const { focus, tab: draftsTab } = Route.useSearch()
  const [tab, setTab] = useState<RequestsTab>(() =>
    draftsTab === 'drafts' ? 'drafts' : 'pending',
  )
  const [counts, setCounts] = useState<Partial<Record<StatusTab, number>>>({})
  const [newDraftOpen, setNewDraftOpen] = useState(false)
  const initial = Route.useLoaderData()

  useEffect(() => {
    if (draftsTab === 'drafts') setTab('drafts')
  }, [draftsTab])

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
      void navigate({
        to: '/requests',
        search: id === 'drafts' ? { tab: 'drafts' } : {},
      })
    },
    [navigate],
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
          {activeTab === 'drafts' ? (
            <Button
              type="button"
              size="sm"
              className="shrink-0"
              onClick={() => setNewDraftOpen(true)}
            >
              <Plus className="size-4" />
              پیش‌نویس جدید
            </Button>
          ) : null}
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
          <DraftsPanel
            createOpen={newDraftOpen}
            onCreateOpenChange={setNewDraftOpen}
          />
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
  const [renewingRequest, setRenewingRequest] = useState<
    ExactAppointmentRequestListItem | FlexibleAppointmentRequestListItem | null
  >(null)

  const { data, error, isLoading } = useQuery(
    appointmentRequestsListQueryOptions(
      status,
      status === 'pending' ? 'exact' : undefined,
    ),
  )

  const { data: staffData } = useQuery({
    ...staffListQueryOptions(),
    enabled: status === 'pending',
  })
  const { data: servicesData, isLoading: servicesLoading } = useQuery(
    servicesListQueryOptions(),
  )
  const { data: clientsData = [], isLoading: clientsLoading } = useQuery({
    ...clientsListQueryOptions(),
    enabled: status !== 'pending',
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
    <>
      <div className="flex flex-col gap-3">
        {requests.map((req) =>
          status === 'pending' && req.timingMode === 'exact' ? (
            <PendingCard
              key={req.id}
              request={req}
              staff={staffData ?? []}
              services={servicesData ?? []}
              onChanged={onChanged}
            />
          ) : status !== 'pending' ? (
            <DecidedCard
              key={req.id}
              request={req}
              status={status}
              onRenew={() => setRenewingRequest(req)}
              renewDisabled={clientsLoading || servicesLoading}
            />
          ) : null,
        )}
      </div>
      {renewingRequest ? (
        <NewDraftSheet
          key={renewingRequest.id}
          source={renewingRequest}
          open
          onOpenChange={(open) => {
            if (!open) setRenewingRequest(null)
          }}
          clients={clientsData}
          services={(servicesData ?? []).filter((service) => service.active)}
        />
      ) : null}
    </>
  )
}

const DRAFT_GROUP_META = {
  'this-week': {
    label: 'این هفته',
    accent: 'bg-primary',
  },
  'next-week': {
    label: 'هفته آینده',
    accent: 'bg-sky',
  },
  later: {
    label: 'بعدتر',
    accent: 'bg-plum-deep',
  },
  elapsed: {
    label: 'تاریخ‌های گذشته',
    accent: 'bg-muted-foreground',
  },
} as const

function DraftsPanel({
  createOpen,
  onCreateOpenChange,
}: {
  createOpen: boolean
  onCreateOpenChange: (open: boolean) => void
}) {
  const { data, isLoading } = useQuery(pendingDraftsQueryOptions())
  const { data: clients = [] } = useQuery(clientsListQueryOptions())
  const { data: services = [] } = useQuery(servicesListQueryOptions())
  const { data: staff = [] } = useQuery(staffListQueryOptions())
  const [editingDraft, setEditingDraft] =
    useState<FlexibleAppointmentRequestListItem | null>(null)
  const [convertingDraft, setConvertingDraft] =
    useState<FlexibleAppointmentRequestListItem | null>(null)

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
  const sections = organizeDrafts(drafts, salonTodayYmd())

  return (
    <div className="space-y-4">
      {drafts.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm font-bold">پیش‌نویسی ثبت نشده</p>
          <p className="mt-1 text-xs text-muted-foreground">
            درخواست‌های تلفنی و پیام‌ها را اینجا ثبت کنید.
          </p>
        </div>
      ) : (
        sections.map((section) => {
          const meta = DRAFT_GROUP_META[section.id]
          return (
            <section
              key={section.id}
              aria-labelledby={`draft-section-${section.id}`}
              className="overflow-hidden rounded-2xl border border-line-soft bg-muted/30"
            >
              <div className="flex items-center gap-2 px-3.5 pt-3 pb-2">
                <span
                  className={cn('size-1.5 shrink-0 rounded-full', meta.accent)}
                />
                <h2
                  id={`draft-section-${section.id}`}
                  className="min-w-0 flex-1 truncate text-[12px] font-bold text-foreground/75"
                >
                  {meta.label}
                </h2>
                <span
                  className="shrink-0 text-[11px] font-bold tabular-nums text-muted-foreground"
                  aria-label={`${toPersianDigits(section.drafts.length)} پیش‌نویس`}
                >
                  {toPersianDigits(section.drafts.length)}
                </span>
              </div>
              <div className="space-y-2 px-2 pb-2">
                {section.drafts.map((draft) => (
                  <DraftCard
                    key={draft.id}
                    draft={draft}
                    onEdit={() => setEditingDraft(draft)}
                    onConvert={() => setConvertingDraft(draft)}
                  />
                ))}
              </div>
            </section>
          )
        })
      )}
      <NewDraftSheet
        open={createOpen}
        onOpenChange={onCreateOpenChange}
        clients={clients}
        services={services.filter((service) => service.active)}
      />
      {editingDraft && (
        <EditDraftSheet
          draft={editingDraft}
          open
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setEditingDraft(null)
          }}
        />
      )}
      {convertingDraft ? (
        <ConvertDraftSheet
          draft={convertingDraft}
          staff={staff}
          open
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setConvertingDraft(null)
          }}
        />
      ) : null}
    </div>
  )
}

function DraftAcceptableDatesSummary({
  dates,
  today,
}: {
  dates: string[]
  today: string
}) {
  const weekDates = nextSalonWeekDates(today)
  const weekSet = new Set(weekDates)
  const inWeek = dates.filter((date) => weekSet.has(date))
  const other = dates.filter((date) => !weekSet.has(date))
  const showWeekSummary = inWeek.length >= 3

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      {showWeekSummary ? (
        <div className="rounded-xl border border-line-soft/80 bg-card px-2.5 py-2">
          <p className="text-[12px] font-semibold text-foreground">
            هفته آینده · {formatNextWeekRangeLabel(weekDates)}
            {inWeek.length < 7
              ? ` · ${toPersianDigits(inWeek.length)} روز`
              : ' · تمام هفته'}
          </p>
          <div className="mt-1.5 grid grid-cols-7 gap-1" dir="rtl">
            {weekDates.map((date, index) => {
              const on = inWeek.includes(date)
              return (
                <span
                  key={date}
                  className={cn(
                    'flex h-7 items-center justify-center rounded-lg text-[11px] font-bold',
                    on
                      ? 'bg-primary/12 text-primary'
                      : 'bg-muted/50 text-muted-foreground/40',
                    date < today && on && 'line-through opacity-60',
                  )}
                >
                  {JALALI_WEEKDAYS_SHORT[index]}
                </span>
              )
            })}
          </div>
        </div>
      ) : (
        <span className="flex flex-wrap gap-1.5">
          {inWeek.map((date) => (
            <span
              key={date}
              className={cn(
                'rounded-lg bg-card px-2 py-1 text-[12px] font-semibold text-foreground shadow-sm ring-1 ring-line-soft/70',
                date < today && 'text-muted-foreground line-through',
              )}
            >
              {formatAcceptableDateChip(date)}
            </span>
          ))}
        </span>
      )}
      {other.length > 0 ? (
        <span className="flex flex-wrap gap-1.5">
          {other.map((date) => (
            <span
              key={date}
              className={cn(
                'rounded-lg bg-card px-2 py-1 text-[12px] font-semibold text-foreground shadow-sm ring-1 ring-line-soft/70',
                date < today && 'text-muted-foreground line-through',
              )}
            >
              {formatAcceptableDateChip(date)}
            </span>
          ))}
        </span>
      ) : null}
    </div>
  )
}

function DraftCard({
  draft,
  onEdit,
  onConvert,
}: {
  draft: FlexibleAppointmentRequestListItem
  onEdit: () => void
  onConvert: () => void
}) {
  const [outcome, setOutcome] = useState<'rejected' | 'cancelled' | null>(null)
  const [closureNote, setClosureNote] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const rejectDraft = useRejectAppointmentRequestMutation()
  const cancelDraft = useCancelAppointmentRequestMutation()
  const clientName = draft.existingClient?.name ?? draft.customerName
  const today = salonTodayYmd()
  const submitting = rejectDraft.isPending || cancelDraft.isPending
  const rejecting = outcome === 'rejected'

  const closeDialog = () => {
    setOutcome(null)
    setClosureNote('')
    setErrorMessage('')
  }

  const closeDraft = () => {
    if (!outcome) return
    const input = {
      requestId: draft.id,
      ...(closureNote.trim() ? { closureNote: closureNote.trim() } : {}),
    }
    const mutation = rejecting ? rejectDraft : cancelDraft
    mutation.mutate(
      rejecting
        ? { requestId: input.requestId, reason: input.closureNote }
        : input,
      {
        onSuccess: closeDialog,
        onError: (error: unknown) =>
          setErrorMessage(
            error instanceof Error ? error.message : 'بستن پیش‌نویس انجام نشد',
          ),
      },
    )
  }
  return (
    <article
      aria-label={`پیش‌نویس ${clientName}`}
      className="flex flex-col gap-3 rounded-xl border border-line-soft/90 border-s-[3px] border-s-primary bg-card p-3.5 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <ClientAvatar name={clientName} accent="var(--mint)" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-extrabold text-foreground">
            {clientName}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <Scissors className="size-3.5 shrink-0 text-primary" />
            <p className="truncate text-[13px] font-semibold text-foreground">
              {draft.bookedServiceName}
            </p>
          </div>
          <p className="mt-1 text-[12px] tabular-nums text-muted-foreground">
            {toPersianDigits(draft.bookedServiceDuration)} دقیقه ·{' '}
            {toPersianDigits(draft.bookedServicePrice.toLocaleString('en-US'))}{' '}
            تومان
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`اقدامات بیشتر برای پیش‌نویس ${clientName}`}
            >
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => setOutcome('rejected')}
            >
              رد توسط سالن
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setOutcome('cancelled')}>
              انصراف مشتری
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex flex-col gap-2.5 rounded-2xl bg-background/90 p-3.5 ring-1 ring-line-soft/60">
        <div className="flex items-start gap-2">
          <Calendar className="mt-1 size-3.5 shrink-0 text-primary" />
          <DraftAcceptableDatesSummary
            dates={draft.acceptableDates}
            today={today}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-border/80 pt-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blush-soft px-2.5 py-1 text-[11.5px] font-bold text-plum-deep">
            <Clock className="size-3" />
            {DRAFT_TIME_PREFERENCE_LABELS[draft.timePreference]}
          </span>
        </div>
        {draft.notes ? (
          <p className="border-t border-dashed border-border/80 pt-2.5 text-[12px] leading-relaxed text-sage-deep">
            «‌ {draft.notes} ‌»
          </p>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          onClick={onEdit}
        >
          <Pencil className="size-4" /> ویرایش
        </Button>
        <Button type="button" className="flex-1 rounded-xl" onClick={onConvert}>
          <Check className="size-4" /> تبدیل به نوبت
        </Button>
      </div>
      <Dialog
        open={outcome != null}
        onOpenChange={(open) => !open && closeDialog()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {rejecting ? 'رد پیش‌نویس' : 'ثبت انصراف مشتری'}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            value={closureNote}
            onChange={(event) => setClosureNote(event.target.value)}
            placeholder="یادداشت پایانی (اختیاری)"
            rows={3}
          />
          {errorMessage && (
            <p className="text-xs text-destructive">{errorMessage}</p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeDialog}
              disabled={submitting}
            >
              انصراف
            </Button>
            <Button
              variant={rejecting ? 'destructive' : 'default'}
              onClick={closeDraft}
              disabled={submitting}
            >
              ثبت نتیجه
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  )
}

function NewDraftSheet({
  open,
  onOpenChange,
  clients,
  services,
  source,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  clients: Client[]
  services: Service[]
  source?: ExactAppointmentRequestListItem | FlexibleAppointmentRequestListItem
}) {
  const queryClient = useQueryClient()
  const [localClients, setLocalClients] = useState(clients)
  const [clientId, setClientId] = useState(() =>
    source?.clientId && clients.some((client) => client.id === source.clientId)
      ? source.clientId
      : '',
  )
  const [serviceId, setServiceId] = useState(() =>
    source && services.some((service) => service.id === source.serviceId)
      ? source.serviceId
      : '',
  )
  const [dates, setDates] = useState<string[]>([])
  const [timePreference, setTimePreference] =
    useState<keyof typeof DRAFT_TIME_PREFERENCE_LABELS>('any')
  const [notes, setNotes] = useState(source?.notes ?? '')
  const [errorMessage, setErrorMessage] = useState('')
  const createDraft = useCreateDraftMutation()
  const renewDraft = useRenewTerminalRequestMutation()
  const today = salonTodayYmd()
  const lockedClient = source?.clientId
    ? localClients.find((client) => client.id === source.clientId)
    : undefined
  const lockedService = source
    ? services.find((service) => service.id === source.serviceId)
    : undefined

  useEffect(() => setLocalClients(clients), [clients])

  const close = () => {
    onOpenChange(false)
    setClientId('')
    setServiceId('')
    setDates([])
    setTimePreference('any')
    setNotes('')
    setErrorMessage('')
  }

  const submit = () => {
    if (!clientId || !serviceId) {
      setErrorMessage('مشتری، خدمت و حداقل یک تاریخ را انتخاب کنید')
      return
    }
    let acceptableDates: string[]
    try {
      acceptableDates = normalizeAcceptableDates(dates, today)
    } catch {
      setErrorMessage('تاریخ‌ها باید یکتا و در ۳۰ روز آینده باشند')
      return
    }
    const requestBody = { clientId, serviceId, acceptableDates, timePreference }
    if (source) {
      renewDraft.mutate(
        { requestId: source.id, body: requestBody },
        { onSuccess: close },
      )
      return
    }
    createDraft.mutate(
      { ...requestBody, ...(notes.trim() ? { notes: notes.trim() } : {}) },
      { onSuccess: close },
    )
  }

  return (
    <FormSheet open={open} onOpenChange={onOpenChange}>
      <FormSheetContent onRequestClose={close}>
        <FormSheetHeader>
          <FormSheetTitle>
            {source ? 'پیش‌نویس تازه از این درخواست' : 'پیش‌نویس جدید'}
          </FormSheetTitle>
        </FormSheetHeader>
        <FormSheetBody className="space-y-5 px-5 py-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">مشتری</p>
            {lockedClient ? (
              <div className="flex h-11 items-center rounded-xl border border-line-soft bg-blush-soft px-3 text-sm">
                {lockedClient.name}
              </div>
            ) : (
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
                ariaLabel="مشتری"
              />
            )}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">خدمت</p>
            <ServicePicker
              services={services}
              value={serviceId}
              onChange={setServiceId}
              disabled={Boolean(lockedService)}
              ariaLabel="خدمت"
            />
          </div>
          <DraftTimingFields
            dates={dates}
            onDatesChange={setDates}
            timePreference={timePreference}
            onTimePreferenceChange={setTimePreference}
            notes={notes}
            onNotesChange={setNotes}
            notesReadOnly={Boolean(source)}
          />
          {errorMessage ? (
            <p className="text-xs text-destructive">{errorMessage}</p>
          ) : null}
        </FormSheetBody>
        <FormSheetFooter>
          <Button
            size="lg"
            onClick={submit}
            disabled={createDraft.isPending || renewDraft.isPending}
          >
            {createDraft.isPending || renewDraft.isPending ? (
              <Spinner className="size-4" />
            ) : source ? (
              'ثبت پیش‌نویس تازه'
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
    <div className="flex flex-col gap-3.5 rounded-2xl border border-line-soft border-s-[3px] border-s-amber bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <ClientAvatar
          name={name}
          accent={isReturning ? 'var(--mint)' : 'var(--sky)'}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-[15px] font-extrabold text-foreground">
              {name}
            </span>
            <Badge variant={isReturning ? 'mint' : 'sky'}>
              {isReturning ? 'بازگشتی' : 'جدید'}
            </Badge>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <Scissors className="size-3.5 shrink-0 text-primary" />
            <p className="truncate text-[13px] font-semibold text-foreground">
              {request.bookedServiceName}
            </p>
            {serviceVariantChanged ? (
              <Badge variant="danger" className="shrink-0">
                خدمت تغییر کرده
              </Badge>
            ) : null}
          </div>
          <p
            className="mt-1 text-[12px] tabular-nums text-muted-foreground"
            dir="ltr"
          >
            {displayPhone(request.customerPhone)}
          </p>
        </div>
        <PhoneActions phone={request.customerPhone} name={name} />
      </div>

      <div className="flex flex-col gap-2.5 rounded-2xl bg-background/90 p-3.5 ring-1 ring-line-soft/60">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-card px-2.5 py-1.5 text-[12px] font-semibold text-foreground shadow-sm ring-1 ring-line-soft/70">
            <Calendar className="size-3.5 text-primary" />
            {formatJalaliFullDate(request.requestedDate)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-card px-2.5 py-1.5 text-[12px] font-semibold tabular-nums text-foreground shadow-sm ring-1 ring-line-soft/70">
            <Clock className="size-3.5 text-primary" />
            {formatPersianTime(request.requestedStartTime)} تا{' '}
            {formatPersianTime(request.requestedEndTime)}
          </span>
        </div>
        <p className="text-[12px] tabular-nums text-muted-foreground">
          {toPersianDigits(request.bookedServiceDuration)} دقیقه ·{' '}
          {toPersianDigits(request.bookedServicePrice.toLocaleString('en-US'))}{' '}
          تومان
        </p>
        {request.notes ? (
          <p className="border-t border-dashed border-border/80 pt-2.5 text-[12px] leading-relaxed text-sage-deep">
            «‌ {request.notes} ‌»
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Select value={staffId} onValueChange={setStaffId}>
          <SelectTrigger className="w-full rounded-xl border-line-soft">
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

        {errMsg ? <p className="text-xs text-destructive">{errMsg}</p> : null}

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
  onRenew,
  renewDisabled,
}: {
  request: ExactAppointmentRequestListItem | FlexibleAppointmentRequestListItem
  status: Exclude<StatusTab, 'pending'>
  onRenew: () => void
  renewDisabled: boolean
}) {
  const meta = DECIDED[status]
  const Icon = meta.icon
  const name = request.existingClient?.name ?? request.customerName
  const closureNote =
    request.timingMode === 'flexible'
      ? request.closureNote
      : request.rejectionReason

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-2xl border border-line-soft bg-card p-4 shadow-sm',
        status !== 'approved' && 'opacity-85',
      )}
    >
      <div className="flex items-start gap-3">
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
            <span className="truncate text-[15px] font-extrabold text-foreground">
              {name}
            </span>
            <Badge variant={meta.tone}>{meta.label}</Badge>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <Scissors className="size-3.5 shrink-0 text-primary" />
            <p className="truncate text-[13px] font-semibold text-foreground">
              {request.bookedServiceName}
            </p>
          </div>
          {request.timingMode === 'exact' ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-lg bg-background px-2 py-1 text-[11.5px] font-semibold text-foreground ring-1 ring-line-soft/70">
                <Calendar className="size-3 text-primary" />
                {formatJalaliFullDate(request.requestedDate)}
              </span>
              <span className="inline-flex items-center gap-1 rounded-lg bg-background px-2 py-1 text-[11.5px] font-semibold tabular-nums text-foreground ring-1 ring-line-soft/70">
                <Clock className="size-3 text-primary" />
                {formatPersianTime(request.requestedStartTime)}
              </span>
            </div>
          ) : null}
          {closureNote ? (
            <p className="mt-2 text-[12px] leading-relaxed text-destructive">
              {closureNote}
            </p>
          ) : null}
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        className="w-full rounded-xl"
        onClick={onRenew}
        disabled={renewDisabled}
      >
        <Plus className="size-4" />
        ایجاد پیش‌نویس جدید از این
      </Button>
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
