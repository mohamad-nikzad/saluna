import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@repo/ui/button'
import { Spinner } from '@repo/ui/spinner'
import { displayPhone } from '@repo/salon-core/phone'
import { AuthShell } from '#/components/auth/auth-shell'

import { api } from '#/lib/api-client'
import { clearPersistedActiveSalonId } from '#/lib/active-salon'
import { authQueryKey, useAuth, type AuthSession } from '#/lib/auth'
import { homePathForRole } from '#/lib/navigation'

export const Route = createFileRoute('/staff-invites')({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData<AuthSession>({
      queryKey: authQueryKey,
    })
    if (!session) throw redirect({ to: '/auth' })
    if (session.status === 'needs_staff_password')
      throw redirect({ to: '/auth' })
    if (session.status === 'ready' && session.user.role !== 'staff') {
      throw redirect({ to: homePathForRole(session.user.role) })
    }
    return { session }
  },
  component: StaffInvitesPage,
})

function StaffInvitesPage() {
  const { session } = Route.useRouteContext()
  const { refresh, logout } = useAuth()
  const navigate = useNavigate()
  const invites = useQuery({
    queryKey: ['auth', 'staff-invites'],
    queryFn: ({ signal }) => api.auth.listStaffInvites({ signal }),
  })

  const finish = useCallback(async () => {
    const next = await refresh()
    if (next?.status === 'needs_salon_selection') {
      await navigate({ to: '/select-salon', replace: true })
    } else if (next?.status === 'needs_staff_password') {
      await navigate({ to: '/auth', replace: true })
    } else if (next?.status === 'needs_workspace') {
      // Stay here until the person explicitly chooses to create a salon.
      return
    } else if (next?.status === 'ready') {
      await navigate({ to: homePathForRole(next.user.role), replace: true })
    }
  }, [navigate, refresh])

  const respond = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
      accept ? api.auth.acceptStaffInvite(id) : api.auth.declineStaffInvite(id),
    onError: async () => {
      await invites.refetch()
    },
    onSuccess: async (_, variables) => {
      if (variables.accept) clearPersistedActiveSalonId()
      await invites.refetch()
      if (variables.accept) await finish()
    },
  })

  useEffect(() => {
    if (invites.isSuccess && !invites.data.invites.length) void finish()
  }, [finish, invites.isSuccess, invites.data])

  if (invites.isPending) {
    return (
      <AuthShell title="دعوت‌های سالن">
        <div
          role="status"
          className="flex items-center gap-3 py-6 text-sm text-muted-foreground"
        >
          <Spinner />
          در حال دریافت دعوت‌ها…
        </div>
      </AuthShell>
    )
  }

  if (invites.isError) {
    return (
      <AuthShell
        title="دعوت‌های سالن"
        description="دعوت‌ها بارگذاری نشدند. دوباره تلاش کنید."
      >
        <Button
          size="lg"
          className="h-12 w-full rounded-xl"
          onClick={() => void invites.refetch()}
        >
          تلاش دوباره
        </Button>
      </AuthShell>
    )
  }

  const hasInvites = invites.data.invites.length > 0
  const hasSalonAccess =
    session.status === 'ready' || session.status === 'needs_salon_selection'

  return (
    <AuthShell
      title={hasInvites ? 'پیوستن به سالن' : 'هنوز به سالنی دسترسی ندارید'}
      description={
        hasInvites
          ? 'نام سالن و نام خودتان را بررسی کنید.'
          : 'از مدیر سالن بخواهید شما را با این شماره دعوت کند.'
      }
      footer={
        <div className="flex flex-col gap-4">
          {hasSalonAccess ? (
            <Button
              size="lg"
              className="h-12 w-full rounded-xl"
              disabled={respond.isPending}
              onClick={() => void finish()}
            >
              ادامه به سالن‌های من
            </Button>
          ) : null}
          {!hasInvites ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">صاحب سالن هستید؟</span>
              <Button
                variant="link"
                onClick={() =>
                  void navigate({ to: '/signup', search: { create: true } })
                }
              >
                ساخت سالن خودم
              </Button>
            </div>
          ) : null}
          <Button
            variant="ghost"
            className="min-h-11 w-full rounded-xl"
            disabled={respond.isPending}
            onClick={async () => {
              await logout()
              await navigate({ to: '/auth', replace: true })
            }}
          >
            ورود با شماره دیگر
          </Button>
        </div>
      }
    >
      {session.user?.phone ? (
        <p className="mb-6 border-b border-line-soft pb-4">
          <bdi className="text-base font-medium tabular-nums">
            {displayPhone(session.user.phone)}
          </bdi>
        </p>
      ) : null}
      {hasInvites ? (
        <ul className="flex flex-col gap-6">
          {invites.data.invites.map((invite) => {
            const expired =
              invite.status === 'expired' ||
              new Date(invite.expiresAt).getTime() <= Date.now()
            const pending =
              respond.isPending && respond.variables?.id === invite.id
            return (
              <li
                key={invite.id}
                className="flex flex-col gap-5 border-b border-line-soft pb-6 last:border-b-0 last:pb-0"
              >
                <div className="flex flex-col gap-1.5">
                  <h2 className="break-words text-lg font-bold leading-7">
                    {invite.salonName}
                  </h2>
                  <p className="break-words text-sm leading-6 text-muted-foreground">
                    دعوت برای {invite.staffName}
                  </p>
                </div>
                {expired ? (
                  <div className="flex flex-col gap-2 rounded-xl bg-muted p-4">
                    <h3 className="text-sm font-medium">
                      مهلت این دعوت تمام شده است
                    </h3>
                    <p className="text-sm leading-7 text-muted-foreground">
                      از مدیر سالن بخواهید دعوت را دوباره بفرستد.
                    </p>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <Button
                      size="lg"
                      className="h-12 flex-1 rounded-xl"
                      disabled={respond.isPending}
                      onClick={() =>
                        respond.mutate({ id: invite.id, accept: true })
                      }
                    >
                      {pending && respond.variables?.accept ? (
                        <Spinner />
                      ) : null}
                      پذیرفتن
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      className="h-12 rounded-xl"
                      disabled={respond.isPending}
                      onClick={() =>
                        respond.mutate({ id: invite.id, accept: false })
                      }
                    >
                      {pending && !respond.variables?.accept ? (
                        <Spinner />
                      ) : null}
                      رد کردن
                    </Button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      ) : null}
      {respond.isError ? (
        <p role="alert" className="mt-5 text-sm leading-6 text-destructive">
          پاسخ شما ثبت نشد. دوباره تلاش کنید.
        </p>
      ) : null}
      <Button
        className="mt-6 min-h-11 w-full rounded-xl"
        variant={hasInvites ? 'ghost' : 'outline'}
        disabled={invites.isFetching || respond.isPending}
        onClick={() => void invites.refetch()}
      >
        {invites.isFetching ? <Spinner /> : <RefreshCw />}
        بررسی دوباره
      </Button>
    </AuthShell>
  )
}
