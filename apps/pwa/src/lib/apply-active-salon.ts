import type { MeResponse } from '@repo/api-client/auth'
import type { User } from '@repo/salon-core/types'

import {
  clearPersistedActiveSalonId,
  setPersistedActiveSalonId,
} from '#/lib/active-salon'
import { api } from '#/lib/api-client'

export type ApplyActiveSalonResult =
  | {
      kind: 'ready'
      session: { status?: 'ready'; user: User }
    }
  | {
      kind: 'needs_salon_selection'
      session: Extract<MeResponse, { status: 'needs_salon_selection' }>
    }
  | {
      kind: 'blocked'
      session: MeResponse
    }

/**
 * Persist a staff salon choice, re-fetch `/me` with that context, and sync the
 * auth session. Callers own navigation and query invalidation.
 */
export async function applyActiveSalonSelection(
  salonId: string,
  setSession: (session: MeResponse) => void,
): Promise<ApplyActiveSalonResult> {
  setPersistedActiveSalonId(salonId)
  const session = await api.auth.me({ salonId })

  if (session.status === 'needs_salon_selection') {
    clearPersistedActiveSalonId()
    setSession(session)
    return { kind: 'needs_salon_selection', session }
  }

  if (session.status !== 'ready' && session.status !== undefined) {
    clearPersistedActiveSalonId()
    setSession(session)
    return { kind: 'blocked', session }
  }

  setSession(session)
  return { kind: 'ready', session }
}
