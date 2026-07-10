// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  me: vi.fn(),
  setPersistedActiveSalonId: vi.fn(),
  clearPersistedActiveSalonId: vi.fn(),
}))

vi.mock('#/lib/api-client', () => ({
  api: {
    auth: {
      me: mocks.me,
    },
  },
}))

vi.mock('#/lib/active-salon', () => ({
  setPersistedActiveSalonId: mocks.setPersistedActiveSalonId,
  clearPersistedActiveSalonId: mocks.clearPersistedActiveSalonId,
}))

import { applyActiveSalonSelection } from './apply-active-salon'

describe('applyActiveSalonSelection', () => {
  const setSession = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('persists and returns ready when /me succeeds with a salon', async () => {
    const session = {
      status: 'ready' as const,
      user: {
        id: 'u1',
        role: 'staff' as const,
        salonId: 'salon-b',
        salonName: 'سالن ب',
        name: 'Staff',
        phone: '09120000000',
      },
    }
    mocks.me.mockResolvedValue(session)

    const result = await applyActiveSalonSelection('salon-b', setSession)

    expect(mocks.setPersistedActiveSalonId).toHaveBeenCalledWith('salon-b')
    expect(mocks.me).toHaveBeenCalledWith({ salonId: 'salon-b' })
    expect(mocks.clearPersistedActiveSalonId).not.toHaveBeenCalled()
    expect(setSession).toHaveBeenCalledWith(session)
    expect(result).toEqual({ kind: 'ready', session })
  })

  it('clears persistence when /me still needs salon selection', async () => {
    const session = {
      status: 'needs_salon_selection' as const,
      user: { id: 'u1', name: 'Staff', phone: '09120000000' },
      salons: [
        {
          salonId: 'salon-a',
          salonName: 'سالن آ',
          staffProfileId: 'p-a',
        },
      ],
    }
    mocks.me.mockResolvedValue(session)

    const result = await applyActiveSalonSelection('salon-gone', setSession)

    expect(mocks.clearPersistedActiveSalonId).toHaveBeenCalled()
    expect(setSession).toHaveBeenCalledWith(session)
    expect(result).toEqual({ kind: 'needs_salon_selection', session })
  })

  it('clears persistence for other non-ready session statuses', async () => {
    const session = {
      status: 'needs_workspace' as const,
      user: { id: 'u1', name: 'Staff', phone: '09120000000' },
    }
    mocks.me.mockResolvedValue(session)

    const result = await applyActiveSalonSelection('salon-b', setSession)

    expect(mocks.clearPersistedActiveSalonId).toHaveBeenCalled()
    expect(setSession).toHaveBeenCalledWith(session)
    expect(result).toEqual({ kind: 'blocked', session })
  })
})
