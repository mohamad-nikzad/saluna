import {
  Link,
  createFileRoute,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
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
import { clearOfflineDatabase } from '@repo/data-client'
import { displayPhone } from '@repo/salon-core/phone'
import { loginSchema } from '@repo/salon-core/forms/auth'
import type { LoginFormInput } from '@repo/salon-core/forms/auth'
import type { User } from '@repo/salon-core/types'

import { brand } from '@repo/brand'
import { PasswordInput } from '#/components/password-input'
import { api } from '#/lib/api-client'
import { getMutationErrorMessage } from '#/lib/query-client'
import { authQueryKey, useAuth } from '#/lib/auth'
import { homePathForRole } from '#/lib/navigation'

const searchSchema = z.object({
  redirect: z.string().optional(),
})

/** Only honor internal relative paths to avoid open-redirect. */
function safeInternalRedirect(value: string | undefined): string | null {
  return value && value.startsWith('/') ? value : null
}

export const Route = createFileRoute('/login')({
  validateSearch: searchSchema,
  beforeLoad: async ({ context, search }) => {
    const user = await context.queryClient.ensureQueryData<User | null>({
      queryKey: authQueryKey,
    })
    if (user) {
      const safe = safeInternalRedirect(search.redirect)
      if (safe) throw redirect({ href: safe })
      throw redirect({ to: homePathForRole(user.role) })
    }
  },
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const { redirect: redirectTo } = Route.useSearch()
  const { setUser } = useAuth()
  const showDemoCredentials = import.meta.env.DEV

  const {
    register,
    handleSubmit,
    setError,
    watch,
    setValue,
    formState: { errors },
  } = useForm<LoginFormInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: '', password: '' },
  })

  const phoneValue = watch('phone')

  const login = useMutation({
    mutationFn: (values: LoginFormInput) => api.auth.login(values),
    meta: { skipToast: true },
    onSuccess: async (data) => {
      await clearOfflineDatabase()
      setUser(data.user)
      const safe = safeInternalRedirect(redirectTo)
      if (safe) await navigate({ href: safe })
      else await navigate({ to: homePathForRole(data.user.role) })
    },
  })

  const onSubmit = handleSubmit((values) => {
    login.mutate(values, {
      onError: (err) => {
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

  const passwordField = register('password')

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
              خوش آمدید
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              برای ادامه وارد شوید
            </p>
          </div>

          <form onSubmit={onSubmit} noValidate>
            <FieldGroup>
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
                  autoComplete="username"
                  inputMode="numeric"
                  disabled={login.isPending}
                  className="h-12 rounded-xl bg-muted/40 border-border/50 text-base text-left tabular-nums"
                  dir="ltr"
                />
                {errors.phone && (
                  <FieldError>{errors.phone.message}</FieldError>
                )}
              </Field>

              <Field>
                <FieldLabel htmlFor="password">رمز عبور</FieldLabel>
                <PasswordInput
                  id="password"
                  placeholder="رمز عبور را وارد کنید"
                  autoComplete="current-password"
                  disabled={login.isPending}
                  className="h-12 rounded-xl bg-muted/40 border-border/50"
                  {...passwordField}
                />
                {errors.password && (
                  <FieldError>{errors.password.message}</FieldError>
                )}
              </Field>

              <FormRootError message={errors.root?.message} />

              <Button
                type="submit"
                className="w-full h-12 rounded-xl text-base font-semibold touch-manipulation shadow-sm"
                disabled={login.isPending}
              >
                {login.isPending ? <Spinner className="ml-2" /> : null}
                {login.isPending ? 'در حال ورود…' : 'ورود'}
              </Button>
            </FieldGroup>
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          سالن جدید دارید؟{' '}
          <Link
            to="/signup"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            ساخت حساب مدیر
          </Link>
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
