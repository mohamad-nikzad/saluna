import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'

import { Button } from '@repo/ui/button'
import { Spinner } from '@repo/ui/spinner'
import { ApiError } from '@repo/api-client'

import { displayPhone } from '@repo/salon-core/phone'
import { AuthShell } from '#/components/auth/auth-shell'
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
      <AuthShell title="دعوت به سالن">
        <div
          role="status"
          className="flex items-center gap-3 py-6 text-sm text-muted-foreground"
        >
          <Spinner />
          در حال دریافت دعوت…
        </div>
      </AuthShell>
    )
  }

  if (inviteQuery.isError || !inviteQuery.data) {
    return (
      <AuthShell
        title="دعوت در دسترس نیست"
        description={errorMessage(inviteQuery.error)}
      >
        <Button
          asChild
          size="lg"
          className="h-12 w-full rounded-xl"
          variant="outline"
        >
          <Link to="/auth">ورود به سالونا</Link>
        </Button>
      </AuthShell>
    )
  }

  const { invite, routing } = inviteQuery.data

  if (routing.action === 'unavailable') {
    return (
      <AuthShell
        title={
          routing.reason === 'expired'
            ? 'مهلت این دعوت به پایان رسیده'
            : 'این دعوت دیگر فعال نیست'
        }
        description="از مدیر سالن بخواهید دعوت را دوباره بفرستد."
      >
        <Button asChild size="lg" className="h-12 w-full rounded-xl">
          <Link to="/auth">ورود و بررسی دعوت‌ها</Link>
        </Button>
      </AuthShell>
    )
  }

  const switchAccount = routing.action === 'switch_account'
  const canContinue = routing.action === 'continue'

  return (
    <AuthShell
      title={switchAccount ? 'این دعوت برای حساب دیگری است' : 'دعوت به سالن'}
      description={
        switchAccount
          ? 'با شماره‌ای که در دعوت ثبت شده وارد شوید.'
          : canContinue
            ? 'نام و شماره‌تان را بررسی کنید.'
            : 'با شماره زیر وارد شوید و دعوت را بررسی کنید.'
      }
    >
      <div className="mb-7 flex flex-col gap-4 rounded-xl border border-line-soft p-5">
        <h2 className="break-words text-xl font-bold leading-8">
          {invite.salonName}
        </h2>
        <dl className="flex flex-col gap-3 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <dt className="text-muted-foreground">دعوت برای</dt>
            <dd className="break-words font-medium">{invite.staffName}</dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <dt className="text-muted-foreground">شماره موبایل</dt>
            <dd>
              <bdi className="tabular-nums">{displayPhone(invite.phone)}</bdi>
            </dd>
          </div>
        </dl>
      </div>
      {switchAccount && user ? (
        <p className="mb-5 text-sm leading-7 text-muted-foreground">
          حساب فعلی شما: <bdi>{displayPhone(user.phone)}</bdi>
        </p>
      ) : null}
      <Button
        size="lg"
        className="h-12 w-full rounded-xl"
        onClick={async () => {
          if (switchAccount) await logout()
          if (canContinue) {
            await navigate({ to: '/staff-invites', replace: true })
          } else {
            await navigate({ to: '/auth', search: { redirect: invitePath } })
          }
        }}
      >
        {switchAccount
          ? 'تغییر حساب'
          : canContinue
            ? 'بررسی دعوت'
            : 'ورود و بررسی دعوت'}
      </Button>
    </AuthShell>
  )
}
