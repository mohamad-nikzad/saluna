import { useEffect, useState } from 'react'
import {
  Link,
  createFileRoute,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CalendarPlus,
  Check,
  Clock3,
  ListChecks,
  LockKeyhole,
  MapPin,
  RotateCcw,
  Scissors,
  Store,
  Users,
} from 'lucide-react'
import { Badge } from '@repo/ui/badge'
import { Button } from '@repo/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/card'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@repo/ui/field'
import { Input } from '@repo/ui/input'
import { TimePicker } from '@repo/ui/time-picker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/select'
import { Skeleton } from '@repo/ui/skeleton'
import { Spinner } from '@repo/ui/spinner'
import { FormRootError } from '@repo/ui/form'
import { cn } from '@repo/ui/utils'
import {
  SERVICE_CATEGORIES,
  STAFF_COLORS
  
} from '@repo/salon-core/types'
import type {Service} from '@repo/salon-core/types';
import { calendarColorOptions } from '@repo/brand-tokens/calendar-colors'
import { displayPhone } from '@repo/salon-core/phone'
import {
  parseLocalizedInt,
  toPersianDigits,
} from '@repo/salon-core/persian-digits'
import {
  businessSettingsSchema
  
} from '@repo/salon-core/forms/settings'
import type {BusinessSettingsPayload} from '@repo/salon-core/forms/settings';
import {
  serviceFormSchema
  
} from '@repo/salon-core/forms/service'
import type {ServiceFormPayload} from '@repo/salon-core/forms/service';
import {
  staffCreateSchema
  
} from '@repo/salon-core/forms/staff'
import type {StaffCreateFormInput} from '@repo/salon-core/forms/staff';
import type {
  OnboardingAction,
  OnboardingResponse,
  OnboardingStatus,
} from '@repo/api-client'

import { api } from '#/lib/api-client'
import { CatalogPresetPicker } from '#/components/catalog-preset-picker'
import {
  useBumpOfflineData,
  useManagerDataClient,
} from '#/lib/manager-data-client'
import { useManagerBusinessSettingsQuery } from '#/lib/manager-data-queries'
import {
  managerServicesQueryKey,
  managerStaffQueryKey,
  onboardingQueryKey,
} from '#/lib/query-keys'

export const Route = createFileRoute('/_authed/onboarding')({
  component: OnboardingPage,
})

type OnboardingStepKey =
  | 'profileConfirmed'
  | 'businessHoursSet'
  | 'servicesAdded'
  | 'staffAdded'
  | 'firstAppointmentCreated'

const onboardingSteps: Array<{
  key: OnboardingStepKey
  title: string
  description: string
  icon: React.ElementType
  required: boolean
}> = [
  {
    key: 'profileConfirmed',
    title: 'پروفایل سالن',
    description: 'اطلاعات اصلی فضای کاری را تایید کنید.',
    icon: Store,
    required: false,
  },
  {
    key: 'businessHoursSet',
    title: 'ساعات کاری',
    description: 'ساعت شروع، پایان و بازه نوبت‌ها را مشخص کنید.',
    icon: Clock3,
    required: false,
  },
  {
    key: 'servicesAdded',
    title: 'اولین خدمت',
    description: 'حداقل یک خدمت برای رزرو و تقویم لازم است.',
    icon: Scissors,
    required: true,
  },
  {
    key: 'staffAdded',
    title: 'اولین پرسنل',
    description: 'حداقل یک پرسنل برای اختصاص نوبت لازم است.',
    icon: Users,
    required: true,
  },
  {
    key: 'firstAppointmentCreated',
    title: 'اولین نوبت',
    description: 'بعد از آماده‌سازی، یک نوبت آزمایشی بسازید.',
    icon: CalendarPlus,
    required: false,
  },
]

function formatNumber(value: number) {
  return new Intl.NumberFormat('fa-IR').format(value)
}

function firstIncompleteStep(onboarding: OnboardingStatus): OnboardingStepKey {
  return (
    onboardingSteps.find((step) => !onboarding.steps[step.key])?.key ??
    'firstAppointmentCreated'
  )
}

function OnboardingSkeleton() {
  return (
    <div className="flex h-full flex-col bg-background">
      <header className="border-b border-border/50 bg-card px-4 py-4">
        <Skeleton className="h-6 w-32" />
      </header>
      <div className="flex-1 space-y-4 overflow-auto p-4">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    </div>
  )
}

function StepNavigation({
  onboarding,
  activeStep,
  onSelect,
}: {
  onboarding: OnboardingStatus
  activeStep: OnboardingStepKey
  onSelect: (step: OnboardingStepKey) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
      {onboardingSteps.map((step) => {
        const Icon = step.icon
        const isDone = onboarding.steps[step.key]
        const isActive = activeStep === step.key

        return (
          <button
            key={step.key}
            type="button"
            onClick={() => onSelect(step.key)}
            className={cn(
              'flex min-h-16 items-center gap-3 rounded-2xl border p-3 text-right transition-colors sm:flex-col sm:items-start',
              isActive
                ? 'border-primary bg-primary/8 text-foreground shadow-sm'
                : 'border-border/60 bg-card text-muted-foreground',
            )}
          >
            <span
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                isDone
                  ? 'bg-green-500/10 text-green-600'
                  : 'bg-muted text-muted-foreground',
                isActive && !isDone && 'bg-primary/10 text-primary',
              )}
            >
              {isDone ? (
                <Check className="h-5 w-5" />
              ) : (
                <Icon className="h-5 w-5" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-sm font-bold text-foreground">
                {step.title}
                {step.required && !isDone && (
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] text-destructive">
                    ضروری
                  </span>
                )}
              </span>
              <span className="mt-1 block text-xs leading-5">
                {step.description}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

function ProfileStep({
  onboarding,
  pending,
  onConfirm,
}: {
  onboarding: OnboardingStatus
  pending: boolean
  onConfirm: () => void
}) {
  return (
    <Card className="border-border/50">
      <CardHeader className="space-y-1 text-right">
        <CardTitle className="flex items-center gap-2 text-base">
          <Store className="h-5 w-5 text-primary" />
          تایید پروفایل سالن
        </CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">
          این اطلاعات برای نمایش فضای کاری و لینک عمومی آینده سالن استفاده
          می‌شود.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground">نام سالن</p>
            <p className="mt-1 font-bold">
              {onboarding.salon?.name ?? 'ثبت نشده'}
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground">آدرس کوتاه</p>
            <p className="mt-1 text-left font-bold" dir="ltr">
              /{onboarding.salon?.slug ?? 'salon'}
            </p>
          </div>
        </div>

        {onboarding.salon?.address && (
          <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-muted/30 p-4 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            {onboarding.salon.address}
          </div>
        )}

        <Button
          className="w-full"
          disabled={pending || onboarding.steps.profileConfirmed}
          onClick={onConfirm}
        >
          {pending && <Spinner className="ml-2" />}
          {onboarding.steps.profileConfirmed
            ? 'پروفایل تایید شده'
            : 'تایید پروفایل'}
        </Button>
      </CardContent>
    </Card>
  )
}

function BusinessHoursStep({ onSaved }: { onSaved: () => void }) {
  const dc = useManagerDataClient()
  const bumpOfflineData = useBumpOfflineData()
  const businessSettingsQuery = useManagerBusinessSettingsQuery(!!dc)

  const {
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<BusinessSettingsPayload>({
    resolver: zodResolver(businessSettingsSchema),
    defaultValues: {
      workingStart: '09:00',
      workingEnd: '19:00',
      slotDurationMinutes: 30,
    },
  })

  const workingStart = watch('workingStart') ?? '09:00'
  const workingEnd = watch('workingEnd') ?? '19:00'
  const slotDurationMinutes = watch('slotDurationMinutes') ?? 30

  useEffect(() => {
    const settings = businessSettingsQuery.data
    if (settings) reset(settings)
  }, [businessSettingsQuery.data, reset])

  const onSubmit = handleSubmit(async (values) => {
    if (!dc) {
      setError('root', { message: 'اتصال داده‌ها در دسترس نیست.' })
      return
    }
    try {
      await dc.businessSettings.update(values)
      bumpOfflineData()
      onSaved()
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'ذخیره ساعات کاری انجام نشد'
      setError('root', { message })
    }
  })

  return (
    <Card className="border-border/50">
      <CardHeader className="space-y-1 text-right">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock3 className="h-5 w-5 text-primary" />
          ساعات کاری سالن
        </CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">
          تقویم و پیشنهاد زمان نوبت‌ها بر اساس این بازه ساخته می‌شود.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup className="gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="onboarding-working-start">شروع</FieldLabel>
                <TimePicker
                  id="onboarding-working-start"
                  value={workingStart}
                  onChange={(value) =>
                    setValue('workingStart', value, { shouldValidate: false })
                  }
                  label="ساعت شروع"
                />
                {errors.workingStart && (
                  <FieldError>{errors.workingStart.message}</FieldError>
                )}
              </Field>
              <Field>
                <FieldLabel htmlFor="onboarding-working-end">پایان</FieldLabel>
                <TimePicker
                  id="onboarding-working-end"
                  value={workingEnd}
                  onChange={(value) =>
                    setValue('workingEnd', value, { shouldValidate: false })
                  }
                  label="ساعت پایان"
                />
                {errors.workingEnd && (
                  <FieldError>{errors.workingEnd.message}</FieldError>
                )}
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="onboarding-slot-duration">
                فاصله اسلات‌ها
              </FieldLabel>
              <Input
                id="onboarding-slot-duration"
                type="text"
                inputMode="numeric"
                value={toPersianDigits(slotDurationMinutes)}
                onChange={(event) =>
                  setValue(
                    'slotDurationMinutes',
                    Math.max(
                      5,
                      parseLocalizedInt(
                        event.target.value,
                        slotDurationMinutes,
                      ),
                    ),
                    {
                      shouldValidate: false,
                    },
                  )
                }
                dir="ltr"
                className="h-11 text-left tabular-nums"
              />
              <FieldDescription>
                عدد به دقیقه است؛ مقدار رایج برای سالن‌ها ۳۰ دقیقه است.
              </FieldDescription>
              {errors.slotDurationMinutes && (
                <FieldError>{errors.slotDurationMinutes.message}</FieldError>
              )}
            </Field>
            <FormRootError message={errors.root?.message} />
            <Button className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Spinner className="ml-2" />}
              ذخیره ساعات کاری
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}

function ServiceStep({
  isDone,
  onCreated,
}: {
  isDone: boolean
  onCreated: () => void
}) {
  const dc = useManagerDataClient()
  const bumpOfflineData = useBumpOfflineData()
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<'picker' | 'manual'>('picker')

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ServiceFormPayload>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: {
      name: '',
      category: 'hair',
      duration: 45,
      price: 0,
      color: STAFF_COLORS[0],
      active: true,
      kind: 'standard',
    },
  })

  const name = watch('name')
  const category = watch('category')
  const duration = watch('duration')
  const price = watch('price')
  const color = watch('color')

  const onSubmit = handleSubmit(async (values) => {
    if (!dc) {
      setError('root', { message: 'اتصال داده‌ها در دسترس نیست.' })
      return
    }
    try {
      await dc.services.create({
        name: values.name,
        category: values.category,
        duration: values.duration,
        price: values.price,
        color: values.color,
        active: values.active,
        kind: values.kind,
      })
      bumpOfflineData()
      await queryClient.invalidateQueries({ queryKey: managerServicesQueryKey })
      reset({
        name: '',
        category: 'hair',
        duration: 45,
        price: 0,
        color: STAFF_COLORS[0],
        active: true,
        kind: 'standard',
      })
      onCreated()
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'افزودن خدمت انجام نشد'
      setError('root', { message })
    }
  })

  const nameField = register('name')

  return (
    <Card className="border-border/50">
      <CardHeader className="space-y-1 text-right">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Scissors className="h-5 w-5 text-primary" />
            تعریف اولین خدمت
          </CardTitle>
          {isDone && <Badge variant="secondary">حداقل خدمت ثبت شده</Badge>}
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          {mode === 'picker'
            ? 'یک قالب آماده را انتخاب کنید تا دسته، گروه و خدمت‌ها یکجا ساخته شوند.'
            : 'بدون خدمت، تقویم نمی‌تواند مدت زمان و قیمت نوبت را محاسبه کند.'}
        </p>
      </CardHeader>
      <CardContent>
        {mode === 'picker' ? (
          <CatalogPresetPicker
            onApplied={async () => {
              bumpOfflineData()
              await queryClient.invalidateQueries({
                queryKey: managerServicesQueryKey,
              })
              onCreated()
            }}
            onManual={() => setMode('manual')}
          />
        ) : (
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup className="gap-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-fit gap-1"
              onClick={() => setMode('picker')}
            >
              <ArrowRight className="h-4 w-4" />
              بازگشت به قالب‌های آماده
            </Button>
            <Field>
              <FieldLabel htmlFor="onboarding-service-name">
                نام خدمت
              </FieldLabel>
              <Input
                id="onboarding-service-name"
                placeholder="مثلاً کوتاهی مو"
                className="h-11 text-right"
                {...nameField}
              />
              {errors.name && <FieldError>{errors.name.message}</FieldError>}
            </Field>
            <Field>
              <FieldLabel>بخش خدمت</FieldLabel>
              <Select
                value={category}
                onValueChange={(value) =>
                  setValue('category', value as Service['category'])
                }
              >
                <SelectTrigger className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    Object.keys(SERVICE_CATEGORIES) as Service['category'][]
                  ).map((key) => (
                    <SelectItem key={key} value={key}>
                      {SERVICE_CATEGORIES[key].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="onboarding-service-duration">
                  مدت
                </FieldLabel>
                <Input
                  id="onboarding-service-duration"
                  type="text"
                  inputMode="numeric"
                  value={toPersianDigits(duration)}
                  onChange={(event) =>
                    setValue(
                      'duration',
                      Math.max(
                        5,
                        parseLocalizedInt(event.target.value, duration),
                      ),
                    )
                  }
                  dir="rtl"
                  className="h-11 text-right tabular-nums"
                />
                {errors.duration && (
                  <FieldError>{errors.duration.message}</FieldError>
                )}
              </Field>
              <Field>
                <FieldLabel htmlFor="onboarding-service-price">قیمت</FieldLabel>
                <Input
                  id="onboarding-service-price"
                  type="text"
                  inputMode="numeric"
                  value={toPersianDigits(price)}
                  onChange={(event) =>
                    setValue(
                      'price',
                      Math.max(0, parseLocalizedInt(event.target.value, price)),
                    )
                  }
                  dir="rtl"
                  className="h-11 text-right tabular-nums"
                />
                {errors.price && (
                  <FieldError>{errors.price.message}</FieldError>
                )}
              </Field>
            </div>
            <Field>
              <FieldLabel>رنگ در تقویم</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {calendarColorOptions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={item.labelFa}
                    onClick={() => setValue('color', item.id)}
                    className={cn(
                      'flex h-9 items-center gap-2 rounded-xl border-2 bg-card px-2 text-xs font-medium',
                      color === item.id
                        ? 'border-foreground'
                        : 'border-transparent',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="size-4 rounded-full border border-border"
                      style={{ backgroundColor: `var(--calendar-${item.id})` }}
                    />
                    <span>{item.labelFa}</span>
                  </button>
                ))}
              </div>
            </Field>
            <FormRootError message={errors.root?.message} />
            <Button className="w-full" disabled={isSubmitting || !name.trim()}>
              {isSubmitting && <Spinner className="ml-2" />}
              {isDone ? 'افزودن خدمت دیگر' : 'ثبت اولین خدمت'}
            </Button>
          </FieldGroup>
        </form>
        )}
      </CardContent>
    </Card>
  )
}

function StaffStep({
  isDone,
  onCreated,
}: {
  isDone: boolean
  onCreated: () => void
}) {
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<StaffCreateFormInput>({
    resolver: zodResolver(staffCreateSchema),
    defaultValues: { name: '', phone: '', password: '', role: 'staff' },
  })

  const name = watch('name')
  const phone = watch('phone')
  const password = watch('password')

  const onSubmit = handleSubmit(async (values) => {
    try {
      await api.staff.create({ ...values, role: values.role ?? 'staff' })
      await queryClient.invalidateQueries({ queryKey: managerStaffQueryKey })
      reset({ name: '', phone: '', password: '', role: 'staff' })
      onCreated()
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'افزودن پرسنل انجام نشد'
      setError('root', { message })
    }
  })

  const nameField = register('name')
  const passwordField = register('password')

  return (
    <Card className="border-border/50">
      <CardHeader className="space-y-1 text-right">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5 text-primary" />
            افزودن اولین پرسنل
          </CardTitle>
          {isDone && <Badge variant="secondary">حداقل پرسنل ثبت شده</Badge>}
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          هر نوبت باید به یک عضو تیم اختصاص داده شود. بعداً می‌توانید خدمات هر
          پرسنل را دقیق‌تر تنظیم کنید.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="onboarding-staff-name">
                نام و نام خانوادگی
              </FieldLabel>
              <Input
                id="onboarding-staff-name"
                placeholder="مثلاً نرگس کاظمی"
                className="h-11 text-right"
                {...nameField}
              />
              {errors.name && <FieldError>{errors.name.message}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor="onboarding-staff-phone">
                شماره موبایل
              </FieldLabel>
              <Input
                id="onboarding-staff-phone"
                type="tel"
                value={displayPhone(phone)}
                onChange={(event) => setValue('phone', event.target.value)}
                placeholder="۰۹۱۲۰۰۰۰۰۰۰"
                inputMode="numeric"
                dir="rtl"
                className="h-11 text-right tabular-nums"
              />
              {errors.phone && <FieldError>{errors.phone.message}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor="onboarding-staff-password">
                رمز عبور پرسنل
              </FieldLabel>
              <Input
                id="onboarding-staff-password"
                type="password"
                placeholder="حداقل یک رمز موقت"
                className="h-11"
                {...passwordField}
              />
              <FieldDescription>
                پرسنل با همین شماره و رمز وارد پنل خود می‌شود.
              </FieldDescription>
              {errors.password && (
                <FieldError>{errors.password.message}</FieldError>
              )}
            </Field>
            <FormRootError message={errors.root?.message} />
            <Button
              className="w-full"
              disabled={
                isSubmitting || !name.trim() || !phone.trim() || !password
              }
            >
              {isSubmitting && <Spinner className="ml-2" />}
              {isDone ? 'افزودن پرسنل دیگر' : 'ثبت اولین پرسنل'}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}

function FirstAppointmentStep({
  requiredDone,
  pending,
  onContinue,
}: {
  requiredDone: boolean
  pending: boolean
  onContinue: () => void
}) {
  return (
    <Card className="border-border/50">
      <CardHeader className="space-y-1 text-right">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarPlus className="h-5 w-5 text-primary" />
          آماده ثبت اولین نوبت
        </CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">
          بعد از ساخت خدمت و پرسنل، وارد تقویم شوید و اولین نوبت سالن را ثبت
          کنید.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!requiredDone && (
          <div className="flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm leading-6 text-destructive">
            <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
            تا وقتی حداقل یک خدمت و یک پرسنل ثبت نشده باشد، دسترسی به تقویم و
            بقیه برنامه بسته می‌ماند.
          </div>
        )}
        <Button
          className="w-full gap-2"
          disabled={!requiredDone || pending}
          onClick={onContinue}
        >
          {pending && <Spinner className="ml-2" />}
          ورود به تقویم و ثبت نوبت
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  )
}

function OnboardingPage() {
  const navigate = useNavigate()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [activeStep, setActiveStep] = useState<OnboardingStepKey | null>(null)
  const [pendingAction, setPendingAction] = useState<OnboardingAction | null>(
    null,
  )

  const onboardingQuery = useQuery({
    queryKey: onboardingQueryKey,
    queryFn: ({ signal }) => api.onboarding.get({ signal }),
  })

  const onboarding = onboardingQuery.data?.onboarding

  useEffect(() => {
    if (!onboarding) return
    const nextStep = firstIncompleteStep(onboarding)
    setActiveStep((current) => {
      if (!current || onboarding.steps[current]) return nextStep
      return current
    })
  }, [onboarding])

  async function updateOnboarding(
    action: OnboardingAction,
    redirectTo?: '/calendar',
  ) {
    setPendingAction(action)
    try {
      const data = await api.onboarding.update(action)
      queryClient.setQueryData<OnboardingResponse>(onboardingQueryKey, data)
      if (redirectTo) {
        await navigate({ to: redirectTo })
        await router.invalidate()
      }
    } finally {
      setPendingAction(null)
    }
  }

  async function refreshAfterRequiredStep(nextStep: OnboardingStepKey) {
    await onboardingQuery.refetch()
    setActiveStep(nextStep)
  }

  if (onboardingQuery.isLoading || !onboarding || !activeStep) {
    return <OnboardingSkeleton />
  }

  const doneCount = onboardingSteps.filter(
    (step) => onboarding.steps[step.key],
  ).length
  const requiredDone =
    onboarding.steps.servicesAdded && onboarding.steps.staffAdded
  const appLocked = !requiredDone
  const progressPercent = Math.round((doneCount / onboardingSteps.length) * 100)
  const setupClosed =
    (!!onboarding.completedAt || !!onboarding.skippedAt) && requiredDone

  return (
    <div className="flex h-full flex-col bg-background" dir="rtl">
      <header className="border-b border-border/50 bg-card px-4 py-4">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {!appLocked && (
              <Button
                variant="ghost"
                size="icon-sm"
                asChild
                className="h-10 w-10 shrink-0 rounded-2xl touch-manipulation"
              >
                <Link to="/settings" aria-label="بازگشت به بیشتر">
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
            )}
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
              <ListChecks className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-black tracking-tight">
                راه‌اندازی سالن
              </h1>
              <p className="truncate text-xs text-muted-foreground">
                {onboarding.salon?.name ?? 'سالن شما'} را برای اولین نوبت آماده
                کنید
              </p>
            </div>
          </div>
          {setupClosed && (
            <Button
              size="sm"
              variant="ghost"
              className="gap-1"
              disabled={pendingAction === 'reopen'}
              onClick={() => updateOnboarding('reopen')}
            >
              <RotateCcw className="h-4 w-4" />
              بازکردن
            </Button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-5xl space-y-4 p-4 pb-6">
          <Card className="overflow-hidden border-border/50 bg-card">
            <CardContent className="space-y-5 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                    <BriefcaseBusiness className="h-6 w-6 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">
                      فضای کاری
                    </p>
                    <h2 className="truncate text-2xl font-black tracking-tight">
                      {onboarding.salon?.name ?? 'سالن شما'}
                    </h2>
                    {onboarding.salon?.slug && (
                      <p
                        className="mt-1 text-left text-xs text-muted-foreground"
                        dir="ltr"
                      >
                        /{onboarding.salon.slug}
                      </p>
                    )}
                  </div>
                </div>
                <Badge
                  variant={appLocked ? 'destructive' : 'secondary'}
                  className="w-fit"
                >
                  {appLocked ? 'دسترسی برنامه بسته است' : 'آماده استفاده'}
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">پیشرفت راه‌اندازی</span>
                  <span className="text-muted-foreground">
                    {formatNumber(doneCount)} از{' '}
                    {formatNumber(onboardingSteps.length)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {appLocked ? (
                <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm leading-6 text-muted-foreground">
                  <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  برای ورود به تقویم، مشتریان، داشبورد و تنظیمات اصلی، ابتدا یک
                  خدمت و یک پرسنل ثبت کنید.
                </div>
              ) : (
                <Button
                  className="w-full gap-2"
                  disabled={pendingAction === 'complete'}
                  onClick={() => updateOnboarding('complete', '/calendar')}
                >
                  {pendingAction === 'complete' && <Spinner className="ml-2" />}
                  ورود به برنامه
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
            </CardContent>
          </Card>

          <StepNavigation
            onboarding={onboarding}
            activeStep={activeStep}
            onSelect={setActiveStep}
          />

          {activeStep === 'profileConfirmed' && (
            <ProfileStep
              onboarding={onboarding}
              pending={pendingAction === 'confirm-profile'}
              onConfirm={() => updateOnboarding('confirm-profile')}
            />
          )}

          {activeStep === 'businessHoursSet' && (
            <BusinessHoursStep
              onSaved={() => {
                void onboardingQuery.refetch()
              }}
            />
          )}

          {activeStep === 'servicesAdded' && (
            <ServiceStep
              isDone={onboarding.steps.servicesAdded}
              onCreated={() => refreshAfterRequiredStep('staffAdded')}
            />
          )}

          {activeStep === 'staffAdded' && (
            <StaffStep
              isDone={onboarding.steps.staffAdded}
              onCreated={() =>
                refreshAfterRequiredStep('firstAppointmentCreated')
              }
            />
          )}

          {activeStep === 'firstAppointmentCreated' && (
            <FirstAppointmentStep
              requiredDone={requiredDone}
              pending={pendingAction === 'complete'}
              onContinue={() => updateOnboarding('complete', '/calendar')}
            />
          )}
        </div>
      </main>
    </div>
  )
}
