import {
  Link,
  createFileRoute,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft } from 'lucide-react'
import { Input } from '@repo/ui/input'
import { Field, FieldError, FieldGroup, FieldLabel } from '@repo/ui/field'
import { FormRootError } from '@repo/ui/form'
import { Spinner } from '@repo/ui/spinner'
import { cn } from '@repo/ui/utils'
import { ApiError } from '@repo/api-client'
import { displayPhone } from '@repo/salon-core/phone'
import { signupSchema } from '@repo/salon-core/forms/auth'
import { formMessages } from '@repo/salon-core/forms/messages'
import type { User } from '@repo/salon-core/types'

import { brand } from '@repo/brand'
import { SalooraMark } from '#/components/brand/saloora-mark'
import { PasswordInput } from '#/components/password-input'
import { api } from '#/lib/api-client'
import { getMutationErrorMessage } from '#/lib/query-client'
import { authQueryKey, useAuth } from '#/lib/auth'
import { homePathForRole } from '#/lib/navigation'
import { getApiV1ClientsQueryKey } from '#/lib/clients-queries'
import { getApiV1ServicesQueryKey } from '#/lib/services-queries'
import { getApiV1StaffQueryKey } from '#/lib/staff-queries'
import { getApiV1SettingsBusinessQueryKey } from '#/lib/settings-queries'
import { getApiV1SalonProfilePresenceQueryKey } from '#/lib/salon-profile-queries'
import { getApiV1SalonPublicSettingsQueryKey } from '#/lib/salon-public-settings-queries'
import { getApiV1OnboardingQueryKey } from '#/lib/onboarding-queries'

// The booking-page slug is minted server-side (Persian salon names can't form a
// Latin URL); the owner picks a friendly one later in onboarding. The confirm
// field guards against silent password typos and never reaches the server.
const signupFormSchema = signupSchema
  .omit({ slug: true })
  .extend({
    confirmPassword: z
      .string({ error: formMessages.required })
      .min(1, formMessages.required),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: formMessages.passwordMismatch,
  })

type SignupFormInput = z.input<typeof signupFormSchema>

export const Route = createFileRoute('/signup')({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData<User | null>({
      queryKey: authQueryKey,
    })
    if (user) {
      throw redirect({ to: homePathForRole(user.role) })
    }
  },
  component: SignupPage,
})

function SignupPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { setUser } = useAuth()

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SignupFormInput>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: {
      salonName: '',
      managerName: '',
      managerPhone: '',
      password: '',
      confirmPassword: '',
    },
  })

  const managerPhone = watch('managerPhone')

  const signup = useMutation({
    mutationFn: (values: SignupFormInput) =>
      api.auth.signup({
        salonName: values.salonName,
        managerName: values.managerName,
        managerPhone: values.managerPhone,
        password: values.password,
      }),
    meta: { skipToast: true },
    onSuccess: async (data) => {
      setUser(data.user)
      await queryClient.removeQueries({ queryKey: getApiV1OnboardingQueryKey() })
      await queryClient.removeQueries({
        queryKey: getApiV1SettingsBusinessQueryKey(),
      })
      await queryClient.removeQueries({ queryKey: getApiV1ServicesQueryKey() })
      await queryClient.removeQueries({ queryKey: getApiV1StaffQueryKey() })
      await queryClient.removeQueries({ queryKey: getApiV1ClientsQueryKey() })
      await queryClient.removeQueries({
        queryKey: getApiV1SalonProfilePresenceQueryKey(),
      })
      await queryClient.removeQueries({
        queryKey: getApiV1SalonPublicSettingsQueryKey(),
      })
      await navigate({ to: '/onboarding/welcome' })
    },
  })

  const onSubmit = handleSubmit((values) => {
    signup.mutate(values, {
      onError: (err) => {
        const message =
          err instanceof ApiError
            ? err.message || 'ثبت‌نام انجام نشد. دوباره تلاش کنید.'
            : getMutationErrorMessage(
                err,
                'خطایی رخ داد. لطفاً دوباره تلاش کنید.',
              )
        setError('root', { message })
      },
    })
  })

  const managerNameField = register('managerName')
  const salonNameField = register('salonName')
  const passwordField = register('password')
  const confirmPasswordField = register('confirmPassword')

  return (
    <main className="flex min-h-dvh justify-center bg-gradient-to-b from-blush-soft/60 to-background p-4">
      <div className="flex w-full max-w-md flex-col">
        {/* Brand mark — Saluna */}
        <div className="flex items-center gap-2 px-1 pt-2">
          <span className="inline-flex size-9 items-center justify-center rounded-xl bg-primary/10">
            <SalooraMark className="size-[22px]" />
          </span>
          <span className="text-sm font-extrabold tracking-tight text-primary">
            {brand.name.fa}
          </span>
        </div>

        {/* Eyebrow + big conversational question */}
        <div className="mt-8 px-1">
          <span className="inline-flex w-fit items-center rounded-full bg-blush-soft px-3 py-1 text-[11px] font-semibold text-primary">
            بیایید آشنا شویم
          </span>
          <h1 className="mt-3 text-2xl font-extrabold leading-snug tracking-tight text-foreground">
            سالن‌تان را در چند ثانیه بسازیم
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-sage-deep">
            همین نام روی صفحه‌ی رزرو و پیام‌های مشتری‌ها نمایش داده می‌شود.
          </p>
        </div>

        <form onSubmit={onSubmit} noValidate className="mt-6">
          <FieldGroup className="gap-5">
            {/* Salon name — big focal input */}
            <Field>
              <FieldLabel htmlFor="salonName">نام سالن</FieldLabel>
              <Input
                id="salonName"
                placeholder="مثلاً سالن رز"
                autoComplete="organization"
                disabled={signup.isPending}
                className="h-14 rounded-2xl bg-card text-lg font-bold shadow-sm"
                {...salonNameField}
              />
              {errors.salonName && (
                <FieldError>{errors.salonName.message}</FieldError>
              )}
              <p className="px-1 text-xs leading-relaxed text-sage-deep">
                لینک صفحه‌ی رزرو را بعداً در مراحل راه‌اندازی انتخاب می‌کنید.
              </p>
            </Field>

            {/* Manager name + phone — paired */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="managerName">نام مدیر</FieldLabel>
                <Input
                  id="managerName"
                  placeholder="نام و نام خانوادگی"
                  autoComplete="name"
                  disabled={signup.isPending}
                  className="h-12 rounded-2xl bg-card"
                  {...managerNameField}
                />
                {errors.managerName && (
                  <FieldError>{errors.managerName.message}</FieldError>
                )}
              </Field>

              <Field>
                <FieldLabel htmlFor="managerPhone">شماره موبایل</FieldLabel>
                <Input
                  id="managerPhone"
                  type="tel"
                  value={displayPhone(managerPhone)}
                  onChange={(e) =>
                    setValue('managerPhone', e.target.value, {
                      shouldValidate: false,
                    })
                  }
                  placeholder="۰۹۱۲۰۰۰۰۰۰۰"
                  autoComplete="username"
                  inputMode="numeric"
                  disabled={signup.isPending}
                  dir="ltr"
                  className="h-12 rounded-2xl bg-card text-left tabular-nums"
                />
                {errors.managerPhone && (
                  <FieldError>{errors.managerPhone.message}</FieldError>
                )}
              </Field>
            </div>

            {/* Password */}
            <Field>
              <FieldLabel htmlFor="password">رمز عبور</FieldLabel>
              <PasswordInput
                id="password"
                placeholder="حداقل ۸ کاراکتر"
                autoComplete="new-password"
                disabled={signup.isPending}
                className="h-12 rounded-2xl bg-card"
                {...passwordField}
              />
              {errors.password && (
                <FieldError>{errors.password.message}</FieldError>
              )}
            </Field>

            {/* Confirm password — guards against silent typos */}
            <Field>
              <FieldLabel htmlFor="confirmPassword">تکرار رمز عبور</FieldLabel>
              <PasswordInput
                id="confirmPassword"
                placeholder="رمز عبور را دوباره وارد کنید"
                autoComplete="new-password"
                disabled={signup.isPending}
                className="h-12 rounded-2xl bg-card"
                {...confirmPasswordField}
              />
              {errors.confirmPassword && (
                <FieldError>{errors.confirmPassword.message}</FieldError>
              )}
            </Field>

            <FormRootError message={errors.root?.message} />

            <button
              type="submit"
              disabled={signup.isPending}
              className={cn(
                'flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl',
                'bg-primary text-base font-extrabold text-primary-foreground',
                'shadow-[0_10px_26px_-12px_rgba(0,0,0,0.45)] transition-opacity touch-manipulation',
                'disabled:cursor-not-allowed disabled:opacity-60',
              )}
            >
              {signup.isPending ? (
                <Spinner className="size-5" />
              ) : (
                <>
                  ساخت سالن
                  <ArrowLeft className="size-5" />
                </>
              )}
            </button>
          </FieldGroup>
        </form>

        <p className="mt-6 px-1 text-center text-sm text-sage-deep">
          حساب دارید؟{' '}
          <Link
            to="/login"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            ورود
          </Link>
        </p>
      </div>
    </main>
  )
}
