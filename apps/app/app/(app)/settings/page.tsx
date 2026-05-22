'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  LogOut,
  Moon,
  Sun,
  Users,
  ChevronLeft,
  LayoutDashboard,
  ListChecks,
  Scissors,
  UserRoundSearch,
} from 'lucide-react'
import { Button } from '@repo/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/card'
import { Avatar, AvatarFallback } from '@repo/ui/avatar'
import { Switch } from '@repo/ui/switch'
import { Input } from '@repo/ui/input'
import { Field, FieldError, FieldLabel, FieldGroup } from '@repo/ui/field'
import { FormRootError } from '@repo/ui/form'
import { TimePicker } from '@repo/ui/time-picker'
import { useAuth } from '@/components/auth-provider'
import {
  useBumpOfflineData,
  useManagerDataClient,
} from '@/components/manager-data-client-provider'
import { Spinner } from '@repo/ui/spinner'
import { SettingsSkeleton } from '@/components/skeletons/settings-skeleton'
import { StaffPushSettings } from '@/components/pwa/staff-push-settings'
import { Badge } from '@repo/ui/badge'
import { displayPhone } from '@repo/salon-core/phone'
import {
  parseLocalizedInt,
  toPersianDigits,
} from '@repo/salon-core/persian-digits'
import {
  businessSettingsSchema,
  type BusinessSettingsPayload,
} from '@repo/salon-core/forms/settings'
import { PublicPageSettingsSection } from '@/components/public-page-settings-section'

export default function SettingsPage() {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const dc = useManagerDataClient()
  const bumpOfflineData = useBumpOfflineData()
  const [loggingOut, setLoggingOut] = useState(false)
  const [mounted, setMounted] = useState(false)

  const [managerDataReady, setManagerDataReady] = useState(false)
  const {
    handleSubmit: handleBusinessHoursSubmit,
    reset: resetBusinessHours,
    setError: setBusinessHoursError,
    setValue: setBusinessHoursValue,
    watch: watchBusinessHours,
    formState: { errors: businessHoursErrors, isSubmitting: savingHours },
  } = useForm<BusinessSettingsPayload>({
    resolver: zodResolver(businessSettingsSchema),
    defaultValues: {
      workingStart: '09:00',
      workingEnd: '19:00',
      slotDurationMinutes: 30,
    },
  })
  const workingStart = watchBusinessHours('workingStart') ?? '09:00'
  const workingEnd = watchBusinessHours('workingEnd') ?? '19:00'
  const slotMin = watchBusinessHours('slotDurationMinutes') ?? 30

  useEffect(() => {
    if (!dc || user?.role !== 'manager') {
      setManagerDataReady(true)
      return
    }
    let cancelled = false
    void dc.businessSettings.get().then((s) => {
      if (cancelled || !s) return
      resetBusinessHours(s)
    }).finally(() => {
      if (!cancelled) setManagerDataReady(true)
    })
    const unsubBiz = dc.businessSettings.subscribe((s) => {
      if (cancelled || !s) return
      resetBusinessHours(s)
    })
    return () => {
      cancelled = true
      unsubBiz()
    }
  }, [dc, resetBusinessHours, user?.role])

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleLogout = async () => {
    setLoggingOut(true)
    await logout()
  }

  const toggleDarkMode = (enabled: boolean) => {
    setTheme(enabled ? 'dark' : 'light')
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
  }

  const saveBusinessHours = handleBusinessHoursSubmit(async (values) => {
    if (!dc) return
    try {
      await dc.businessSettings.update(values)
      bumpOfflineData()
    } catch {
      setBusinessHoursError('root', { message: 'ذخیره ساعات کاری انجام نشد' })
    }
  })

  const settingsDataLoading =
    user?.role === 'manager' && (!dc || !managerDataReady)
  if (settingsDataLoading) {
    return <SettingsSkeleton />
  }

  if (!user) return null

  const isManager = user.role === 'manager'
  const darkMode = mounted ? theme === 'dark' : false

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex items-center gap-4 bg-card px-4 py-3 border-b border-border/50">
        <div>
          <h1 className="text-lg font-bold">
            {isManager ? 'بیشتر' : 'تنظیمات'}
          </h1>
          {isManager && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              مدیریت، گزارش‌ها و تنظیمات سالن
            </p>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4 space-y-3">
        <Card className="border-border/50">
          <CardContent className="flex items-center gap-4 py-4">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{user.name}</p>
              <p className="text-sm text-muted-foreground truncate" dir="ltr">
                {displayPhone(user.phone)}
              </p>
              <Badge variant="secondary" className="text-[10px] mt-1">
                {user.role === 'manager' ? 'مدیر' : 'پرسنل'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {user.role === 'staff' && <StaffPushSettings />}

        {isManager && (
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                مدیریت
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-between touch-manipulation"
                asChild
              >
                <Link href="/dashboard">
                  <span className="flex items-center gap-2">
                    <LayoutDashboard className="h-4 w-4" />
                    داشبورد و آمار
                  </span>
                  <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                </Link>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-between touch-manipulation"
                asChild
              >
                <Link href="/retention">
                  <span className="flex items-center gap-2">
                    <UserRoundSearch className="h-4 w-4" />
                    پیگیری مشتریان
                  </span>
                  <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                </Link>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-between touch-manipulation"
                asChild
              >
                <Link href="/services">
                  <span className="flex items-center gap-2">
                    <Scissors className="h-4 w-4" />
                    خدمات و قیمت‌ها
                  </span>
                  <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                </Link>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-between touch-manipulation"
                asChild
              >
                <Link href="/staff">
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    پرسنل و نقش‌ها
                  </span>
                  <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                </Link>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-between touch-manipulation"
                asChild
              >
                <Link href="/onboarding">
                  <span className="flex items-center gap-2">
                    <ListChecks className="h-4 w-4" />
                    راه‌اندازی سالن
                  </span>
                  <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {isManager && (
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                ساعات کاری
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FieldGroup className="gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field>
                    <FieldLabel>شروع</FieldLabel>
                    <TimePicker
                      value={workingStart}
                      onChange={(value) =>
                        setBusinessHoursValue('workingStart', value)
                      }
                      label="ساعت شروع"
                    />
                    {businessHoursErrors.workingStart && (
                      <FieldError>
                        {businessHoursErrors.workingStart.message}
                      </FieldError>
                    )}
                  </Field>
                  <Field>
                    <FieldLabel>پایان</FieldLabel>
                    <TimePicker
                      value={workingEnd}
                      onChange={(value) =>
                        setBusinessHoursValue('workingEnd', value)
                      }
                      label="ساعت پایان"
                    />
                    {businessHoursErrors.workingEnd && (
                      <FieldError>
                        {businessHoursErrors.workingEnd.message}
                      </FieldError>
                    )}
                  </Field>
                </div>
                <Field>
                  <FieldLabel>فاصله اسلات (دقیقه)</FieldLabel>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={toPersianDigits(slotMin)}
                    onChange={(e) =>
                      setBusinessHoursValue(
                        'slotDurationMinutes',
                        Math.max(5, parseLocalizedInt(e.target.value, slotMin)),
                      )
                    }
                    dir="rtl"
                    className="h-10 text-right tabular-nums"
                  />
                  {businessHoursErrors.slotDurationMinutes && (
                    <FieldError>
                      {businessHoursErrors.slotDurationMinutes.message}
                    </FieldError>
                  )}
                </Field>
              </FieldGroup>
              <FormRootError message={businessHoursErrors.root?.message} />
              <Button
                size="sm"
                className="w-full touch-manipulation"
                disabled={savingHours}
                onClick={saveBusinessHours}
              >
                {savingHours ? 'در حال ذخیره…' : 'ذخیره ساعات کاری'}
              </Button>
            </CardContent>
          </Card>
        )}

        {isManager && <PublicPageSettingsSection />}

        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              ظاهر
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {darkMode ? (
                  <Moon className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Sun className="h-5 w-5 text-muted-foreground" />
                )}
                <span className="text-sm">حالت تاریک</span>
              </div>
              <Switch
                checked={darkMode}
                disabled={!mounted}
                onCheckedChange={toggleDarkMode}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="py-3">
            <Button
              variant="ghost"
              className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 touch-manipulation"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              {loggingOut ? (
                <Spinner className="ml-2 h-4 w-4" />
              ) : (
                <LogOut className="ml-2 h-4 w-4" />
              )}
              {loggingOut ? 'در حال خروج…' : 'خروج از حساب'}
            </Button>
          </CardContent>
        </Card>

        <div className="text-center pt-4 pb-2">
          <p className="text-xs font-medium text-muted-foreground/60">سالورا</p>
          <p className="text-[10px] text-muted-foreground/40">نسخه ۱.۰.۰</p>
        </div>
      </div>
    </div>
  )
}
