import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { Building2 } from 'lucide-react'
import { Button } from '@repo/ui/button'
import type { StaffSalonOption } from '@repo/api-client/auth'

import { authQueryKey, useAuth } from '#/lib/auth'
import type { AuthSession } from '#/lib/auth'
import {
  clearPersistedActiveSalonId,
  setPersistedActiveSalonId,
} from '#/lib/active-salon'
import { api } from '#/lib/api-client'
import { homePathForRole } from '#/lib/navigation'

export const Route = createFileRoute('/select-salon')({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData<AuthSession>({
      queryKey: authQueryKey,
    })
    if (!session) {
      throw redirect({ to: '/auth' })
    }
    if (session.status === 'needs_workspace') {
      throw redirect({ to: '/signup' })
    }
    if (session.status === 'needs_staff_password') {
      throw redirect({ to: '/auth' })
    }
    if (session.status === 'ready') {
      throw redirect({ to: homePathForRole(session.user.role) })
    }
    if (session.status !== 'needs_salon_selection') {
      throw redirect({ to: '/auth' })
    }
    return { salons: session.salons }
  },
  component: SelectSalonPage,
})

function SelectSalonPage() {
  const { salons } = Route.useRouteContext()
  const { setSession } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const selectSalon = async (salon: StaffSalonOption) => {
    setPersistedActiveSalonId(salon.salonId)
    const session = await api.auth.me({ salonId: salon.salonId })
    if (session.status === 'needs_salon_selection') {
      clearPersistedActiveSalonId()
      setSession(session)
      return
    }
    if (session.status !== 'ready' && session.status !== undefined) {
      clearPersistedActiveSalonId()
      setSession(session)
      return
    }
    setSession(session)
    await queryClient.invalidateQueries()
    await navigate({ to: homePathForRole(session.user.role) })
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background px-5 py-8">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="mb-8 space-y-2 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-blush-soft text-primary">
            <Building2 className="size-7" strokeWidth={1.8} />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            انتخاب سالن
          </h1>
          <p className="text-sm text-muted-foreground">
            در کدام سالن می‌خواهید وارد شوید؟
          </p>
        </div>

        <ul className="flex flex-col gap-3">
          {salons.map((salon) => (
            <li key={salon.salonId}>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full justify-start gap-3 rounded-2xl border-line-soft text-right"
                onClick={() => void selectSalon(salon)}
              >
                <Building2 className="size-5 shrink-0 text-primary" strokeWidth={1.8} />
                <span className="min-w-0 flex-1 truncate font-bold text-foreground">
                  {salon.salonName}
                </span>
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
