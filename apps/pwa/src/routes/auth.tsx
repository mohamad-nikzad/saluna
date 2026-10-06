import { useEffect, useRef, useState } from 'react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@repo/ui/button'
import { Input } from '@repo/ui/input'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@repo/ui/field'
import { FormRootError } from '@repo/ui/form'
import { Spinner } from '@repo/ui/spinner'
import { ApiError } from '@repo/api-client'
import { displayPhone } from '@repo/salon-core/phone'
import { toPersianDigits } from '@repo/salon-core/persian-digits'
import { loginSchema, newPasswordSchema } from '@repo/salon-core/forms/auth'
import type { LoginFormInput } from '@repo/salon-core/forms/auth'
import { formMessages } from '@repo/salon-core/forms/messages'
import { phoneSchema } from '@repo/salon-core/forms/primitives'

import { brand } from '@repo/brand'
import { SalunaMark } from '#/components/brand/saluna-mark'
import { OtpCodeInput } from '#/components/auth/otp-code-input'
import { PasswordInput } from '#/components/password-input'
import { api } from '#/lib/api-client'
import {
  getPersistedActiveSalonId,
  setPersistedActiveSalonId,
} from '#/lib/active-salon'
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

const searchSchema = z.object({
  redirect: z.string().optional(),
})

type AuthMode =
  | 'phone'
  | 'firstTime'
  | 'password'
  | 'otp'
  | 'recoveryOtp'
  | 'recoveryPassword'
  | 'staffPassword'
type OtpIntent = 'login' | 'firstTime'

/** Session state wins over saved links, especially old salon setup links. */
export function destinationAfterLogin(
  session: NonNullable<AuthSession>,
  saved?: string,
): string {
  if (session.status === 'needs_staff_password') return '/auth'
  if (session.status === 'needs_salon_selection') return '/select-salon'
  if (
    session.status === 'needs_workspace' ||
    session.status === 'needs_staff_invite'
  )
    return '/staff-invites'
  const safe =
    saved?.startsWith('/') && !saved.startsWith('//') && !saved.includes('\\')
      ? saved
      : null
  const path = safe?.split(/[?#]/)[0]
  if (session.user.role === 'staff') {
    if (!path || /^\/(?:onboarding|signup|auth)(?:\/|$)/.test(path))
      return homePathForRole(session.user.role)
  }
  return safe ?? homePathForRole(session.user.role)
}

function formatOtpCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return toPersianDigits(
    `${minutes}:${String(remainingSeconds).padStart(2, '0')}`,
  )
}

export const Route = createFileRoute('/auth')({
  validateSearch: searchSchema,
  beforeLoad: async ({ context, search }) => {
    const session = await context.queryClient.ensureQueryData<AuthSession>({
      queryKey: authQueryKey,
    })
    if (session && session.status !== 'needs_staff_password') {
      throw redirect({ href: destinationAfterLogin(session, search.redirect) })
    }
  },
  component: AuthPage,
})

function AuthPage() {
  const navigate = useNavigate()
  const { redirect: redirectTo } = Route.useSearch()
  const { session: authSession, refresh, setSession } = useAuth()
  const showDemoCredentials = import.meta.env.DEV
  const [mode, setMode] = useState<AuthMode>('phone')
  const [otpIntent, setOtpIntent] = useState<OtpIntent>('login')
  const [otpPhone, setOtpPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState<string | null>(null)
  const [otpLoginEnabled, setOtpLoginEnabled] = useState(false)
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [recoveryError, setRecoveryError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(
    null,
  )
  const otpHistoryPushedRef = useRef(false)
  const resendRemaining = useResendCountdown(resendAvailableAt)

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    watch,
    setValue,
    formState: { errors },
  } = useForm<LoginFormInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: '', password: '' },
  })

  const phoneValue = watch('phone')
  const isPhoneMode = mode === 'phone'
  const isPasswordMode = mode === 'password'
  const isRecoveryOtp = mode === 'recoveryOtp'
  const isRecoveryPassword = mode === 'recoveryPassword'
  const isStaffPassword = mode === 'staffPassword'
  const isFirstTime = mode === 'firstTime' || otpIntent === 'firstTime'

  const continueSession = async (session: AuthSession) => {
    if (!session) throw new Error('ورود انجام نشد. دوباره تلاش کنید.')
    setSession(session)
    if (session.status === 'needs_staff_password') {
      setNewPassword('')
      setConfirmPassword('')
      setMode('staffPassword')
      return
    }
    if (
      (session.status === 'ready' || session.status === undefined) &&
      session.user.role === 'staff'
    ) {
      setPersistedActiveSalonId(session.user.salonId)
    }
    await navigate({
      href: destinationAfterLogin(session, redirectTo),
      replace: true,
    })
  }

  const login = useMutation({
    mutationFn: (values: LoginFormInput) =>
      api.auth.login(values, { salonId: getPersistedActiveSalonId() }),
    meta: { skipToast: true },
    onSuccess: (session) => continueSession(session),
  })

  const sendOtp = useMutation({
    mutationFn: ({ phone }: { phone: string; intent: OtpIntent }) =>
      api.auth.sendPhoneOtp({ phone }),
    meta: { skipToast: true },
    onSuccess: (_, values) => {
      setOtpPhone(values.phone)
      setOtpIntent(values.intent)
      setOtp('')
      setOtpError(null)
      setResendAvailableAt(Date.now() + AUTH_OTP_RESEND_SECONDS * 1000)
      if (!otpHistoryPushedRef.current) {
        window.history.pushState(
          { salunaAuthMode: 'otp' },
          '',
          window.location.href,
        )
        otpHistoryPushedRef.current = true
      }
      setMode('otp')
    },
  })

  const phoneStatus = useMutation({
    mutationFn: ({ phone }: { phone: string }) =>
      api.auth.getPhoneStatus({ phone }),
    meta: { skipToast: true },
    onSuccess: (data, values) => {
      clearErrors()
      setOtpPhone(values.phone)
      setOtp('')
      setOtpError(null)
      setOtpLoginEnabled(data.otpLoginEnabled)
      if (data.hasPassword) {
        setMode('password')
      } else {
        setOtpIntent('firstTime')
        setMode('firstTime')
      }
    },
  })

  const verifyOtp = useMutation({
    mutationFn: (code: string) =>
      api.auth.verifyPhoneOtp({ phone: otpPhone, code }),
    meta: { skipToast: true },
    onSuccess: async () => {
      setOtpError(null)
      await continueSession(await refresh())
    },
  })

  const requestPasswordReset = useMutation({
    mutationFn: (phone: string) => api.auth.requestPasswordReset({ phone }),
    meta: { skipToast: true },
    onSuccess: (_, phone) => {
      setOtpPhone(phone)
      setOtp('')
      setOtpError(null)
      setRecoveryError(null)
      setResendAvailableAt(Date.now() + AUTH_OTP_RESEND_SECONDS * 1000)
      setMode('recoveryOtp')
    },
  })

  const verifyPasswordResetOtp = useMutation({
    mutationFn: (code: string) =>
      api.auth.verifyPasswordResetOtp({ phone: otpPhone, code }),
    meta: { skipToast: true },
    onSuccess: ({ token }) => {
      setResetToken(token)
      setOtpError(null)
      setNewPassword('')
      setConfirmPassword('')
      setMode('recoveryPassword')
    },
  })

  const resetPassword = useMutation({
    mutationFn: () =>
      api.auth.resetPassword({ token: resetToken, newPassword }),
    meta: { skipToast: true },
    onSuccess: () => {
      setValue('phone', otpPhone)
      setValue('password', '')
      setResetToken('')
      setNewPassword('')
      setConfirmPassword('')
      setRecoveryError(null)
      setSuccessMessage('رمز عبور با موفقیت تغییر کرد. اکنون وارد شوید.')
      setMode('password')
    },
  })

  const completeStaffClaim = useMutation({
    mutationFn: () => api.auth.completeStaffClaim({ password: newPassword }),
    meta: { skipToast: true },
    onSuccess: async () => {
      await continueSession(await refresh())
    },
  })

  const onSubmit = handleSubmit((values) => {
    login.mutate(values, {
      onError: async (err) => {
        if (
          err instanceof Error &&
          err.message === 'authenticated user has no workspace'
        ) {
          await refresh()
          await navigate({ to: '/staff-invites' })
          return
        }
        const message =
          err instanceof ApiError
            ? err.status === 401
              ? 'شماره موبایل یا رمز عبور اشتباه است'
              : err.message || 'شماره موبایل یا رمز عبور اشتباه است'
            : getMutationErrorMessage(
                err,
                'خطایی رخ داد. لطفا دوباره تلاش کنید.',
              )
        setError('root', { message })
      },
    })
  })

  const startPhoneFlow = () => {
    const parsedPhone = phoneSchema.safeParse(phoneValue)
    if (!parsedPhone.success) {
      setError('phone', { message: parsedPhone.error.issues[0]?.message })
      return
    }
    clearErrors()
    phoneStatus.mutate(
      { phone: parsedPhone.data },
      {
        onError: (err) => {
          const message =
            err instanceof ApiError
              ? err.message || 'بررسی شماره انجام نشد.'
              : getMutationErrorMessage(err, 'بررسی شماره انجام نشد.')
          setError('root', { message })
        },
      },
    )
  }

  const startOtpLogin = () => {
    const parsedPhone = phoneSchema.safeParse(phoneValue)
    if (!parsedPhone.success) {
      setError('phone', { message: parsedPhone.error.issues[0]?.message })
      return
    }
    clearErrors()
    sendOtp.mutate(
      {
        phone: parsedPhone.data,
        intent: mode === 'firstTime' ? 'firstTime' : 'login',
      },
      {
        onError: (err) => {
          const message =
            err instanceof ApiError
              ? err.status === 429
                ? 'برای دریافت کد جدید کمی صبر کنید.'
                : err.message || 'ارسال کد ورود انجام نشد.'
              : getMutationErrorMessage(err, 'ارسال کد ورود انجام نشد.')
          setError('root', { message })
        },
      },
    )
  }

  const startPasswordRecovery = () => {
    const parsedPhone = phoneSchema.safeParse(phoneValue)
    if (!parsedPhone.success) {
      setError('phone', { message: parsedPhone.error.issues[0]?.message })
      return
    }
    setSuccessMessage(null)
    setRecoveryError(null)
    requestPasswordReset.mutate(parsedPhone.data, {
      onError: (err) =>
        setRecoveryError(
          getMutationErrorMessage(err, 'ارسال کد بازیابی انجام نشد.'),
        ),
    })
  }

  const submitOtp = (value?: string) => {
    if (verifyOtp.isPending || verifyPasswordResetOtp.isPending) return
    const code = normalizeOtpCode(value ?? otp)
    if (code.length !== AUTH_OTP_CODE_LENGTH) {
      setOtpError(`کد ${AUTH_OTP_CODE_LENGTH} رقمی را کامل وارد کنید`)
      return
    }
    if (isRecoveryOtp) {
      verifyPasswordResetOtp.mutate(code, {
        onError: (err) => setOtpError(getOtpErrorMessage(err)),
      })
    } else {
      verifyOtp.mutate(code, {
        onError: (err) => setOtpError(getOtpErrorMessage(err)),
      })
    }
  }

  const resendOtp = () => {
    if (!otpPhone || resendRemaining > 0) return
    if (isRecoveryOtp) {
      requestPasswordReset.mutate(otpPhone, {
        onError: (err) => setOtpError(getOtpErrorMessage(err)),
      })
      return
    }
    sendOtp.mutate(
      { phone: otpPhone, intent: otpIntent },
      { onError: (err) => setOtpError(getOtpErrorMessage(err)) },
    )
  }

  const editPhone = () => {
    otpHistoryPushedRef.current = false
    setMode('phone')
    setOtpIntent('login')
    setOtpPhone('')
    setOtp('')
    setOtpError(null)
    setRecoveryError(null)
    setSuccessMessage(null)
    setValue('password', '')
    clearErrors()
  }

  useEffect(() => {
    if (authSession?.status === 'needs_staff_password') {
      setMode('staffPassword')
    }
  }, [authSession?.status])

  useEffect(() => {
    clearErrors()
    setOtpError(null)
    setRecoveryError(null)
  }, [mode, clearErrors])

  useEffect(() => {
    const handlePopState = () => {
      if (!otpHistoryPushedRef.current || mode !== 'otp') return
      otpHistoryPushedRef.current = false
      setMode('phone')
      setOtpPhone('')
      setOtp('')
      setOtpError(null)
      setValue('password', '')
      clearErrors()
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [clearErrors, mode, setValue])

  const passwordField = register('password')
  const submitNewPassword = () => {
    setRecoveryError(null)
    const parsedPassword = newPasswordSchema.safeParse(newPassword)
    if (!parsedPassword.success) {
      setRecoveryError(
        parsedPassword.error.issues[0]?.message ?? 'رمز عبور معتبر نیست.',
      )
      return
    }
    if (newPassword !== confirmPassword) {
      setRecoveryError(formMessages.passwordMismatch)
      return
    }
    const mutation = isStaffPassword ? completeStaffClaim : resetPassword
    mutation.mutate(undefined, {
      onError: (err) =>
        setRecoveryError(
          getMutationErrorMessage(
            err,
            isStaffPassword
              ? 'ثبت رمز عبور انجام نشد.'
              : 'تغییر رمز انجام نشد. دوباره کد بازیابی بگیرید.',
          ),
        ),
    })
  }
  const isBusy =
    login.isPending ||
    sendOtp.isPending ||
    verifyOtp.isPending ||
    phoneStatus.isPending ||
    requestPasswordReset.isPending ||
    verifyPasswordResetOtp.isPending ||
    resetPassword.isPending ||
    completeStaffClaim.isPending

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background p-4">
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-3">
          <SalunaMark className="size-12" />
          <h1 className="text-2xl font-extrabold text-foreground">
            {brand.name.fa}
          </h1>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/95 p-6 shadow-sm">
          <div
            className="mb-6 flex flex-col gap-2 text-right"
            aria-live="polite"
          >
            <h2 className="text-base font-semibold text-foreground">
              {isPhoneMode
                ? 'ورود به سالونا'
                : isPasswordMode
                  ? 'ورود با رمز عبور'
                  : isRecoveryPassword || isStaffPassword
                    ? isStaffPassword
                      ? 'رمز عبور خودتان را بسازید'
                      : 'انتخاب رمز عبور جدید'
                    : isRecoveryOtp
                      ? 'بازیابی رمز عبور'
                      : isFirstTime
                        ? mode === 'firstTime'
                          ? 'اولین ورود شما'
                          : 'تایید شماره موبایل'
                        : 'ورود با کد تایید'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isPhoneMode
                ? 'با شماره خودتان وارد شوید. اگر سالن شما را دعوت کرده، از همین‌جا ادامه دهید.'
                : isPasswordMode
                  ? 'رمز عبور را وارد کنید.'
                  : isRecoveryPassword || isStaffPassword
                    ? isStaffPassword
                      ? 'برای ورودهای بعدی یک رمز عبور بسازید. سپس دسترسی سالن را بررسی می‌کنیم.'
                      : 'رمز جدید را وارد و تایید کنید.'
                    : isRecoveryOtp
                      ? 'کد بازیابی پیامک‌شده را وارد کنید.'
                      : isFirstTime
                        ? mode === 'firstTime'
                          ? 'برای این شماره هنوز رمزی نساخته‌اید. شماره را با پیامک تایید کنید و رمز خودتان را بسازید.'
                          : 'کد پیامک‌شده را وارد کنید. بعد از تایید شماره، رمز خودتان را می‌سازید.'
                        : 'کد تایید را وارد کنید.'}
            </p>
          </div>

          <form
            onSubmit={(event) => {
              if (isPasswordMode) return onSubmit(event)
              event.preventDefault()
              if (isBusy) return
              if (isPhoneMode) startPhoneFlow()
              else if (mode === 'firstTime') startOtpLogin()
              else if (isStaffPassword || isRecoveryPassword)
                submitNewPassword()
              else submitOtp()
            }}
            noValidate
          >
            {isPasswordMode || isRecoveryPassword || isStaffPassword ? (
              <input
                type="hidden"
                name="username"
                autoComplete="username"
                value={
                  isPasswordMode
                    ? phoneValue
                    : (authSession?.user.phone ?? otpPhone)
                }
              />
            ) : null}
            <FieldGroup>
              {isPhoneMode ? (
                <Field data-invalid={Boolean(errors.phone)}>
                  <FieldLabel htmlFor="phone">شماره موبایل</FieldLabel>
                  <Input
                    id="phone"
                    aria-invalid={Boolean(errors.phone)}
                    type="tel"
                    value={displayPhone(phoneValue)}
                    onChange={(event) =>
                      setValue('phone', event.target.value, {
                        shouldValidate: false,
                      })
                    }
                    placeholder="مثلاً ۰۹۱۲۰۰۰۰۰۰۰"
                    autoComplete="tel"
                    inputMode="numeric"
                    disabled={isBusy || !isPhoneMode}
                    className="h-12 rounded-xl bg-muted/40 border-border/50 text-base text-left tabular-nums"
                    dir="ltr"
                  />
                  {errors.phone && (
                    <FieldError>{errors.phone.message}</FieldError>
                  )}
                </Field>
              ) : null}

              {isPasswordMode ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between text-sm font-semibold text-foreground">
                    <span>رمز عبور را وارد کنید.</span>
                  </div>

                  <Field data-invalid={Boolean(errors.password)}>
                    <FieldLabel htmlFor="password" className="sr-only">
                      رمز عبور
                    </FieldLabel>
                    <PasswordInput
                      id="password"
                      aria-invalid={Boolean(errors.password)}
                      placeholder="رمز عبور"
                      autoComplete="current-password"
                      disabled={isBusy}
                      className="h-12 rounded-xl bg-muted/40 border-border/50"
                      {...passwordField}
                    />
                    {errors.password && (
                      <FieldError>{errors.password.message}</FieldError>
                    )}
                  </Field>

                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-muted-foreground">
                      <bdi>{displayPhone(phoneValue)}</bdi>
                    </span>
                    <button
                      type="button"
                      className="shrink-0 font-semibold text-primary"
                      onClick={editPhone}
                    >
                      ویرایش
                    </button>
                  </div>
                </div>
              ) : mode === 'otp' || isRecoveryOtp ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between text-sm font-semibold text-foreground">
                    <span>کد تایید را وارد کنید.</span>
                    {resendRemaining > 0 ? (
                      <span dir="ltr" className="tabular-nums">
                        {formatOtpCountdown(resendRemaining)}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="text-xs font-semibold text-primary disabled:text-muted-foreground"
                        disabled={
                          sendOtp.isPending || requestPasswordReset.isPending
                        }
                        onClick={resendOtp}
                      >
                        {sendOtp.isPending || requestPasswordReset.isPending
                          ? 'در حال ارسال...'
                          : 'ارسال دوباره'}
                      </button>
                    )}
                  </div>

                  <Field>
                    <FieldLabel htmlFor="otp" className="sr-only">
                      کد تایید
                    </FieldLabel>
                    <OtpCodeInput
                      value={otp}
                      onValueChange={(value) => {
                        setOtp(value)
                        setOtpError(null)
                      }}
                      onComplete={submitOtp}
                      disabled={
                        verifyOtp.isPending || verifyPasswordResetOtp.isPending
                      }
                      invalid={Boolean(otpError)}
                      slotClassName="bg-muted/40 border-primary/35"
                    />
                    {otpError ? <FieldError>{otpError}</FieldError> : null}
                  </Field>

                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-muted-foreground">
                      <bdi>{displayPhone(otpPhone)}</bdi>
                    </span>
                    <button
                      type="button"
                      className="shrink-0 font-semibold text-primary"
                      onClick={editPhone}
                    >
                      ویرایش
                    </button>
                  </div>
                </div>
              ) : isRecoveryPassword || isStaffPassword ? (
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="new-password">
                      {isStaffPassword ? 'رمز عبور' : 'رمز عبور جدید'}
                    </FieldLabel>
                    <PasswordInput
                      id="new-password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      autoComplete="new-password"
                      disabled={isBusy}
                      className="h-12 rounded-xl bg-muted/40 border-border/50"
                      aria-describedby="password-requirements"
                    />
                    <FieldDescription id="password-requirements">
                      حداقل ۸ کاراکتر، با حروف، اعداد یا نمادهای انگلیسی.
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="confirm-password">
                      {isStaffPassword
                        ? 'تکرار رمز عبور'
                        : 'تکرار رمز عبور جدید'}
                    </FieldLabel>
                    <PasswordInput
                      id="confirm-password"
                      value={confirmPassword}
                      onChange={(event) =>
                        setConfirmPassword(event.target.value)
                      }
                      autoComplete="new-password"
                      disabled={isBusy}
                      className="h-12 rounded-xl bg-muted/40 border-border/50"
                    />
                  </Field>
                  {recoveryError ? (
                    <FieldError>{recoveryError}</FieldError>
                  ) : null}
                </FieldGroup>
              ) : null}

              <FormRootError message={errors.root?.message} />
              {successMessage ? (
                <p className="rounded-xl bg-primary/10 px-3 py-2 text-sm text-primary">
                  {successMessage}
                </p>
              ) : null}

              {isPhoneMode ? (
                <Button
                  type="button"
                  className="w-full h-12 rounded-xl text-base font-semibold touch-manipulation shadow-sm"
                  disabled={isBusy}
                  onClick={startPhoneFlow}
                >
                  {phoneStatus.isPending || sendOtp.isPending ? (
                    <Spinner className="ml-2" />
                  ) : null}
                  ادامه
                </Button>
              ) : isPasswordMode ? (
                <>
                  <Button
                    type="submit"
                    className="w-full h-12 rounded-xl text-base font-semibold touch-manipulation shadow-sm"
                    disabled={isBusy}
                  >
                    {login.isPending ? <Spinner className="ml-2" /> : null}
                    {login.isPending ? 'در حال ورود…' : 'ورود'}
                  </Button>
                  <button
                    type="button"
                    className="text-sm font-semibold text-primary disabled:text-muted-foreground"
                    disabled={isBusy}
                    onClick={startPasswordRecovery}
                  >
                    رمز عبور را فراموش کرده‌اید؟
                  </button>
                  {recoveryError ? (
                    <FieldError>{recoveryError}</FieldError>
                  ) : null}
                  {otpLoginEnabled ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full h-12 rounded-xl text-base font-semibold touch-manipulation"
                      disabled={isBusy}
                      onClick={startOtpLogin}
                    >
                      {sendOtp.isPending ? <Spinner className="ml-2" /> : null}
                      ورود با کد پیامکی
                    </Button>
                  ) : null}
                </>
              ) : mode === 'firstTime' ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    کد تایید به <bdi>{displayPhone(otpPhone)}</bdi> ارسال
                    می‌شود.
                  </p>
                  <Button
                    type="button"
                    size="lg"
                    disabled={isBusy}
                    onClick={startOtpLogin}
                  >
                    {sendOtp.isPending ? (
                      <Spinner data-icon="inline-start" />
                    ) : null}
                    دریافت کد تایید
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={isBusy}
                    onClick={editPhone}
                  >
                    تغییر شماره موبایل
                  </Button>
                </>
              ) : isRecoveryPassword || isStaffPassword ? (
                <Button
                  type="button"
                  className="w-full h-12 rounded-xl text-base font-semibold touch-manipulation shadow-sm"
                  disabled={isBusy}
                  onClick={submitNewPassword}
                >
                  {resetPassword.isPending || completeStaffClaim.isPending ? (
                    <Spinner className="ml-2" />
                  ) : null}
                  {isStaffPassword ? 'ساخت رمز و ادامه' : 'ثبت رمز عبور جدید'}
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    className="w-full h-12 rounded-xl text-base font-semibold touch-manipulation shadow-sm"
                    disabled={
                      verifyOtp.isPending || verifyPasswordResetOtp.isPending
                    }
                    onClick={() => submitOtp()}
                  >
                    {verifyOtp.isPending || verifyPasswordResetOtp.isPending ? (
                      <Spinner className="ml-2" />
                    ) : null}
                    {isRecoveryOtp
                      ? 'تایید کد'
                      : isFirstTime
                        ? 'تایید شماره و ادامه'
                        : 'تایید و ورود'}
                  </Button>
                </>
              )}
            </FieldGroup>
          </form>
        </div>

        <p className="mt-5 text-center text-sm leading-6 text-muted-foreground">
          پیوستن به سالن با پذیرفتن دعوت مدیر انجام می‌شود. ساخت سالن شخصی،
          انتخاب جداگانه‌ای است.
        </p>

        {showDemoCredentials && (
          <div className="mt-5 rounded-xl bg-muted/40 p-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              حساب‌های آزمایشی:
            </p>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground" dir="ltr">
                مدیر: {displayPhone('09120000000')}
              </p>
              <p className="text-xs text-muted-foreground" dir="ltr">
                پرسنل: {displayPhone('09120000001')}،{' '}
                {displayPhone('09120000002')}
              </p>
              <p className="text-xs text-muted-foreground">
                رمز (همه): admin123
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
