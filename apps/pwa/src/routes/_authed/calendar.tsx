import { useState, useMemo, useCallback, useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO, subDays, addDays } from 'date-fns'
import { Plus, Search } from 'lucide-react'
import { z } from 'zod'
import type { AvailabilitySlot } from '@repo/salon-core/availability'
import { cn } from '@repo/ui/utils'
import { WORKING_HOURS } from '@repo/salon-core/types'
import { DEFAULT_WORKING_DAYS } from '@repo/salon-core/working-days'
import type {
  AppointmentWithDetails,
  BusinessHours,
  CalendarView,
  Client,
  Service,
  User,
} from '@repo/salon-core/types'

import { api } from '#/lib/api-client'
import { useAuth } from '#/lib/auth'
import { useNetworkStatus } from '#/lib/network-status'
import { useCalendarIndexedDbSources } from '#/lib/use-calendar-indexeddb-sources'
import { CalendarHeader } from '#/components/calendar/calendar-header'
import { SalonFullCalendar } from '#/components/calendar/salon-full-calendar'
import { StaffFilter } from '#/components/calendar/staff-filter'
import {
  ConcurrentAppointmentsSheet,
  buildConcurrencyClusters,
} from '#/components/calendar/concurrent-appointments-sheet'
import { CalendarSkeleton } from '#/components/calendar/calendar-skeleton'
import { AppointmentDrawer } from '#/components/calendar/appointment-drawer'
import { AvailabilityDrawer } from '#/components/calendar/availability-drawer'
import { AppointmentDetailDrawer } from '#/components/calendar/appointment-detail-drawer'
import type { AppointmentDetailChange } from '#/components/calendar/appointment-detail-drawer'
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
type StaffResponse = { staff: User[] }
type ServicesResponse = { services: Service[] }
type ClientsResponse = { clients: Client[] }
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

  const [selectedAppointment, setSelectedAppointment] =
    useState<AppointmentWithDetails | null>(null)

  const [showAvailabilityDrawer, setShowAvailabilityDrawer] = useState(false)
  const [showCreateDrawer, setShowCreateDrawer] = useState(false)
  const [createDate, setCreateDate] = useState<string>('')
  const [createTime, setCreateTime] = useState<string>('')
  const [initialStaffIdForCreate, setInitialStaffIdForCreate] = useState<
    string | undefined
  >(undefined)
  const [initialServiceIdForCreate, setInitialServiceIdForCreate] = useState<
    string | undefined
  >(undefined)
  const [initialClientIdForCreate, setInitialClientIdForCreate] = useState<
    string | undefined
  >(undefined)

  const fallbackRange = useMemo(() => defaultRange(navDate), [navDate])
  const { start: startDate, end: endDate } = range ?? fallbackRange

  const appointmentsQuery = useQuery<AppointmentsResponse>({
    queryKey: appointmentsKey(startDate, endDate),
    queryFn: ({ signal }) =>
      api.appointments.listRange({ startDate, endDate }, { signal }),
    placeholderData: (prev) => prev,
  })

  const staffQuery = useQuery<StaffResponse>({
    queryKey: ['staff', 'list'],
    queryFn: ({ signal }) => api.staff.list({ signal }),
  })

  const servicesQuery = useQuery<ServicesResponse>({
    queryKey: ['services', 'list'],
    queryFn: ({ signal }) => api.services.list({ signal }),
  })

  const clientsQuery = useQuery<ClientsResponse>({
    queryKey: ['clients'],
    queryFn: ({ signal }) => api.clients.list({ signal }),
    enabled: Boolean(user && isManager),
  })

  const businessQuery = useQuery<BusinessResponse>({
    queryKey: ['settings', 'business'],
    queryFn: ({ signal }) => api.businessSettings.get({ signal }),
  })

  const indexedDbLive = useMemo(
    () => ({
      appointmentsData: appointmentsQuery.data,
      staffData: staffQuery.data,
      servicesData: servicesQuery.data,
      clientsData: clientsQuery.data,
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
  const staffSource = idb.staff ?? staffQuery.data
  const servicesSource = idb.services ?? servicesQuery.data
  const clientsSource = idb.clients ?? clientsQuery.data
  const businessSource = idb.business ?? businessQuery.data

  const appointments = useMemo<AppointmentWithDetails[]>(
    () => appointmentsSource?.appointments ?? [],
    [appointmentsSource],
  )
  const staff: User[] = staffSource?.staff ?? []
  const services: Service[] = servicesSource?.services ?? []
  const clients: Client[] = useMemo(
    () => clientsSource?.clients ?? [],
    [clientsSource],
  )

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

  const filteredAppointments = useMemo(() => {
    if (!isManager || selectedStaffIds.length === 0) return appointments
    return appointments.filter((a) => selectedStaffIds.includes(a.staffId))
  }, [appointments, selectedStaffIds, isManager])

  const clustersById = useMemo(
    () => buildConcurrencyClusters(filteredAppointments),
    [filteredAppointments],
  )

  useEffect(() => {
    if (!search.date) return
    const parsed = parseISO(search.date)
    if (Number.isNaN(parsed.getTime())) return
    setNavDate(parsed)
    setTitleAnchor(parsed)
    setRange(null)
  }, [search.date])

  const businessWorkingStart = businessHours.workingStart

  useEffect(() => {
    if (!isManager || !search.clientId || clients.length === 0) return
    if (!clients.some((c) => c.id === search.clientId)) return
    setInitialClientIdForCreate(search.clientId)
    setInitialStaffIdForCreate(undefined)
    setInitialServiceIdForCreate(undefined)
    setCreateDate(format(navDate, 'yyyy-MM-dd'))
    setCreateTime(businessWorkingStart)
    setShowCreateDrawer(true)
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
  ])

  useEffect(() => {
    if (!search.appointmentId) return
    const target = appointments.find((a) => a.id === search.appointmentId)
    if (!target) return
    setSelectedAppointment(target)
    navigate({
      to: '/calendar',
      search: ({ date }) => ({ date }),
      replace: true,
    })
  }, [search.appointmentId, appointments, navigate])

  const handleVisibleRangeChange = useCallback(
    (start: string, endInclusive: string, activeStart: Date) => {
      const paddedStart = format(subDays(parseISO(start), 14), 'yyyy-MM-dd')
      const paddedEnd = format(
        addDays(parseISO(endInclusive), 14),
        'yyyy-MM-dd',
      )
      setRange({ start: paddedStart, end: paddedEnd })
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
  }

  const handleAddAppointment = useCallback(() => {
    if (!isManager) return
    setInitialClientIdForCreate(undefined)
    setInitialStaffIdForCreate(undefined)
    setInitialServiceIdForCreate(undefined)
    setCreateDate(format(navDate, 'yyyy-MM-dd'))
    setCreateTime(businessWorkingStart)
    setShowCreateDrawer(true)
  }, [isManager, navDate, businessWorkingStart])

  const handleSlotSelect = useCallback(
    (dateStr: string, timeStr: string) => {
      if (!isManager) return
      setInitialClientIdForCreate(undefined)
      setInitialStaffIdForCreate(undefined)
      setInitialServiceIdForCreate(undefined)
      setCreateDate(dateStr)
      setCreateTime(timeStr)
      setShowCreateDrawer(true)
    },
    [isManager],
  )

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
      setShowCreateDrawer(false)
      setInitialClientIdForCreate(undefined)
      setInitialStaffIdForCreate(undefined)
      setInitialServiceIdForCreate(undefined)
      void queryClient.invalidateQueries({
        queryKey: ['appointments', 'range'],
      })
    },
    [queryClient, upsertAppointmentInCache],
  )

  const handleCreateDrawerOpenChange = useCallback((open: boolean) => {
    setShowCreateDrawer(open)
    if (!open) {
      setInitialClientIdForCreate(undefined)
      setInitialStaffIdForCreate(undefined)
      setInitialServiceIdForCreate(undefined)
    }
  }, [])

  const handleOpenAvailability = useCallback(() => {
    if (!isManager) return
    setShowAvailabilityDrawer(true)
  }, [isManager])

  const handleAvailabilitySlotSelect = useCallback(
    (selection: { slot: AvailabilitySlot; serviceId: string }) => {
      setShowAvailabilityDrawer(false)
      setInitialClientIdForCreate(undefined)
      setInitialStaffIdForCreate(selection.slot.staffId)
      setInitialServiceIdForCreate(selection.serviceId)
      setCreateDate(selection.slot.date)
      setCreateTime(selection.slot.startTime)
      requestAnimationFrame(() => setShowCreateDrawer(true))
    },
    [],
  )

  const handleAppointmentClick = (appointment: AppointmentWithDetails) => {
    const supportsCluster = view === 'day' || view === 'week'
    const cluster = clustersById.get(appointment.id)
    if (supportsCluster && cluster && cluster.length > 1) {
      setConcurrentCluster(cluster)
      return
    }
    setSelectedAppointment(appointment)
  }

  const handleConcurrentSelect = useCallback(
    (appointment: AppointmentWithDetails) => {
      setConcurrentCluster(null)
      setSelectedAppointment(appointment)
    },
    [],
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
        setSelectedAppointment(null)
      } else {
        upsertAppointmentInCache(change.appointment)
        setSelectedAppointment(change.appointment)
      }
      void queryClient.invalidateQueries({
        queryKey: ['appointments', 'range'],
      })
    },
    [queryClient, startDate, endDate, upsertAppointmentInCache],
  )

  const handleDetailDrawerOpenChange = useCallback((open: boolean) => {
    if (!open) setSelectedAppointment(null)
  }, [])

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
          hasSnapshot={!isOnline && idb.offlineMeta.loaded}
          snapshotUpdatedAt={idb.offlineMeta.appointmentsUpdatedAt}
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
        hasSnapshot={!isOnline && idb.offlineMeta.loaded}
        snapshotUpdatedAt={idb.offlineMeta.appointmentsUpdatedAt}
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
        <SalonFullCalendar
          className="flex-1"
          appointments={filteredAppointments}
          view={view}
          currentDate={navDate}
          businessHours={businessHours}
          readOnly={!isManager}
          onVisibleRangeChange={handleVisibleRangeChange}
          onSlotSelect={handleSlotSelect}
          onEventClick={handleAppointmentClick}
          onClusterClick={setConcurrentCluster}
          isRefreshing={
            appointmentsQuery.isFetching && !appointmentsQuery.isLoading
          }
        />
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

      <AppointmentDetailDrawer
        appointment={selectedAppointment}
        onOpenChange={handleDetailDrawerOpenChange}
        staff={staff}
        services={services}
        clients={clients}
        onSuccess={handleDetailChange}
        onClientsChanged={() => {
          void queryClient.invalidateQueries({ queryKey: ['clients'] })
        }}
        readOnly={!isManager}
      />

      {isManager && (
        <AvailabilityDrawer
          open={showAvailabilityDrawer}
          onOpenChange={setShowAvailabilityDrawer}
          initialDate={format(navDate, 'yyyy-MM-dd')}
          staff={staff}
          services={services}
          onSelectSlot={handleAvailabilitySlotSelect}
        />
      )}

      {isManager && (
        <AppointmentDrawer
          open={showCreateDrawer}
          onOpenChange={handleCreateDrawerOpenChange}
          initialDate={createDate}
          initialTime={createTime}
          initialStaffId={initialStaffIdForCreate}
          initialServiceId={initialServiceIdForCreate}
          initialClientId={initialClientIdForCreate}
          staff={staff}
          services={services}
          clients={clients}
          onSuccess={handleAppointmentCreated}
          onClientsChanged={() => {
            void queryClient.invalidateQueries({ queryKey: ['clients'] })
          }}
        />
      )}
    </div>
  )
}
