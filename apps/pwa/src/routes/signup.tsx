import { useMemo, useState } from 'react'
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
import { Button } from '@repo/ui/button'
import { Input } from '@repo/ui/input'
import { Field, FieldError, FieldGroup, FieldLabel } from '@repo/ui/field'
import { FormRootError } from '@repo/ui/form'
import { Spinner } from '@repo/ui/spinner'
import { cn } from '@repo/ui/utils'
import { ApiError } from '@repo/api-client'
import { displayPhone } from '@repo/salon-core/phone'
import {
  preWorkspaceAccountSchema,
  preWorkspaceSchema,
} from '@repo/salon-core/forms/auth'
import { phoneSchema } from '@repo/salon-core/forms/primitives'
import { formMessages } from '@repo/salon-core/forms/messages'

import { brand } from '@repo/brand'
import { OtpCodeInput } from '#/components/auth/otp-code-input'
import { SalooraMark } from '#/components/brand/saloora-mark'
import { PasswordInput } from '#/components/password-input'
import { api } from '#/lib/api-client'
import {
  AUTH_OTP_CODE_LENGTH,
  AUTH_OTP_RESEND_SECONDS,
  getOtpErrorMessage,
  normalizeOtpCode,
  useResendCountdown,
} from '#/lib/auth-otp'
import { getMutationErrorMessage } from '#/lib/query-client'
import { authQueryKey, useAuth } from '#/lib/auth'
import type { AuthSession } from '#/lib/auth'
import { homePathForRole } from '#/lib/navigation'
import { getApiV1ClientsQueryKey } from '#/lib/clients-queries'
import { getApiV1ServicesQueryKey } from '#/lib/services-queries'
import { getApiV1StaffQueryKey } from '#/lib/staff-queries'
import { getApiV1SettingsBusinessQueryKey } from '#/lib/settings-queries'
import { getApiV1SalonProfilePresenceQueryKey } from '#/lib/salon-profile-queries'
import { getApiV1SalonPublicSettingsQueryKey } from '#/lib/salon-public-settings-queries'
import { getApiV1OnboardingQueryKey } from '#/lib/onboarding-queries'

const phoneStepSchema = z.object({ phone: phoneSchema })
type PhoneStepInput = z.input<typeof phoneStepSchema>
type PhoneStepPayload = z.output<typeof phoneStepSchema>

const accountStepSchema = preWorkspaceAccountSchema
  .extend({
    confirmPassword: z
      .string({ error: formMessages.required })
      .min(1, formMessages.required),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: formMessages.passwordMismatch,
  })
type AccountStepInput = z.input<typeof accountStepSchema>
type AccountStepPayload = z.output<typeof accountStepSchema>

type SignupStep = 'phone' | 'otp' | 'account' | 'workspace'

export const Route = createFileRoute('/signup')({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData<AuthSession>({
      queryKey: authQueryKey,
    })
    if (!session) {
      throw redirect({ to: '/auth' })
    }
    if (session && session.status !== 'needs_workspace') {
      throw redirect({ to: homePathForRole(session.user.role) })
    }
  },
  component: SignupPage,
})

function SignupPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { preWorkspaceUser, refresh, setUser } = useAuth()
  const [step, setStep] = useState<SignupStep>(
    preWorkspaceUser ? 'account' : 'phone',
  )
  const [verifiedPhone, setVerifiedPhone] = useState(
    preWorkspaceUser?.phone ?? '',
  )
  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState<string | null>(null)
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(
    null,
  )
  const resendRemaining = useResendCountdown(resendAvailableAt)

  const phoneForm = useForm<PhoneStepInput, unknown, PhoneStepPayload>({
    resolver: zodResolver(phoneStepSchema),
    defaultValues: { phone: preWorkspaceUser?.phone ?? '' },
  })

  const accountForm = useForm<AccountStepInput, unknown, AccountStepPayload>({
    resolver: zodResolver(accountStepSchema),
    defaultValues: {
      managerName:
        preWorkspaceUser?.name &&
        preWorkspaceUser.name !== preWorkspaceUser.phone
          ? preWorkspaceUser.name
          : '',
      password: '',
      confirmPassword: '',
    },
  })

  const workspaceForm = useForm<
    z.input<typeof preWorkspaceSchema>,
    unknown,
    z.output<typeof preWorkspaceSchema>
  >({
    resolver: zodResolver(preWorkspaceSchema),
    defaultValues: { salonName: '' },
  })

  const displayStep = useMemo(() => {
    if (step === 'phone') return 'شماره موبایل'
    if (step === 'otp') return 'کد تایید'
    if (step === 'account') return 'تکمیل حساب'
    return 'ساخت سالن'
  }, [step])

  const invalidateNewWorkspaceQueries = async () => {
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
  }

  const sendOtp = useMutation({
    mutationFn: ({ phone }: PhoneStepPayload) =>
      api.auth.sendPhoneOtp({ phone }),
    meta: { skipToast: true },
    onSuccess: (_, values) => {
      setVerifiedPhone(values.phone)
      setOtp('')
      setOtpError(null)
      setResendAvailableAt(Date.now() + AUTH_OTP_RESEND_SECONDS * 1000)
      setStep('otp')
    },
  })

  const verifyOtp = useMutation({
    mutationFn: (code: string) =>
      api.auth.verifyPhoneOtp({ phone: verifiedPhone, code }),
    meta: { skipToast: true },
    onSuccess: async () => {
      setOtpError(null)
      await refresh()
      setStep('account')
    },
  })

  const completeAccount = useMutation({
    mutationFn: ({ managerName, password }: AccountStepPayload) =>
      api.auth.completeSignupAccount({ managerName, password }),
    meta: { skipToast: true },
    onSuccess: async () => {
      await refresh()
      setStep('workspace')
    },
  })

  const createWorkspace = useMutation({
    mutationFn: (values: z.output<typeof preWorkspaceSchema>) =>
      api.auth.createSignupWorkspace(values),
    meta: { skipToast: true },
    onSuccess: async () => {
      const session = await refresh()
      if (session?.status !== 'needs_workspace' && session?.user) {
        setUser(session.user)
        await invalidateNewWorkspaceQueries()
        await navigate({ to: '/onboarding/welcome' })
      }
    },
  })

  const phoneValue = phoneForm.watch('phone')
  const startPhone = phoneForm.handleSubmit((values) => {
    sendOtp.mutate(values, {
      onError: (err) => {
        const message =
          err instanceof ApiError
            ? err.status === 429
              ? 'برای دریافت کد جدید کمی صبر کنید.'
              : err.message || 'ارسال کد تایید انجام نشد.'
            : getMutationErrorMessage(err, 'ارسال کد تایید انجام نشد.')
        phoneForm.setError('root', { message })
      },
    })
  })

  const submitOtp = (value?: string) => {
    if (verifyOtp.isPending) return
    const code = normalizeOtpCode(value ?? otp)
    if (code.length !== AUTH_OTP_CODE_LENGTH) {
      setOtpError(`کد ${AUTH_OTP_CODE_LENGTH} رقمی را کامل وارد کنید`)
      return
    }
    verifyOtp.mutate(code, {
      onError: (err) => setOtpError(getOtpErrorMessage(err)),
    })
  }

  const resendOtp = () => {
    if (!verifiedPhone || resendRemaining > 0) return
    sendOtp.mutate(
      { phone: verifiedPhone },
      { onError: (err) => setOtpError(getOtpErrorMessage(err)) },
    )
  }

  const submitAccount = accountForm.handleSubmit((values) => {
    completeAccount.mutate(values, {
      onError: (err) => {
        const message =
          err instanceof ApiError
            ? err.message || 'تکمیل حساب انجام نشد. دوباره تلاش کنید.'
            : getMutationErrorMessage(err, 'تکمیل حساب انجام نشد.')
        accountForm.setError('root', { message })
      },
    })
  })

  const submitWorkspace = workspaceForm.handleSubmit((values) => {
    createWorkspace.mutate(values, {
      onError: (err) => {
        const message =
          err instanceof ApiError
            ? err.message || 'ساخت سالن انجام نشد. دوباره تلاش کنید.'
            : getMutationErrorMessage(err, 'ساخت سالن انجام نشد.')
        workspaceForm.setError('root', { message })
      },
    })
  })

  const accountPasswordField = accountForm.register('password')
  const accountConfirmPasswordField = accountForm.register('confirmPassword')
  const accountManagerNameField = accountForm.register('managerName')
  const workspaceSalonNameField = workspaceForm.register('salonName')

  return (
    <main className="flex min-h-dvh justify-center bg-gradient-to-b from-blush-soft/60 to-background p-4">
      <div className="flex w-full max-w-md flex-col">
        <div className="flex items-center gap-2 px-1 pt-2">
          <span className="inline-flex size-9 items-center justify-center rounded-xl bg-primary/10">
            <SalooraMark className="size-[22px]" />
          </span>
          <span className="text-sm font-extrabold tracking-tight text-primary">
            {brand.name.fa}
          </span>
        </div>

        <div className="mt-8 px-1">
          <span className="inline-flex w-fit items-center rounded-full bg-blush-soft px-3 py-1 text-[11px] font-semibold text-primary">
            {displayStep}
          </span>
          <h1 className="mt-3 text-2xl font-extrabold leading-snug tracking-tight text-foreground">
            {step === 'workspace'
              ? 'سالن‌تان را بسازیم'
              : 'ثبت‌نام با شماره موبایل'}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-sage-deep">
            {step === 'phone'
              ? 'اول شماره را تایید می‌کنیم، بعد رمز عبور و نام سالن را می‌گیریم.'
              : step === 'otp'
                ? `کد ۶ رقمی ارسال‌شده به ${displayPhone(verifiedPhone)} را وارد کنید.`
                : step === 'account'
                  ? 'نام مدیر و رمز عبور حساب را تنظیم کنید.'
                  : 'این نام روی صفحه‌ی رزرو و پیام‌های مشتری‌ها نمایش داده می‌شود.'}
          </p>
        </div>

        {step === 'phone' && (
          <form onSubmit={startPhone} noValidate className="mt-6">
            <FieldGroup className="gap-5">
              <Field>
                <FieldLabel htmlFor="phone">شماره موبایل</FieldLabel>
                <Input
                  id="phone"
                  type="tel"
                  value={displayPhone(phoneValue)}
                  onChange={(event) =>
                    phoneForm.setValue('phone', event.target.value, {
                      shouldValidate: false,
                    })
                  }
                  placeholder="۰۹۱۲۰۰۰۰۰۰۰"
                  autoComplete="tel"
                  inputMode="numeric"
                  disabled={sendOtp.isPending}
                  dir="ltr"
                  className="h-14 rounded-2xl bg-card text-left text-lg font-bold tabular-nums shadow-sm"
                />
                {phoneForm.formState.errors.phone && (
                  <FieldError>
                    {phoneForm.formState.errors.phone.message}
                  </FieldError>
                )}
              </Field>
              <FormRootError
                message={phoneForm.formState.errors.root?.message}
              />
              <PrimarySubmitButton pending={sendOtp.isPending}>
                دریافت کد تایید
              </PrimarySubmitButton>
            </FieldGroup>
          </form>
        )}

        {step === 'otp' && (
          <div className="mt-6">
            <FieldGroup className="gap-5">
              <Field>
                <FieldLabel htmlFor="otp">کد پیامکی</FieldLabel>
                <OtpCodeInput
                  value={otp}
                  onValueChange={(value) => {
                    setOtp(value)
                    setOtpError(null)
                  }}
                  onComplete={submitOtp}
                  disabled={verifyOtp.isPending}
                  invalid={Boolean(otpError)}
                  slotClassName="bg-card"
                />
                {otpError && <FieldError>{otpError}</FieldError>}
              </Field>

              <Button
                type="button"
                className="h-12 rounded-xl text-base font-semibold"
                disabled={verifyOtp.isPending}
                onClick={() => submitOtp()}
              >
                {verifyOtp.isPending ? <Spinner className="ml-2" /> : null}
                تایید کد
              </Button>

              <div className="flex items-center justify-between text-sm text-sage-deep">
                <button
                  type="button"
                  className="font-semibold text-primary disabled:text-muted-foreground"
                  disabled={sendOtp.isPending || resendRemaining > 0}
                  onClick={resendOtp}
                >
                  ارسال دوباره کد
                </button>
                <span>
                  {resendRemaining > 0 ? `${resendRemaining} ثانیه` : null}
                </span>
              </div>

              <button
                type="button"
                className="text-sm font-semibold text-muted-foreground"
                onClick={() => setStep('phone')}
              >
                تغییر شماره موبایل
              </button>
            </FieldGroup>
          </div>
        )}

        {step === 'account' && (
          <form onSubmit={submitAccount} noValidate className="mt-6">
            <FieldGroup className="gap-5">
              <Field>
                <FieldLabel htmlFor="managerName">نام مدیر</FieldLabel>
                <Input
                  id="managerName"
                  placeholder="نام و نام خانوادگی"
                  autoComplete="name"
                  disabled={completeAccount.isPending}
                  className="h-12 rounded-2xl bg-card"
                  {...accountManagerNameField}
                />
                {accountForm.formState.errors.managerName && (
                  <FieldError>
                    {accountForm.formState.errors.managerName.message}
                  </FieldError>
                )}
              </Field>

              <Field>
                <FieldLabel htmlFor="password">رمز عبور</FieldLabel>
                <PasswordInput
                  id="password"
                  placeholder="حداقل ۸ کاراکتر"
                  autoComplete="new-password"
                  disabled={completeAccount.isPending}
                  className="h-12 rounded-2xl bg-card"
                  {...accountPasswordField}
                />
                {accountForm.formState.errors.password && (
                  <FieldError>
                    {accountForm.formState.errors.password.message}
                  </FieldError>
                )}
              </Field>

              <Field>
                <FieldLabel htmlFor="confirmPassword">
                  تکرار رمز عبور
                </FieldLabel>
                <PasswordInput
                  id="confirmPassword"
                  placeholder="رمز عبور را دوباره وارد کنید"
                  autoComplete="new-password"
                  disabled={completeAccount.isPending}
                  className="h-12 rounded-2xl bg-card"
                  {...accountConfirmPasswordField}
                />
                {accountForm.formState.errors.confirmPassword && (
                  <FieldError>
                    {accountForm.formState.errors.confirmPassword.message}
                  </FieldError>
                )}
              </Field>

              <FormRootError
                message={accountForm.formState.errors.root?.message}
              />
              <PrimarySubmitButton pending={completeAccount.isPending}>
                ادامه
              </PrimarySubmitButton>
            </FieldGroup>
          </form>
        )}

        {step === 'workspace' && (
          <form onSubmit={submitWorkspace} noValidate className="mt-6">
            <FieldGroup className="gap-5">
              <Field>
                <FieldLabel htmlFor="salonName">نام سالن</FieldLabel>
                <Input
                  id="salonName"
                  placeholder="مثلاً سالن رز"
                  autoComplete="organization"
                  disabled={createWorkspace.isPending}
                  className="h-14 rounded-2xl bg-card text-lg font-bold shadow-sm"
                  {...workspaceSalonNameField}
                />
                {workspaceForm.formState.errors.salonName && (
                  <FieldError>
                    {workspaceForm.formState.errors.salonName.message}
                  </FieldError>
                )}
                <p className="px-1 text-xs leading-relaxed text-sage-deep">
                  لینک صفحه‌ی رزرو را بعداً در مراحل راه‌اندازی انتخاب می‌کنید.
                </p>
              </Field>

              <FormRootError
                message={workspaceForm.formState.errors.root?.message}
              />
              <PrimarySubmitButton pending={createWorkspace.isPending}>
                ساخت سالن
              </PrimarySubmitButton>
            </FieldGroup>
          </form>
        )}

        <p className="mt-6 px-1 text-center text-sm text-sage-deep">
          حساب دارید؟{' '}
          <Link
            to="/auth"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            ورود
          </Link>
        </p>
      </div>
    </main>
  )
}

function PrimarySubmitButton({
  children,
  pending,
}: {
  children: React.ReactNode
  pending: boolean
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        'flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl',
        'bg-primary text-base font-extrabold text-primary-foreground',
        'shadow-[0_10px_26px_-12px_rgba(0,0,0,0.45)] transition-opacity touch-manipulation',
        'disabled:cursor-not-allowed disabled:opacity-60',
      )}
    >
      {pending ? (
        <Spinner className="size-5" />
      ) : (
        <>
          {children}
          <ArrowLeft className="size-5" />
        </>
      )}
    </button>
  )
}
