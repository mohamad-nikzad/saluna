import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Building2, ChevronLeft } from 'lucide-react'
import { useState } from 'react'
import type { StaffSalonOption } from '@repo/api-client/auth'
import { Button } from '@repo/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@repo/ui/drawer'
import { Spinner } from '@repo/ui/spinner'
import { cn } from '@repo/ui/utils'

import { api } from '#/lib/api-client'
import { applyActiveSalonSelection } from '#/lib/apply-active-salon'
import { authQueryKey, useAuth } from '#/lib/auth'
import { homePathForRole } from '#/lib/navigation'

export function staffSalonsQueryOptions() {
  return {
    queryKey: ['auth', 'staff-salons'] as const,
    queryFn: async ({ signal }: { signal?: AbortSignal }) => {
      const { salons } = await api.auth.listStaffSalons({ signal })
      return salons
    },
    staleTime: 60_000,
  }
}

/**
 * In-app salon switcher for staff with multiple accepted salons.
 * Shows the current salon name and opens a picker without logging out.
 */
export function StaffSalonSwitcher({
  className,
  compact = false,
}: {
  className?: string
  compact?: boolean
}) {
  const { user, setSession } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState(false)

  const salonsQuery = useQuery({
    ...staffSalonsQueryOptions(),
    enabled: user?.role === 'staff',
  })

  if (!user || user.role !== 'staff') return null

  const salons = salonsQuery.data ?? []
  const currentName =
    user.salonName ??
    salons.find((salon) => salon.salonId === user.salonId)?.salonName ??
    null
  const canSwitch = salons.length > 1

  if (!currentName && salonsQuery.isPending) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 text-xs text-muted-foreground',
          className,
        )}
      >
        <Spinner className="size-3.5" />
        <span>سالن…</span>
      </div>
    )
  }

  if (!currentName) return null

  const switchTo = async (salon: StaffSalonOption) => {
    if (salon.salonId === user.salonId) {
      setOpen(false)
      return
    }
    setSwitching(true)
    try {
      const result = await applyActiveSalonSelection(salon.salonId, setSession)
      if (result.kind === 'needs_salon_selection') {
        setOpen(false)
        await navigate({ to: '/select-salon' })
        return
      }
      if (result.kind !== 'ready') return
      await queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] !== authQueryKey[0],
      })
      setOpen(false)
      await navigate({ to: homePathForRole(result.session.user.role) })
    } finally {
      setSwitching(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className={cn(
          'flex min-h-9 min-w-0 items-center gap-1.5 rounded-xl text-start touch-manipulation touch:min-h-11',
          canSwitch && 'active:opacity-80',
          !canSwitch && 'cursor-default',
          className,
        )}
        onClick={() => {
          if (canSwitch) setOpen(true)
        }}
        aria-label={canSwitch ? 'تغییر سالن' : `سالن فعال: ${currentName}`}
        disabled={!canSwitch || switching}
      >
        <Building2
          className={cn(
            'shrink-0 text-primary',
            compact ? 'size-3.5' : 'size-4',
          )}
          strokeWidth={1.8}
        />
        <span
          className={cn(
            'min-w-0 truncate font-semibold text-foreground',
            compact ? 'text-xs' : 'text-sm',
          )}
        >
          {currentName}
        </span>
        {canSwitch ? (
          <ChevronLeft className="size-4 shrink-0 text-muted-foreground" />
        ) : null}
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>تغییر سالن</DrawerTitle>
          </DrawerHeader>
          <div className="flex flex-col gap-2 px-4 pb-6">
            {salons.map((salon) => {
              const active = salon.salonId === user.salonId
              return (
                <Button
                  key={salon.salonId}
                  type="button"
                  variant={active ? 'secondary' : 'outline'}
                  className="justify-start gap-3 rounded-2xl text-right"
                  disabled={switching}
                  onClick={() => void switchTo(salon)}
                >
                  <Building2 className="size-5 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate font-bold">
                    {salon.salonName}
                  </span>
                  {active ? (
                    <span className="text-xs text-muted-foreground">فعلی</span>
                  ) : null}
                </Button>
              )
            })}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  )
}
