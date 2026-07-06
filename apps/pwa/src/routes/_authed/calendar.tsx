import { useState, useMemo, useCallback, useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO, subDays, addDays } from 'date-fns'
import { Plus, Search, X } from 'lucide-react'
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
  ServicePackage,
} from '@repo/salon-core/types'
import { getApiV1ServicePackages } from '@repo/api-client/sdk'
import { getApiV1ServicePackagesQueryKey } from '@repo/api-client/query'

import { useAuth } from '#/lib/auth'
import { businessSettingsQueryOptions } from '#/lib/settings-queries'
import {
  appointmentsRangeInvalidationKeys,
  appointmentsRangeQueryOptions,
  getApiV1AppointmentsQueryKey,
} from '#/lib/appointments-queries'
import { servicesListQueryOptions } from '#/lib/services-queries'
import {
  clientsListQueryOptions,
  getApiV1ClientsQueryKey,
} from '#/lib/clients-queries'
import { staffListQueryOptions } from '#/lib/staff-queries'
import { CalendarHeader } from '#/components/calendar/calendar-header'
import { SalonFullCalendar } from '#/components/calendar/salon-full-calendar'
import { StaffFilter } from '#/components/calendar/staff-filter'
import { ServiceFilter } from '#/components/calendar/service-filter'
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

const searchSchema = z.object({
  date: z.string().optional(),
  clientId: z.string().optional(),
  appointmentId: z.string().optional(),
})

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
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([])
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

  const appointmentsQuery = useQuery({
    ...appointmentsRangeQueryOptions(startDate, endDate),
    placeholderData: (prev) => prev,
  })

  const staffQuery = useQuery(staffListQueryOptions())
  const servicesQuery = useQuery(servicesListQueryOptions())
  const packagesQuery = useQuery({
    queryKey: getApiV1ServicePackagesQueryKey(),
    enabled: isManager,
    queryFn: async ({ signal }) => {
      const { data } = await getApiV1ServicePackages({
        signal,
        throwOnError: true,
      })
      return data.packages
    },
  })

  const clientsQuery = useQuery({
    ...clientsListQueryOptions(),
    enabled: isManager,
  })

  const businessQuery = useQuery(businessSettingsQueryOptions())

  const appointments = useMemo<AppointmentWithDetails[]>(
    () => appointmentsQuery.data ?? [],
    [appointmentsQuery.data],
  )
  const staff = staffQuery.data ?? []
  const services = servicesQuery.data ?? []
  const servicePackages: ServicePackage[] =
    (packagesQuery.data as unknown as ServicePackage[] | undefined)?.filter(
      (pkg) => pkg.active && pkg.components.length > 0,
    ) ?? []
  const clients = clientsQuery.data ?? []
  const businessHours: BusinessHours = useMemo(() => {
    const s = businessQuery.data
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
  }, [businessQuery.data])

  const businessWorkingStart = businessHours.workingStart
  const appointmentFlow = useAppointmentFlow({
    defaultDate: format(navDate, 'yyyy-MM-dd'),
    defaultTime: businessWorkingStart,
  })

  const filterableServices = useMemo(() => {
    const byId = new Map(services.map((service) => [service.id, service]))
    for (const appointment of appointments) {
      if (!byId.has(appointment.service.id)) {
        byId.set(appointment.service.id, appointment.service)
      }
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'fa'))
  }, [appointments, services])

  const filteredAppointments = useMemo(() => {
    if (!isManager) return appointments
    return appointments.filter((a) => {
      const staffMatches =
        selectedStaffIds.length === 0 || selectedStaffIds.includes(a.staffId)
      const serviceMatches =
        selectedServiceIds.length === 0 ||
        selectedServiceIds.includes(a.serviceId)
      return staffMatches && serviceMatches
    })
  }, [appointments, selectedServiceIds, selectedStaffIds, isManager])

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

  const activeFilterAppointments = useMemo(() => {
    if (
      !isManager ||
      (selectedStaffIds.length === 0 && selectedServiceIds.length === 0)
    ) {
      return []
    }
    return appointments
      .filter((a) => {
        const staffMatches =
          selectedStaffIds.length === 0 || selectedStaffIds.includes(a.staffId)
        const serviceMatches =
          selectedServiceIds.length === 0 ||
          selectedServiceIds.includes(a.serviceId)
        return staffMatches && serviceMatches
      })
      .sort(compareAppointments)
  }, [appointments, isManager, selectedServiceIds, selectedStaffIds])

  const filteredOutsideVisible = useMemo(() => {
    if (!visibleRange) return []
    return activeFilterAppointments.filter(
      (a) => a.date < visibleRange.start || a.date > visibleRange.end,
    )
  }, [activeFilterAppointments, visibleRange])

  const nextFilteredAppointment = useMemo<AppointmentWithDetails | null>(() => {
    const today = format(new Date(), 'yyyy-MM-dd')
    const upcoming = filteredOutsideVisible.find((a) => a.date >= today)
    if (upcoming) return upcoming
    return filteredOutsideVisible.length > 0 ? filteredOutsideVisible[0] : null
  }, [filteredOutsideVisible])

  const hasActiveFilters =
    selectedStaffIds.length > 0 || selectedServiceIds.length > 0
  const activeFilterLabel = useMemo(() => {
    const parts: string[] = []
    const selected = staff.filter((member) =>
      selectedStaffIds.includes(member.id),
    )
    if (selected.length === 1) parts.push(selected[0].name)
    else if (selected.length > 1) parts.push(`${selected.length} نفر`)

    const selectedServices = filterableServices.filter((service) =>
      selectedServiceIds.includes(service.id),
    )
    if (selectedServices.length === 1) parts.push(selectedServices[0].name)
    else if (selectedServices.length > 1) {
      parts.push(`${selectedServices.length} خدمت`)
    }

    return parts.join(' و ')
  }, [filterableServices, selectedServiceIds, selectedStaffIds, staff])

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
    if (!nextFilteredAppointment) return
    const parsed = parseISO(nextFilteredAppointment.date)
    if (Number.isNaN(parsed.getTime())) return
    setNavDate(parsed)
    setTitleAnchor(parsed)
    setRange(null)
    setVisibleRange(null)
  }, [nextFilteredAppointment])

  const handleClearFilters = useCallback(() => {
    setSelectedStaffIds([])
    setSelectedServiceIds([])
  }, [])

  const upsertAppointmentInCache = useCallback(
    (appointment: AppointmentWithDetails) => {
      const shouldKeep =
        appointment.date >= startDate && appointment.date <= endDate
      queryClient.setQueryData<AppointmentWithDetails[]>(
        getApiV1AppointmentsQueryKey({
          query: { startDate, endDate },
        }),
        (current) => {
          const base = current ?? appointments
          const withoutApt = base.filter((a) => a.id !== appointment.id)
          const next = shouldKeep
            ? [...withoutApt, appointment].sort(compareAppointments)
            : withoutApt
          return next
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
        queryKey: appointmentsRangeInvalidationKeys()[0],
      })
    },
    [appointmentFlow.actions, queryClient, upsertAppointmentInCache],
  )

  const handlePackageBooked = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: appointmentsRangeInvalidationKeys()[0],
    })
  }, [queryClient])

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
        queryClient.setQueryData<AppointmentWithDetails[]>(
          getApiV1AppointmentsQueryKey({
            query: { startDate, endDate },
          }),
          (current) => current?.filter((a) => a.id !== change.id),
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
        queryKey: appointmentsRangeInvalidationKeys()[0],
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
    void packagesQuery.refetch()
    void businessQuery.refetch()
    if (isManager) void clientsQuery.refetch()
  }, [
    appointmentsQuery,
    staffQuery,
    servicesQuery,
    packagesQuery,
    businessQuery,
    clientsQuery,
    isManager,
  ])

  if (appointmentsQuery.isLoading && appointments.length === 0) {
    return <CalendarSkeleton />
  }

  if (!user) return null

  if (appointmentsQuery.isError) {
    return (
      <div className="flex h-full flex-col bg-background">
        <CalendarHeader
          titleAnchor={titleAnchor}
          navigationDate={navDate}
          view={view}
          onDateChange={setNavDate}
          onToday={handleToday}
        />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-sm font-bold text-foreground">
            تقویم فعلا آماده نمایش نیست
          </p>
          <p className="text-xs leading-6 text-muted-foreground">
            بارگذاری تقویم کامل نشد. یک بار دیگر تلاش کنید.
          </p>
          <Button type="button" onClick={handleRetry}>
            تلاش دوباره
          </Button>
        </div>
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

      <div className="flex flex-col gap-2 border-b border-border/50 bg-card/90 px-3 py-2 sm:flex-row sm:items-center sm:px-4">
        <div className="flex w-full shrink-0 items-stretch rounded-2xl bg-muted/70 p-0.5 sm:flex-1 sm:shrink">
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

        {isManager && (staff.length > 0 || filterableServices.length > 0) && (
          <div className="flex w-full gap-2 sm:w-auto sm:shrink-0">
            {staff.length > 0 && (
              <StaffFilter
                staff={staff}
                selectedIds={selectedStaffIds}
                onChange={setSelectedStaffIds}
              />
            )}
            {filterableServices.length > 0 && (
              <ServiceFilter
                services={filterableServices}
                selectedIds={selectedServiceIds}
                onChange={setSelectedServiceIds}
              />
            )}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className={cn(
                  'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-bold transition-colors touch-manipulation',
                  'border-line-soft bg-card text-muted-foreground shadow-sm',
                  'hover:border-destructive/35 hover:bg-destructive/8 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35',
                )}
                aria-label="پاک کردن همه فیلترها"
              >
                <X className="size-4" />
                <span>پاک کردن</span>
              </button>
            )}
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
            (selectedStaffIds.length > 0 || selectedServiceIds.length > 0) &&
            visibleFilteredAppointments.length === 0 && (
              <div className="pointer-events-none absolute inset-x-3 top-4 z-30 flex justify-center">
                <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-border/70 bg-card/95 p-4 text-right shadow-lg shadow-foreground/10 backdrop-blur">
                  <p className="text-sm font-bold text-foreground">
                    برای {activeFilterLabel} در این بازه نوبتی دیده نمی‌شود
                  </p>
                  <p className="mt-1.5 text-xs leading-6 text-muted-foreground">
                    فیلتر تقویم فعال است. می‌توانید فیلتر را پاک کنید یا به
                    نزدیک‌ترین نوبت همین انتخاب‌ها در داده‌های بارگذاری‌شده
                    بروید.
                  </p>
                  {nextFilteredAppointment && (
                    <p className="mt-2 text-xs font-semibold text-foreground">
                      نزدیک‌ترین نوبت:{' '}
                      {formatPersianFullDate(
                        parseISO(nextFilteredAppointment.date),
                      )}
                    </p>
                  )}
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row-reverse">
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-10 rounded-xl"
                      onClick={handleClearFilters}
                    >
                      پاک کردن فیلتر
                    </Button>
                    {nextFilteredAppointment && (
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
            disabled={services.length === 0 || staff.length === 0}
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
        packages={servicePackages}
        clients={clients}
        availabilityInitialDate={format(navDate, 'yyyy-MM-dd')}
        onAppointmentCreated={handleAppointmentCreated}
        onPackageBooked={handlePackageBooked}
        onDetailChange={handleDetailChange}
        onClientsChanged={() => {
          void queryClient.invalidateQueries({
            queryKey: getApiV1ClientsQueryKey(),
          })
        }}
        detailReadOnly={!isManager}
        intakeEnabled={isManager}
      />
    </div>
  )
}
