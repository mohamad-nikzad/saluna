import { useState, useMemo, useCallback, useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO, subDays, addDays } from 'date-fns'
import { Plus, Search } from 'lucide-react'
import { z } from 'zod'
import { cn } from '@repo/ui/utils'
import { Button } from '@repo/ui/button'
import { WORKING_HOURS } from '@repo/salon-core/types'
import { DEFAULT_WORKING_DAYS } from '@repo/salon-core/working-days'
import { formatPersianFullDate } from '@repo/salon-core/jalali-display'
import type {
  AppointmentWithDetails,
  BusinessHours,
  CalendarView,
} from '@repo/salon-core/types'

import { api } from '#/lib/api-client'
import { useAuth } from '#/lib/auth'
import { useManagerDataClient } from '#/lib/manager-data-client'
import {
  useManagerClientsQuery,
  useManagerServicesQuery,
  useManagerStaffQuery,
} from '#/lib/manager-data-queries'
import { useNetworkStatus } from '#/lib/network-status'
import { managerClientsQueryKey } from '#/lib/query-keys'
import { useCalendarIndexedDbSources } from '#/lib/use-calendar-indexeddb-sources'
import { CalendarHeader } from '#/components/calendar/calendar-header'
import { SalonFullCalendar } from '#/components/calendar/salon-full-calendar'
import { StaffFilter } from '#/components/calendar/staff-filter'
import { DaySummarySheet } from '#/components/calendar/day-summary-sheet'
import {
  ConcurrentAppointmentsSheet,
  buildConcurrencyClusters,
} from '#/components/calendar/concurrent-appointments-sheet'
import { CalendarSkeleton } from '#/components/calendar/calendar-skeleton'
import {
  AppointmentFlowDrawers,
  useAppointmentFlow,
} from '#/components/appointments'
import type { AppointmentDetailChange } from '#/lib/appointment-surface'
import {
  NetworkStatusBanner,
  OfflineStateCard,
} from '#/components/offline-state'

const searchSchema = z.object({
  date: z.string().optional(),
  clientId: z.string().optional(),
  appointmentId: z.string().optional(),
})

type AppointmentsResponse = { appointments: AppointmentWithDetails[] }
type BusinessResponse = { settings: BusinessHours | null }

const VIEW_OPTIONS: { value: CalendarView; label: string }[] = [
  { value: 'day', label: 'روز' },
  { value: 'week', label: 'هفته' },
  { value: 'month', label: 'ماه' },
  { value: 'list', label: 'لیست' },
]

function defaultRange(anchor: Date) {
  return {
    start: format(subDays(anchor, 120), 'yyyy-MM-dd'),
    end: format(addDays(anchor, 120), 'yyyy-MM-dd'),
  }
}

const appointmentsKey = (start: string, end: string) =>
  ['appointments', 'range', start, end] as const

export const Route = createFileRoute('/_authed/calendar')({
  validateSearch: searchSchema,
  component: CalendarPage,
  pendingComponent: CalendarSkeleton,
})

function compareAppointments(
  a: AppointmentWithDetails,
  b: AppointmentWithDetails,
) {
  return `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`)
}

function CalendarPage() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const { user } = useAuth()
  const dc = useManagerDataClient()
  const isOnline = useNetworkStatus()
  const isManager = user?.role === 'manager'
  const queryClient = useQueryClient()

  const [view, setView] = useState<CalendarView>(() => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 640px)').matches
    ) {
      return 'day'
    }
    return 'week'
  })
  const [navDate, setNavDate] = useState(() => new Date())
  const [titleAnchor, setTitleAnchor] = useState(() => new Date())
  const [range, setRange] = useState<{ start: string; end: string } | null>(
    null,
  )
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([])
  const [concurrentCluster, setConcurrentCluster] = useState<
    AppointmentWithDetails[] | null
  >(null)
  const [summaryDate, setSummaryDate] = useState<string | null>(null)
  const [visibleRange, setVisibleRange] = useState<{
    start: string
    end: string
  } | null>(null)

  const fallbackRange = useMemo(() => defaultRange(navDate), [navDate])
  const { start: startDate, end: endDate } = range ?? fallbackRange

  const appointmentsQuery = useQuery<AppointmentsResponse>({
    queryKey: appointmentsKey(startDate, endDate),
    queryFn: ({ signal }) =>
      api.appointments.listRange({ startDate, endDate }, { signal }),
    placeholderData: (prev) => prev,
  })

  const staffQuery = useManagerStaffQuery(!!dc)
  const servicesQuery = useManagerServicesQuery(!!dc)

  const clientsQuery = useManagerClientsQuery(Boolean(dc && isManager))

  const businessQuery = useQuery<BusinessResponse>({
    queryKey: ['settings', 'business'],
    queryFn: ({ signal }) => api.businessSettings.get({ signal }),
  })

  const indexedDbLive = useMemo(
    () => ({
      appointmentsData: appointmentsQuery.data,
      staff: staffQuery.data,
      services: servicesQuery.data,
      clients: clientsQuery.data,
      businessData: businessQuery.data,
    }),
    [
      appointmentsQuery.data,
      staffQuery.data,
      servicesQuery.data,
      clientsQuery.data,
      businessQuery.data,
    ],
  )

  const idb = useCalendarIndexedDbSources(
    Boolean(user),
    isOnline,
    Boolean(isManager),
    startDate,
    endDate,
    indexedDbLive,
  )

  const appointmentsSource = idb.appointments ?? appointmentsQuery.data
  const businessSource = idb.business ?? businessQuery.data

  const appointments = useMemo<AppointmentWithDetails[]>(
    () => appointmentsSource?.appointments ?? [],
    [appointmentsSource],
  )
  const staff = idb.staff
  const services = idb.services
  const clients = idb.clients

  const businessHours: BusinessHours = useMemo(() => {
    const s = businessSource?.settings
    if (s) {
      return {
        workingStart: s.workingStart,
        workingEnd: s.workingEnd,
        slotDurationMinutes: s.slotDurationMinutes,
        workingDays: s.workingDays,
      }
    }
    return {
      workingStart: WORKING_HOURS.start,
      workingEnd: WORKING_HOURS.end,
      slotDurationMinutes: WORKING_HOURS.slotDuration,
      workingDays: DEFAULT_WORKING_DAYS,
    }
  }, [businessSource])

  const businessWorkingStart = businessHours.workingStart
  const appointmentFlow = useAppointmentFlow({
    defaultDate: format(navDate, 'yyyy-MM-dd'),
    defaultTime: businessWorkingStart,
  })

  const filteredAppointments = useMemo(() => {
    if (!isManager || selectedStaffIds.length === 0) return appointments
    return appointments.filter((a) => selectedStaffIds.includes(a.staffId))
  }, [appointments, selectedStaffIds, isManager])

  const clustersById = useMemo(
    () => buildConcurrencyClusters(filteredAppointments),
    [filteredAppointments],
  )

  const visibleFilteredAppointments = useMemo(() => {
    if (!visibleRange) return filteredAppointments
    return filteredAppointments.filter(
      (a) => a.date >= visibleRange.start && a.date <= visibleRange.end,
    )
  }, [filteredAppointments, visibleRange])

  const selectedStaffAppointments = useMemo(() => {
    if (!isManager || selectedStaffIds.length === 0) return []
    return appointments
      .filter((a) => selectedStaffIds.includes(a.staffId))
      .sort(compareAppointments)
  }, [appointments, isManager, selectedStaffIds])

  const selectedStaffOutsideVisible = useMemo(() => {
    if (!visibleRange) return []
    return selectedStaffAppointments.filter(
      (a) => a.date < visibleRange.start || a.date > visibleRange.end,
    )
  }, [selectedStaffAppointments, visibleRange])

  const nextSelectedStaffAppointment =
    useMemo<AppointmentWithDetails | null>(() => {
      const today = format(new Date(), 'yyyy-MM-dd')
      const upcoming = selectedStaffOutsideVisible.find((a) => a.date >= today)
      if (upcoming) return upcoming
      return selectedStaffOutsideVisible.length > 0
        ? selectedStaffOutsideVisible[0]
        : null
    }, [selectedStaffOutsideVisible])

  const selectedStaffLabel = useMemo(() => {
    const selected = staff.filter((member) =>
      selectedStaffIds.includes(member.id),
    )
    if (selected.length === 0) return ''
    if (selected.length === 1) return selected[0].name
    return `${selected.length} نفر انتخاب شده`
  }, [selectedStaffIds, staff])

  useEffect(() => {
    if (!search.date) return
    const parsed = parseISO(search.date)
    if (Number.isNaN(parsed.getTime())) return
    setNavDate(parsed)
    setTitleAnchor(parsed)
    setRange(null)
  }, [search.date])

  useEffect(() => {
    if (!isManager || !search.clientId || clients.length === 0) return
    if (!clients.some((c) => c.id === search.clientId)) return
    appointmentFlow.actions.openCreateIntent({
      date: format(navDate, 'yyyy-MM-dd'),
      time: businessWorkingStart,
      clientId: search.clientId,
    })
    navigate({
      to: '/calendar',
      search: ({ date }) => ({ date }),
      replace: true,
    })
  }, [
    search.clientId,
    clients,
    isManager,
    navDate,
    businessWorkingStart,
    navigate,
    appointmentFlow.actions,
  ])

  useEffect(() => {
    if (!search.appointmentId) return
    const target = appointments.find((a) => a.id === search.appointmentId)
    if (!target) return
    appointmentFlow.actions.openDetail(target)
    navigate({
      to: '/calendar',
      search: ({ date }) => ({ date }),
      replace: true,
    })
  }, [search.appointmentId, appointments, navigate, appointmentFlow.actions])

  const handleVisibleRangeChange = useCallback(
    (start: string, endInclusive: string, activeStart: Date) => {
      const paddedStart = format(subDays(parseISO(start), 14), 'yyyy-MM-dd')
      const paddedEnd = format(
        addDays(parseISO(endInclusive), 14),
        'yyyy-MM-dd',
      )
      setRange({ start: paddedStart, end: paddedEnd })
      setVisibleRange({ start, end: endInclusive })
      setTitleAnchor(activeStart)
    },
    [],
  )

  const handleStaffToggle = (id: string) => {
    setSelectedStaffIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    )
  }

  const handleToday = () => {
    const t = new Date()
    setNavDate(t)
    setTitleAnchor(t)
    setRange(null)
    setVisibleRange(null)
  }

  const handleAddAppointment = useCallback(() => {
    if (!isManager) return
    appointmentFlow.actions.openCreate(
      format(navDate, 'yyyy-MM-dd'),
      businessWorkingStart,
    )
  }, [appointmentFlow.actions, businessWorkingStart, isManager, navDate])

  const handleSlotSelect = useCallback(
    (dateStr: string, timeStr: string) => {
      if (!isManager) return
      appointmentFlow.actions.openCreate(dateStr, timeStr)
    },
    [appointmentFlow.actions, isManager],
  )

  const handleOpenDaySummary = useCallback((dateStr: string) => {
    const parsed = parseISO(dateStr)
    if (!Number.isNaN(parsed.getTime())) {
      setNavDate(parsed)
      setTitleAnchor(parsed)
    }
    setSummaryDate(dateStr)
  }, [])

  const handleCreateFromDaySummary = useCallback(
    (dateStr: string) => {
      setSummaryDate(null)
      if (!isManager) return
      appointmentFlow.actions.openCreate(dateStr, businessWorkingStart)
    },
    [appointmentFlow.actions, businessWorkingStart, isManager],
  )

  const handleOpenAppointmentFromSummary = useCallback(
    (appointment: AppointmentWithDetails) => {
      setSummaryDate(null)
      appointmentFlow.actions.openDetail(appointment)
    },
    [appointmentFlow.actions],
  )

  const handleJumpToFilteredAppointment = useCallback(() => {
    if (!nextSelectedStaffAppointment) return
    const parsed = parseISO(nextSelectedStaffAppointment.date)
    if (Number.isNaN(parsed.getTime())) return
    setNavDate(parsed)
    setTitleAnchor(parsed)
    setRange(null)
    setVisibleRange(null)
  }, [nextSelectedStaffAppointment])

  const upsertAppointmentInCache = useCallback(
    (appointment: AppointmentWithDetails) => {
      const shouldKeep =
        appointment.date >= startDate && appointment.date <= endDate
      queryClient.setQueryData<AppointmentsResponse>(
        appointmentsKey(startDate, endDate),
        (current) => {
          const base = current?.appointments ?? appointments
          const withoutApt = base.filter((a) => a.id !== appointment.id)
          const next = shouldKeep
            ? [...withoutApt, appointment].sort(compareAppointments)
            : withoutApt
          return { ...(current ?? { appointments: [] }), appointments: next }
        },
      )
    },
    [appointments, endDate, queryClient, startDate],
  )

  const handleAppointmentCreated = useCallback(
    (appointment: AppointmentWithDetails) => {
      upsertAppointmentInCache(appointment)
      appointmentFlow.actions.closeCreateAfterSuccess()
      void queryClient.invalidateQueries({
        queryKey: ['appointments', 'range'],
      })
    },
    [appointmentFlow.actions, queryClient, upsertAppointmentInCache],
  )

  const handleOpenAvailability = useCallback(() => {
    if (!isManager) return
    appointmentFlow.actions.setAvailabilityOpen(true)
  }, [appointmentFlow.actions, isManager])

  const handleAppointmentClick = (appointment: AppointmentWithDetails) => {
    const supportsCluster = view === 'day' || view === 'week'
    const cluster = clustersById.get(appointment.id)
    if (supportsCluster && cluster && cluster.length > 1) {
      setConcurrentCluster(cluster)
      return
    }
    appointmentFlow.actions.openDetail(appointment)
  }

  const handleConcurrentSelect = useCallback(
    (appointment: AppointmentWithDetails) => {
      setConcurrentCluster(null)
      appointmentFlow.actions.openDetail(appointment)
    },
    [appointmentFlow.actions],
  )

  const handleDetailChange = useCallback(
    (change: AppointmentDetailChange) => {
      if (change.type === 'deleted') {
        queryClient.setQueryData<AppointmentsResponse>(
          appointmentsKey(startDate, endDate),
          (current) =>
            current
              ? {
                  ...current,
                  appointments: current.appointments.filter(
                    (a) => a.id !== change.id,
                  ),
                }
              : current,
        )
        appointmentFlow.actions.closeDetail()
      } else {
        upsertAppointmentInCache(change.appointment)
        if (change.source === 'edit') {
          appointmentFlow.actions.closeDetail()
        } else {
          appointmentFlow.actions.openDetail(change.appointment)
        }
      }
      void queryClient.invalidateQueries({
        queryKey: ['appointments', 'range'],
      })
    },
    [
      appointmentFlow.actions,
      queryClient,
      startDate,
      endDate,
      upsertAppointmentInCache,
    ],
  )

  const handleRetry = useCallback(() => {
    void appointmentsQuery.refetch()
    void staffQuery.refetch()
    void servicesQuery.refetch()
    void businessQuery.refetch()
    if (isManager) void clientsQuery.refetch()
  }, [
    appointmentsQuery,
    staffQuery,
    servicesQuery,
    businessQuery,
    clientsQuery,
    isManager,
  ])

  if (appointmentsQuery.isLoading && !appointmentsSource) {
    return <CalendarSkeleton />
  }

  if (!user) return null

  if (!appointmentsSource) {
    return (
      <div className="flex h-full flex-col bg-background">
        <CalendarHeader
          titleAnchor={titleAnchor}
          navigationDate={navDate}
          view={view}
          onDateChange={setNavDate}
          onToday={handleToday}
        />
        <NetworkStatusBanner
          routeLabel="تقویم"
          isOnline={isOnline}
          hasSnapshot={idb.hasSnapshot}
          snapshotUpdatedAt={idb.snapshotUpdatedAt}
          hasError={Boolean(appointmentsQuery.error)}
          onRetry={handleRetry}
        />
        <OfflineStateCard
          title="تقویم فعلا آماده نمایش نیست"
          description={
            isOnline
              ? 'بارگذاری تقویم کامل نشد. یک بار دیگر تلاش کنید.'
              : 'برای دیدن تقویم به اینترنت نیاز دارید، مگر این که قبلاً همین بازه را با همین حساب باز کرده باشید.'
          }
          onAction={handleRetry}
        />
      </div>
    )
  }

  return (
    <div className="relative flex h-full flex-col bg-background">
      <CalendarHeader
        titleAnchor={titleAnchor}
        navigationDate={navDate}
        view={view}
        onDateChange={setNavDate}
        onToday={handleToday}
      />

      <NetworkStatusBanner
        routeLabel="تقویم"
        isOnline={isOnline}
        hasSnapshot={idb.hasSnapshot}
        snapshotUpdatedAt={idb.snapshotUpdatedAt}
        hasError={Boolean(appointmentsQuery.error)}
        onRetry={handleRetry}
      />

      <div className="flex flex-col gap-2 border-b border-border/50 bg-card/90 px-3 py-2 sm:flex-row sm:items-center sm:px-4">
        <div className="flex w-full shrink-0 items-stretch rounded-2xl bg-muted/70 p-0.5">
          {VIEW_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setView(opt.value)}
              aria-pressed={view === opt.value}
              className={cn(
                'min-h-10 flex-1 rounded-xl px-3 text-xs font-semibold transition-[background-color,color,box-shadow] touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30',
                view === opt.value
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {isManager && staff.length > 0 && (
          <div className="w-full overflow-hidden sm:flex-1">
            <StaffFilter
              staff={staff}
              selectedIds={selectedStaffIds}
              onToggle={handleStaffToggle}
              onClear={() => setSelectedStaffIds([])}
            />
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="relative flex min-h-0 flex-1">
          <SalonFullCalendar
            className="flex-1"
            appointments={filteredAppointments}
            view={view}
            currentDate={navDate}
            businessHours={businessHours}
            readOnly={!isManager}
            onVisibleRangeChange={handleVisibleRangeChange}
            onSlotSelect={handleSlotSelect}
            onDaySummaryOpen={handleOpenDaySummary}
            onEventClick={handleAppointmentClick}
            onClusterClick={setConcurrentCluster}
            isRefreshing={
              appointmentsQuery.isFetching && !appointmentsQuery.isLoading
            }
          />
          {isManager &&
            selectedStaffIds.length > 0 &&
            visibleFilteredAppointments.length === 0 && (
              <div className="pointer-events-none absolute inset-x-3 top-4 z-30 flex justify-center">
                <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-border/70 bg-card/95 p-4 text-right shadow-lg shadow-foreground/10 backdrop-blur">
                  <p className="text-sm font-bold text-foreground">
                    برای {selectedStaffLabel} در این بازه نوبتی دیده نمی‌شود
                  </p>
                  <p className="mt-1.5 text-xs leading-6 text-muted-foreground">
                    فیلتر پرسنل فعال است. می‌توانید فیلتر را پاک کنید یا به
                    نزدیک‌ترین نوبت همین پرسنل در داده‌های بارگذاری‌شده بروید.
                  </p>
                  {nextSelectedStaffAppointment && (
                    <p className="mt-2 text-xs font-semibold text-foreground">
                      نزدیک‌ترین نوبت:{' '}
                      {formatPersianFullDate(
                        parseISO(nextSelectedStaffAppointment.date),
                      )}
                    </p>
                  )}
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row-reverse">
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-10 rounded-xl"
                      onClick={() => setSelectedStaffIds([])}
                    >
                      پاک کردن فیلتر
                    </Button>
                    {nextSelectedStaffAppointment && (
                      <Button
                        type="button"
                        className="min-h-10 rounded-xl"
                        onClick={handleJumpToFilteredAppointment}
                      >
                        رفتن به نوبت بعدی
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
        </div>
      </div>

      {isManager && (
        <div className="absolute bottom-5 left-4 z-40 flex flex-col items-center gap-3">
          <button
            onClick={handleOpenAvailability}
            disabled={!isOnline || services.length === 0 || staff.length === 0}
            className="flex h-14 w-14 items-center justify-center rounded-[18px] border border-border bg-card text-foreground shadow-lg shadow-foreground/10 transition-all active:scale-[0.92] disabled:pointer-events-none disabled:opacity-40 touch-manipulation"
            aria-label="بررسی زمان خالی"
          >
            <Search className="h-6 w-6" />
          </button>
          <button
            onClick={handleAddAppointment}
            className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-linear-to-br from-primary to-primary/85 text-primary-foreground shadow-lg shadow-primary/30 transition-all active:scale-[0.92] touch-manipulation"
            aria-label="نوبت جدید"
          >
            <Plus className="h-6 w-6" strokeWidth={2.5} />
          </button>
        </div>
      )}

      <ConcurrentAppointmentsSheet
        cluster={concurrentCluster}
        onOpenChange={(open) => !open && setConcurrentCluster(null)}
        onSelectAppointment={handleConcurrentSelect}
      />

      <DaySummarySheet
        date={summaryDate}
        appointments={filteredAppointments}
        canCreate={isManager}
        onOpenChange={(open) => !open && setSummaryDate(null)}
        onCreateAppointment={handleCreateFromDaySummary}
        onOpenAppointment={handleOpenAppointmentFromSummary}
      />

      <AppointmentFlowDrawers
        flow={appointmentFlow}
        staff={staff}
        services={services}
        clients={clients}
        availabilityInitialDate={format(navDate, 'yyyy-MM-dd')}
        onAppointmentCreated={handleAppointmentCreated}
        onDetailChange={handleDetailChange}
        onClientsChanged={() => {
          void queryClient.invalidateQueries({
            queryKey: managerClientsQueryKey,
          })
        }}
        detailReadOnly={!isManager}
        intakeEnabled={isManager}
      />
    </div>
  )
}
