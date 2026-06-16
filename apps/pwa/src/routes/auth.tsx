import { useEffect, useRef, useState } from 'react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@repo/ui/button'
import { Input } from '@repo/ui/input'
import { Field, FieldError, FieldGroup, FieldLabel } from '@repo/ui/field'
import { FormRootError } from '@repo/ui/form'
import { Spinner } from '@repo/ui/spinner'
import { ApiError } from '@repo/api-client'
import { displayPhone } from '@repo/salon-core/phone'
import { toPersianDigits } from '@repo/salon-core/persian-digits'
import { loginSchema } from '@repo/salon-core/forms/auth'
import type { LoginFormInput } from '@repo/salon-core/forms/auth'
import { phoneSchema } from '@repo/salon-core/forms/primitives'

import { brand } from '@repo/brand'
import { OtpCodeInput } from '#/components/auth/otp-code-input'
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

const searchSchema = z.object({
  redirect: z.string().optional(),
})

type AuthMode = 'phone' | 'password' | 'otp'
type OtpIntent = 'login' | 'register'

/** Only honor internal relative paths to avoid open-redirect. */
function safeInternalRedirect(value: string | undefined): string | null {
  return value && value.startsWith('/') ? value : null
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
    if (session && session.status !== 'needs_workspace') {
      const { user } = session
      const safe = safeInternalRedirect(search.redirect)
      if (safe) throw redirect({ href: safe })
      throw redirect({ to: homePathForRole(user.role) })
    }
  },
  component: AuthPage,
})

function AuthPage() {
  const navigate = useNavigate()
  const { redirect: redirectTo } = Route.useSearch()
  const { refresh, setUser } = useAuth()
  const showDemoCredentials = import.meta.env.DEV
  const [mode, setMode] = useState<AuthMode>('phone')
  const [otpIntent, setOtpIntent] = useState<OtpIntent>('login')
  const [otpPhone, setOtpPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState<string | null>(null)
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
  const isRegistering = otpIntent === 'register'

  const login = useMutation({
    mutationFn: (values: LoginFormInput) => api.auth.login(values),
    meta: { skipToast: true },
    onSuccess: async (data) => {
      setUser(data.user)
      const safe = safeInternalRedirect(redirectTo)
      if (safe) await navigate({ href: safe })
      else await navigate({ to: homePathForRole(data.user.role) })
    },
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
      if (data.registered) {
        setMode('password')
        return
      }
      sendOtp.mutate(
        { phone: values.phone, intent: 'register' },
        {
          onError: (err) => {
            const message =
              err instanceof ApiError
                ? err.status === 429
                  ? 'برای دریافت کد جدید کمی صبر کنید.'
                  : err.message || 'ارسال کد تایید انجام نشد.'
                : getMutationErrorMessage(err, 'ارسال کد تایید انجام نشد.')
            setError('root', { message })
          },
        },
      )
    },
  })

  const verifyOtp = useMutation({
    mutationFn: (code: string) =>
      api.auth.verifyPhoneOtp({ phone: otpPhone, code }),
    meta: { skipToast: true },
    onSuccess: async () => {
      setOtpError(null)
      const session = await refresh()
      const safe = safeInternalRedirect(redirectTo)
      if (session?.status === 'needs_workspace') {
        await navigate({ to: '/signup', replace: true })
        return
      }
      if (session?.user) {
        setUser(session.user)
        if (safe) await navigate({ href: safe })
        else await navigate({ to: homePathForRole(session.user.role) })
        return
      }
      setOtpError('ورود انجام نشد. دوباره تلاش کنید.')
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
          await navigate({ to: '/signup' })
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
      { phone: parsedPhone.data, intent: 'login' },
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
    if (!otpPhone || resendRemaining > 0) return
    sendOtp.mutate(
      { phone: otpPhone, intent: otpIntent },
      { onError: (err) => setOtpError(getOtpErrorMessage(err)) },
    )
  }

  const editPhone = () => {
    otpHistoryPushedRef.current = false
    setMode('phone')
    setOtpPhone('')
    setOtp('')
    setOtpError(null)
    setValue('password', '')
    clearErrors()
  }

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
  const isBusy =
    login.isPending ||
    sendOtp.isPending ||
    verifyOtp.isPending ||
    phoneStatus.isPending

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background p-4">
      <div className="relative w-full max-w-sm">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-black text-foreground tracking-tight">
            {brand.name.fa}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            مدیریت هوشمند سالن زیبایی
          </p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/95 p-6 shadow-sm">
          <div className="mb-6 text-center">
            <h2 className="text-base font-semibold text-foreground">
              {isPhoneMode
                ? 'ورود یا ثبت‌نام'
                : isPasswordMode
                  ? 'ورود با رمز عبور'
                  : isRegistering
                    ? 'ثبت‌نام با کد تایید'
                    : 'ورود با کد تایید'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isPhoneMode
                ? 'برای شروع فقط شماره موبایل‌تان را وارد کنید'
                : isPasswordMode
                  ? 'رمز عبور را وارد کنید.'
                  : 'کد تایید را وارد کنید.'}
            </p>
          </div>

          <form
            onSubmit={
              isPasswordMode ? onSubmit : (event) => event.preventDefault()
            }
            noValidate
          >
            <FieldGroup>
              {isPhoneMode ? (
                <Field>
                  <FieldLabel htmlFor="phone">شماره موبایل</FieldLabel>
                  <Input
                    id="phone"
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
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm font-semibold text-foreground">
                    <span>رمز عبور را وارد کنید.</span>
                  </div>

                  <Field>
                    <FieldLabel htmlFor="password" className="sr-only">
                      رمز عبور
                    </FieldLabel>
                    <PasswordInput
                      id="password"
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
                      در حال ورود با شماره {displayPhone(phoneValue)}
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
              ) : mode === 'otp' ? (
                <div className="space-y-3">
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
                        disabled={sendOtp.isPending}
                        onClick={resendOtp}
                      >
                        {sendOtp.isPending ? 'در حال ارسال...' : 'ارسال دوباره'}
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
                      disabled={verifyOtp.isPending}
                      invalid={Boolean(otpError)}
                      slotClassName="bg-muted/40 border-primary/35"
                    />
                    {otpError ? <FieldError>{otpError}</FieldError> : null}
                  </Field>

                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-muted-foreground">
                      در حال ورود با شماره {displayPhone(otpPhone)}
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
              ) : null}

              <FormRootError message={errors.root?.message} />

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
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    className="w-full h-12 rounded-xl text-base font-semibold touch-manipulation shadow-sm"
                    disabled={verifyOtp.isPending}
                    onClick={() => submitOtp()}
                  >
                    {verifyOtp.isPending ? <Spinner className="ml-2" /> : null}
                    {isRegistering ? 'تایید و ادامه ثبت‌نام' : 'تایید و ورود'}
                  </Button>
                </>
              )}
            </FieldGroup>
          </form>
        </div>

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
