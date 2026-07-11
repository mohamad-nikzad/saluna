import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect } from 'react'
import { Building2 } from 'lucide-react'
import { Button } from '@repo/ui/button'
import { Spinner } from '@repo/ui/spinner'

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
    if (session.status === 'needs_workspace') throw redirect({ to: '/signup' })
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
  const { refresh } = useAuth()
  const navigate = useNavigate()
  const invites = useQuery({
    queryKey: ['auth', 'staff-invites'],
    queryFn: ({ signal }) => api.auth.listStaffInvites({ signal }),
  })

  const finish = useCallback(async () => {
    const next = await refresh()
    if (next?.status === 'needs_salon_selection') {
      await navigate({ to: '/select-salon', replace: true })
    } else if (next?.status === 'ready') {
      await navigate({ to: homePathForRole(next.user.role), replace: true })
    }
  }, [navigate, refresh])

  const respond = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
      accept ? api.auth.acceptStaffInvite(id) : api.auth.declineStaffInvite(id),
    onSuccess: async (_, variables) => {
      if (variables.accept) clearPersistedActiveSalonId()
      await invites.refetch()
    },
  })

  useEffect(() => {
    if (invites.isSuccess && !invites.data.invites.length) void finish()
  }, [finish, invites.isSuccess, invites.data])

  if (invites.isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (invites.isError) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-5 text-center">
        <p className="text-sm text-muted-foreground">
          دریافت دعوت‌ها انجام نشد. دوباره تلاش کنید.
        </p>
        <Button className="mt-4" onClick={() => void invites.refetch()}>
          تلاش دوباره
        </Button>
      </main>
    )
  }

  if (!invites.data?.invites.length) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-8">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-blush-soft text-primary">
          <Building2 className="size-7" />
        </div>
        <h1 className="text-2xl font-extrabold">دعوت‌های سالن</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          دعوت‌های در انتظار را بپذیرید یا رد کنید.
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {invites.data.invites.map((invite) => (
          <li
            key={invite.id}
            className="rounded-2xl border border-line-soft bg-card p-4"
          >
            <p className="font-bold">{invite.salonName}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              پروفایل {invite.staffName}
            </p>
            <div className="mt-4 flex gap-2">
              <Button
                disabled={respond.isPending}
                onClick={() => respond.mutate({ id: invite.id, accept: true })}
              >
                پذیرفتن
              </Button>
              <Button
                variant="outline"
                disabled={respond.isPending}
                onClick={() => respond.mutate({ id: invite.id, accept: false })}
              >
                رد کردن
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {respond.isError ? (
        <p className="mt-4 text-center text-sm text-destructive">
          ثبت پاسخ دعوت انجام نشد. دوباره تلاش کنید.
        </p>
      ) : null}
      {session.status === 'ready' ? (
        <Button
          className="mt-auto"
          variant="ghost"
          onClick={() =>
            void navigate({ to: homePathForRole(session.user.role) })
          }
        >
          بعداً
        </Button>
      ) : null}
    </main>
  )
}
