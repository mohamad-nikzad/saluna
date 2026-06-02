import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Banknote,
  Bell,
  Globe,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Moon,
  Scissors,
  Sun,
  UserPlus,
  UserRoundSearch,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@repo/ui/button'
import { Badge } from '@repo/ui/badge'
import { Card, CardContent, CardHeader } from '@repo/ui/card'
import { Skeleton } from '@repo/ui/skeleton'
import { SakuraMark } from '@repo/ui/sakura-mark'
import { cn } from '@repo/ui/utils'
import { displayPhone } from '@repo/salon-core/phone'
import { toPersianDigits } from '@repo/salon-core/persian-digits'
import { DEFAULT_WORKING_DAYS } from '@repo/salon-core/working-days'
import { businessSettingsSchema } from '@repo/salon-core/forms/settings'
import type {
  BusinessSettingsInput,
  BusinessSettingsPayload,
} from '@repo/salon-core/forms/settings'

import { useAuth } from '#/lib/auth'
import {
  useBumpOfflineData,
  useManagerDataClient,
} from '#/lib/manager-data-client'
import { useTheme } from '#/lib/theme'
import { api } from '#/lib/api-client'
import { useManagerBusinessSettingsQuery } from '#/lib/manager-data-queries'
import {
  dashboardQueryKey,
  notificationPreferencesQueryKey,
} from '#/lib/query-keys'
import { BusinessHoursFields } from '#/components/business-hours/business-hours-fields'
import { MessagingAccountsSection } from '#/components/settings/messaging-accounts-section'
import { SettingsRow, ToggleRow } from '#/components/settings/settings-rows'

type DashboardMetrics = {
  monthRevenue: number
  totalClients: number
  newClientsThisMonth: number
}

export const Route = createFileRoute('/_authed/settings')({
  component: SettingsPage,
})

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '؟'
  if (parts.length === 1) return parts[0].slice(0, 2)
  return `${parts[0][0]}${parts[1][0]}`
}

function formatRevenueCompact(value: number) {
  if (value >= 1_000_000) {
    return `${toPersianDigits((value / 1_000_000).toFixed(1).replace('.', '٫'))} م`
  }
  if (value >= 1_000) {
    return `${toPersianDigits(Math.round(value / 1_000))} هـ`
  }
  return toPersianDigits(value)
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-1.5 pb-2 pt-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
      {children}
    </div>
  )
}

function SettingsGroup({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <GroupLabel>{label}</GroupLabel>
      <div className="divide-y divide-line-soft overflow-hidden rounded-[18px] border border-line-soft bg-card">
        {children}
      </div>
    </div>
  )
}

function MetricTile({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: LucideIcon
  label: string
  value: string
  accent: string
}) {
  return (
    <div className="flex-1 rounded-[18px] border border-line-soft bg-card p-3">
      <Icon className={cn('size-4', accent)} strokeWidth={1.8} />
      <div className="mt-1.5 text-lg font-extrabold tracking-tight tabular-nums text-foreground">
        {value}
      </div>
      <div className="mt-0.5 text-[10px] text-muted-foreground">{label}</div>
    </div>
  )
}

function SettingsSkeleton() {
  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex items-center gap-4 bg-card px-4 py-3 border-b border-border/50">
        <h1 className="text-lg font-bold">تنظیمات</h1>
      </header>
      <div className="flex-1 overflow-auto p-4 space-y-3">
        <Card className="border-border/50">
          <CardContent className="flex items-center gap-4 py-4">
            <Skeleton className="h-14 w-14 rounded-full shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <Skeleton className="h-4 w-14" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function SettingsPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const dc = useManagerDataClient()
  const bumpOfflineData = useBumpOfflineData()
  const [loggingOut, setLoggingOut] = useState(false)
  const [localAlerts, setLocalAlerts] = useState<boolean | null>(null)
  const isManager = user?.role === 'manager'

  const businessSettingsQuery = useManagerBusinessSettingsQuery(
    isManager && !!dc,
  )
  const notificationPrefsQuery = useQuery({
    queryKey: notificationPreferencesQueryKey,
    queryFn: ({ signal }) => api.notificationPreferences.get({ signal }),
  })
  const dashboardQuery = useQuery({
    queryKey: dashboardQueryKey,
    queryFn: ({ signal }) => api.dashboard.get({ signal }),
    enabled: isManager,
  })

  const updateLocalAlerts = useMutation({
    mutationFn: (enabled: boolean) =>
      api.notificationPreferences.update({ localAlertsEnabled: enabled }),
    meta: {
      skipSuccessToast: true,
      invalidatesQuery: notificationPreferencesQueryKey,
    },
  })

  const saveBusinessHoursMutation = useMutation({
    mutationFn: (values: BusinessSettingsPayload) =>
      dc!.businessSettings.update(values),
    meta: { errorMessage: 'ذخیره ساعات کاری انجام نشد' },
    onSuccess: () => bumpOfflineData(),
  })

  const {
    handleSubmit: handleBusinessHoursSubmit,
    reset: resetBusinessHours,
    setValue: setBusinessHoursValue,
    watch: watchBusinessHours,
    formState: { errors: businessHoursErrors, isSubmitting: savingHours },
  } = useForm<BusinessSettingsInput, any, BusinessSettingsPayload>({
    resolver: zodResolver(businessSettingsSchema),
    defaultValues: {
      workingStart: '09:00',
      workingEnd: '19:00',
      slotDurationMinutes: 30,
      workingDays: DEFAULT_WORKING_DAYS,
    },
  })
  const workingStart = watchBusinessHours('workingStart') ?? '09:00'
  const workingEnd = watchBusinessHours('workingEnd') ?? '19:00'
  const slotMin = Number(watchBusinessHours('slotDurationMinutes') ?? 30)
  const workingDays = watchBusinessHours('workingDays') ?? DEFAULT_WORKING_DAYS

  useEffect(() => {
    const settings = businessSettingsQuery.data
    if (settings) {
      resetBusinessHours(settings)
    }
  }, [businessSettingsQuery.data, resetBusinessHours])

  useEffect(() => {
    if (notificationPrefsQuery.data) {
      setLocalAlerts(
        Boolean(notificationPrefsQuery.data.preferences.localAlertsEnabled),
      )
    }
  }, [notificationPrefsQuery.data])

  const handleLogout = async () => {
    setLoggingOut(true)
    await logout()
    await navigate({ to: '/login', replace: true })
  }

  const toggleDarkMode = (enabled: boolean) => {
    setTheme(enabled ? 'dark' : 'light')
  }

  const toggleLocalAlerts = (next: boolean) => {
    setLocalAlerts(next)
    updateLocalAlerts.mutate(next, {
      onError: () => setLocalAlerts(!next),
    })
  }

  const saveBusinessHours = handleBusinessHoursSubmit(async (values) => {
    if (!dc) return
    try {
      await saveBusinessHoursMutation.mutateAsync(values)
    } catch {
      // Toast handled by mutation cache.
    }
  })

  const settingsDataLoading =
    isManager && !!dc && businessSettingsQuery.isPending
  if (settingsDataLoading) {
    return <SettingsSkeleton />
  }

  if (!user) return null

  const metrics: DashboardMetrics | null =
    dashboardQuery.data && typeof dashboardQuery.data.totalClients === 'number'
      ? {
          monthRevenue: dashboardQuery.data.monthRevenue,
          totalClients: dashboardQuery.data.totalClients,
          newClientsThisMonth: dashboardQuery.data.newClientsThisMonth,
        }
      : null
  const darkMode = theme === 'dark'

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="border-b border-line-soft bg-card px-5 pt-3.5 pb-4">
        <div className="text-[22px] font-extrabold tracking-tight text-foreground">
          {isManager ? 'بیشتر' : 'تنظیمات'}
        </div>
        {isManager ? (
          <div className="mt-0.5 text-[13px] text-muted-foreground">
            مدیریت، گزارش‌ها و تنظیمات سالن
          </div>
        ) : null}
      </header>

      <div className="flex-1 overflow-auto px-5 pb-7 pt-4">
        <div className="flex flex-col gap-4">
          <div className="profile-surface relative flex items-center gap-3.5 overflow-hidden rounded-[22px] p-4">
            <SakuraMark
              size={150}
              color="rgba(124,45,66,.10)"
              style={{ position: 'absolute', insetInlineStart: -30, top: -30 }}
            />
            <div className="relative flex size-14 shrink-0 items-center justify-center rounded-[18px] bg-primary text-lg font-extrabold text-primary-foreground">
              {getInitials(user.name)}
            </div>
            <div className="relative min-w-0 flex-1">
              <div className="truncate text-base font-bold text-foreground">
                {user.name}
              </div>
              <div className="mt-0.5 text-xs text-sage-deep" dir="ltr">
                {displayPhone(user.phone)}
              </div>
              <div className="mt-2">
                <Badge variant="plum">{isManager ? 'مدیر' : 'پرسنل'}</Badge>
              </div>
            </div>
          </div>

          {isManager && metrics ? (
            <div className="flex gap-2.5">
              <MetricTile
                icon={Banknote}
                label="درآمد ماه"
                value={formatRevenueCompact(metrics.monthRevenue)}
                accent="text-mint"
              />
              <MetricTile
                icon={Users}
                label="مشتری فعال"
                value={toPersianDigits(metrics.totalClients)}
                accent="text-plum-deep"
              />
              <MetricTile
                icon={UserPlus}
                label="جدید این ماه"
                value={toPersianDigits(metrics.newClientsThisMonth)}
                accent="text-sky"
              />
            </div>
          ) : null}

          {isManager ? (
            <SettingsGroup label="مدیریت سالن">
              <SettingsRow
                icon={LayoutDashboard}
                label="داشبورد و آمار"
                hint="گزارش روزانه و عملکرد"
                to="/dashboard"
              />
              <SettingsRow
                icon={UserRoundSearch}
                label="پیگیری مشتریان"
                hint="مشتریانی که نیاز به پیگیری دارند"
                to="/retention"
              />
              <SettingsRow
                icon={Scissors}
                label="خدمات و قیمت‌ها"
                hint="بخش‌ها، گروه‌ها، مدت و قیمت"
                to="/services"
              />
              <SettingsRow
                icon={Users}
                label="پرسنل و نقش‌ها"
                hint="مدیریت پرسنل، خدمات و ساعت کاری"
                to="/staff"
              />
              <SettingsRow
                icon={Globe}
                label="صفحه عمومی سالن"
                hint="لینک نوبت‌گیری برای مشتریان"
                to="/public-page"
              />
              <SettingsRow
                icon={ListChecks}
                label="راه‌اندازی سالن"
                hint="مراحل آماده‌سازی"
                to="/onboarding"
              />
            </SettingsGroup>
          ) : null}

          {localAlerts !== null ? (
            <SettingsGroup label="اعلان‌ها">
              <ToggleRow
                icon={Bell}
                label="اعلان درون‌برنامه"
                hint="یادآور نوبت‌ها و درخواست‌ها"
                checked={localAlerts}
                disabled={updateLocalAlerts.isPending}
                onChange={(next) => void toggleLocalAlerts(next)}
              />
              <MessagingAccountsSection />
            </SettingsGroup>
          ) : null}

          {isManager ? (
            <div>
              <GroupLabel>ساعات کاری</GroupLabel>
              <div className="space-y-4 rounded-[18px] border border-line-soft bg-card p-4">
                <BusinessHoursFields
                  variant="settings"
                  workingStart={workingStart}
                  workingEnd={workingEnd}
                  slotDurationMinutes={slotMin}
                  workingDays={workingDays}
                  onWorkingStartChange={(value) =>
                    setBusinessHoursValue('workingStart', value)
                  }
                  onWorkingEndChange={(value) =>
                    setBusinessHoursValue('workingEnd', value)
                  }
                  onSlotDurationChange={(value) =>
                    setBusinessHoursValue('slotDurationMinutes', value)
                  }
                  onWorkingDaysChange={(value) =>
                    setBusinessHoursValue('workingDays', value)
                  }
                  errors={businessHoursErrors}
                />
                <Button
                  size="sm"
                  className="w-full touch-manipulation"
                  disabled={savingHours}
                  onClick={saveBusinessHours}
                >
                  {savingHours ? 'در حال ذخیره…' : 'ذخیره ساعات کاری'}
                </Button>
              </div>
            </div>
          ) : null}

          <SettingsGroup label="ظاهر">
            <ToggleRow
              icon={darkMode ? Moon : Sun}
              label="حالت تاریک"
              hint="هماهنگ با سیستم"
              checked={darkMode}
              onChange={toggleDarkMode}
            />
          </SettingsGroup>

          <SettingsGroup label="حساب">
            <SettingsRow
              icon={LogOut}
              label={loggingOut ? 'در حال خروج…' : 'خروج از حساب'}
              onClick={() => void handleLogout()}
              danger
              loading={loggingOut}
              disabled={loggingOut}
            />
          </SettingsGroup>

          <div className="pb-2 pt-2 text-center">
            <div className="text-[13px] font-bold tracking-wide text-muted-foreground/60">
              سالورا
            </div>
            <div className="mt-0.5 text-[10px] text-muted-foreground/40">
              نسخه ۱.۰.۰
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
