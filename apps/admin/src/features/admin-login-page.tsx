import { ApiError } from '@repo/api-client/errors'
import {
  getApiV1AdminAuthMeQueryKey,
} from '@repo/api-client/query'
import { getApiV1AdminAuthMe } from '@repo/api-client/sdk'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { LogIn, ShieldAlert } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { Input } from '#/components/ui/input'

const INVALID_CREDENTIALS_MESSAGE = 'شماره تلفن یا رمز عبور نادرست است.'
const NOT_ACTIVE_ADMIN_MESSAGE =
  'ورود موفق بود، اما این حساب مدیر فعال پلتفرم نیست.'

async function signIn(input: { phoneNumber: string; password: string }) {
  const response = await fetch('/api/v1/auth/sign-in/phone-number', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    throw new ApiError(INVALID_CREDENTIALS_MESSAGE, response.status, null)
  }
}

export function AdminLoginPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [error, setError] = useState('')
  const loginMutation = useMutation({
    mutationFn: async (input: { phoneNumber: string; password: string }) => {
      await signIn(input)
      const { data } = await getApiV1AdminAuthMe({ throwOnError: true })
      return data
    },
    onSuccess: (me) => {
      queryClient.setQueryData(getApiV1AdminAuthMeQueryKey(), me)
      void navigate({ to: '/overview', replace: true })
    },
    onError: (caught) => {
      if (caught instanceof ApiError && caught.status === 403) {
        setError(NOT_ACTIVE_ADMIN_MESSAGE)
        return
      }
      if (caught instanceof ApiError) {
        setError(INVALID_CREDENTIALS_MESSAGE)
        return
      }
      setError(caught instanceof Error ? caught.message : 'ورود ناموفق بود.')
    },
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const form = new FormData(event.currentTarget)
    loginMutation.mutate({
      phoneNumber: String(form.get('phoneNumber') ?? ''),
      password: String(form.get('password') ?? ''),
    })
  }

  return (
    <main className="grid min-h-svh place-items-center bg-sidebar p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-primary text-primary-foreground">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <h1 className="mt-5 text-2xl font-semibold">مدیریت Saluna</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            برای ادامه با حساب مدیر پلتفرم وارد شوید.
          </p>
          <form className="mt-6 space-y-4" onSubmit={submit}>
            <label className="block space-y-1.5 text-sm">
              <span className="text-muted-foreground">شماره تلفن</span>
              <Input name="phoneNumber" dir="ltr" inputMode="tel" autoComplete="username" required />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="text-muted-foreground">رمز عبور</span>
              <Input name="password" type="password" autoComplete="current-password" required />
            </label>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button className="w-full" type="submit" disabled={loginMutation.isPending}>
              <LogIn className="h-4 w-4" />
              ورود
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
