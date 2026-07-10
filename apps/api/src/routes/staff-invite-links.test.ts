import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@repo/database/staff', () => ({
  resolveStaffInviteByToken: vi.fn(),
  evaluateStaffInviteLinkRouting: vi.fn(),
  maskStaffInvitePhone: (phone: string) =>
    phone.length < 8 ? phone : `${phone.slice(0, 4)}•••${phone.slice(-4)}`,
}))

vi.mock('@repo/auth/server', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

vi.mock('@repo/database/client', () => ({
  getDb: vi.fn(),
}))

import {
  evaluateStaffInviteLinkRouting,
  resolveStaffInviteByToken,
} from '@repo/database/staff'
import { auth as authServer } from '@repo/auth/server'
import { getDb } from '@repo/database/client'
import { staffInviteLinksRoute } from './staff-invite-links'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgres://stub'
process.env.JWT_SECRET = 'test-secret'

const token = 'a'.repeat(43)

function mockDbSelect(result: unknown[]) {
  const limit = vi.fn().mockResolvedValue(result)
  const where = vi.fn().mockReturnValue({ limit })
  const from = vi.fn().mockReturnValue({ where })
  const select = vi.fn().mockReturnValue({ from })
  vi.mocked(getDb).mockReturnValue({ select } as never)
  return { select, from, where, limit }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(authServer.api.getSession).mockResolvedValue(null)
  mockDbSelect([])
  vi.mocked(evaluateStaffInviteLinkRouting).mockReturnValue({
    action: 'register',
  })
})

describe('staff invite links', () => {
  it('routes invite links to registration when the phone is new', async () => {
    vi.mocked(resolveStaffInviteByToken).mockResolvedValue({
      status: 'ok',
      invite: {
        inviteId: 'invite-1',
        salonId: 'salon-1',
        salonName: 'Salon A',
        staffProfileId: 'profile-1',
        staffName: 'Sara',
        phone: '09121234567',
        expiresAt: new Date('2026-07-25T12:00:00Z'),
        status: 'pending',
      },
    })
    vi.mocked(evaluateStaffInviteLinkRouting).mockReturnValue({
      action: 'register',
    })

    const res = await staffInviteLinksRoute.request(`/${token}`)

    expect(res.status).toBe(200)
    expect(resolveStaffInviteByToken).toHaveBeenCalledWith({ token })
    expect(await res.json()).toMatchObject({
      invite: {
        id: 'invite-1',
        salonName: 'Salon A',
        phone: '0912•••4567',
        status: 'pending',
      },
      phoneRegistered: false,
      phonesMatch: null,
      routing: { action: 'register' },
    })
  })

  it('routes invite links to login when the phone is already registered', async () => {
    mockDbSelect([{ id: 'user-existing' }])
    vi.mocked(resolveStaffInviteByToken).mockResolvedValue({
      status: 'ok',
      invite: {
        inviteId: 'invite-1',
        salonId: 'salon-1',
        salonName: 'Salon A',
        staffProfileId: 'profile-1',
        staffName: 'Sara',
        phone: '09121234567',
        expiresAt: new Date('2026-07-25T12:00:00Z'),
        status: 'pending',
      },
    })
    vi.mocked(evaluateStaffInviteLinkRouting).mockReturnValue({
      action: 'login',
    })

    const res = await staffInviteLinksRoute.request(`/${token}`)

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      phoneRegistered: true,
      routing: { action: 'login' },
    })
  })

  it('shows switch-account when logged in as a different phone', async () => {
    vi.mocked(authServer.api.getSession).mockResolvedValue({
      user: { id: 'u-other' },
    } as never)
    const limit = vi
      .fn()
      .mockResolvedValueOnce([
        {
          phoneNumber: '09129876543',
          username: '09129876543',
          verified: true,
        },
      ])
      .mockResolvedValueOnce([{ id: 'user-existing' }])
    const where = vi.fn().mockReturnValue({ limit })
    const from = vi.fn().mockReturnValue({ where })
    const select = vi.fn().mockReturnValue({ from })
    vi.mocked(getDb).mockReturnValue({ select } as never)

    vi.mocked(resolveStaffInviteByToken).mockResolvedValue({
      status: 'ok',
      invite: {
        inviteId: 'invite-1',
        salonId: 'salon-1',
        salonName: 'Salon A',
        staffProfileId: 'profile-1',
        staffName: 'Sara',
        phone: '09121234567',
        expiresAt: new Date('2026-07-25T12:00:00Z'),
        status: 'pending',
      },
    })
    vi.mocked(evaluateStaffInviteLinkRouting).mockReturnValue({
      action: 'switch_account',
    })

    const res = await staffInviteLinksRoute.request(`/${token}`)

    expect(res.status).toBe(200)
    expect(evaluateStaffInviteLinkRouting).toHaveBeenCalledWith({
      inviteStatus: 'pending',
      sessionPresent: true,
      phonesMatch: false,
      phoneRegistered: true,
    })
    expect(await res.json()).toMatchObject({
      phonesMatch: false,
      routing: { action: 'switch_account' },
    })
  })

  it('does not grant access for an invalid invite token', async () => {
    vi.mocked(resolveStaffInviteByToken).mockResolvedValue({
      status: 'not_found',
    })

    const res = await staffInviteLinksRoute.request(`/${token}`)

    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ code: 'INVITE_INVALID' })
  })
})
