import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ArrowLeft, LogIn, UserPlus, UserRoundX } from 'lucide-react'

import { Button } from '@repo/ui/button'
import { Spinner } from '@repo/ui/spinner'
import { ApiError } from '@repo/api-client'

import { SalunaMark } from '#/components/brand/saluna-mark'
import { api } from '#/lib/api-client'
import { useAuth } from '#/lib/auth'

export const Route = createFileRoute('/invite/$token')({
  component: StaffInviteLinkPage,
})

function errorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message
  return 'لینک دعوت نامعتبر است یا منقضی شده.'
}

function StaffInviteLinkPage() {
  const { token } = Route.useParams()
  const navigate = useNavigate()
  const { logout, user, loading: authLoading } = useAuth()
  const invitePath = `/invite/${encodeURIComponent(token)}`

  const inviteQuery = useQuery({
    queryKey: ['staff-invite-link', token],
    queryFn: ({ signal }) => api.auth.getStaffInviteLink(token, { signal }),
    retry: false,
  })

  if (inviteQuery.isPending || authLoading) {
    return (
      <InviteShell>
        <div className="flex justify-center py-16">
          <Spinner className="size-6" />
        </div>
      </InviteShell>
    )
  }

  if (inviteQuery.isError || !inviteQuery.data) {
    return (
      <InviteShell>
        <p className="text-center text-sm text-muted-foreground">
          {errorMessage(inviteQuery.error)}
        </p>
        <Button asChild className="mt-6 w-full" variant="outline">
          <Link to="/auth">ورود به سالونا</Link>
        </Button>
      </InviteShell>
    )
  }

  const { invite, routing } = inviteQuery.data

  if (routing.action === 'unavailable') {
    return (
      <InviteShell>
        <h1 className="text-center text-lg font-bold text-foreground">
          {routing.reason === 'expired'
            ? 'مهلت این دعوت به پایان رسیده'
            : 'این دعوت دیگر فعال نیست'}
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          از مدیر سالن بخواهید در صورت نیاز دعوت تازه‌ای بفرستد.
        </p>
      </InviteShell>
    )
  }

  if (routing.action === 'switch_account') {
    return (
      <InviteShell>
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted">
          <UserRoundX className="size-6 text-muted-foreground" />
        </div>
        <h1 className="mt-4 text-center text-lg font-bold text-foreground">
          این دعوت برای حساب دیگری است
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          دعوت سالن «{invite.salonName}» برای شماره {invite.phone} است. برای
          ادامه با حساب درست وارد شوید.
        </p>
        {user ? (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            الان با {user.phone} وارد هستید.
          </p>
        ) : null}
        <Button
          className="mt-6 w-full"
          onClick={async () => {
            await logout()
            await navigate({
              to: '/auth',
              search: { redirect: invitePath },
            })
          }}
        >
          تعویض حساب
        </Button>
      </InviteShell>
    )
  }

  if (routing.action === 'continue') {
    return (
      <InviteShell>
        <h1 className="text-center text-lg font-bold text-foreground">
          دعوت به {invite.salonName}
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          شماره شما با این دعوت هم‌خوان است. پذیرش دعوت فقط بعد از تایید شماره و
          انتخاب صریح شما انجام می‌شود.
        </p>
        <Button
          className="mt-6 w-full"
          onClick={() => {
            void navigate({ to: '/staff-invites', replace: true })
          }}
        >
          ادامه
        </Button>
      </InviteShell>
    )
  }

  const isRegister = routing.action === 'register'

  return (
    <InviteShell>
      <h1 className="text-center text-lg font-bold text-foreground">
        دعوت به {invite.salonName}
      </h1>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        {invite.staffName} با شماره {invite.phone} دعوت شده‌اید. لینک به‌تنهایی
        دسترسی نمی‌دهد — ابتدا{' '}
        {isRegister ? 'ثبت‌نام و تایید شماره' : 'ورود و تایید شماره'} لازم است.
      </p>
      <Button
        className="mt-6 w-full gap-2"
        onClick={() => {
          void navigate({
            to: '/auth',
            search: { redirect: invitePath },
          })
        }}
      >
        {isRegister ? (
          <UserPlus className="size-4" />
        ) : (
          <LogIn className="size-4" />
        )}
        {isRegister ? 'ثبت‌نام با این شماره' : 'ورود با این شماره'}
      </Button>
    </InviteShell>
  )
}

function InviteShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-8">
      <div className="mb-8 flex items-center justify-between">
        <SalunaMark className="h-8" />
        <Button asChild size="icon-sm" variant="ghost">
          <Link to="/auth" aria-label="بازگشت">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
      </div>
      {children}
    </div>
  )
}
