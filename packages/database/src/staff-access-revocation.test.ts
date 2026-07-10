import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  transaction: vi.fn(),
  ops: [] as Array<{
    kind: 'select' | 'update' | 'delete'
    table: unknown
    set?: Record<string, unknown>
  }>,
  accessRow: null as Record<string, unknown> | null,
  profileRow: null as Record<string, unknown> | null,
}))

vi.mock('./client', () => ({
  getDb: mocks.getDb,
}))

import {
  deactivateStaffProfileWithAccessRevocation,
  evaluateStaffAccessRevocation,
  leaveStaffProfileAccess,
  revokeStaffProfileAccess,
} from './staff-access-revocation'
import {
  appointmentRequests,
  appointments,
  member,
  salonMember,
  staffProfileAccesses,
  staffProfiles,
  staffSchedules,
  staffServices,
} from './schema'

const now = new Date('2026-07-11T12:00:00Z')

const profile = {
  id: 'profile-a',
  salonId: 'salon-a',
  userId: 'user-1',
  active: true,
}

const access = {
  id: 'access-1',
  salonId: 'salon-a',
  staffProfileId: 'profile-a',
  userId: 'user-1',
  revokedAt: null as Date | null,
}

function tableName(table: unknown): string {
  if (table === staffProfiles) return 'staffProfiles'
  if (table === staffProfileAccesses) return 'staffProfileAccesses'
  if (table === staffSchedules) return 'staffSchedules'
  if (table === staffServices) return 'staffServices'
  if (table === appointments) return 'appointments'
  if (table === appointmentRequests) return 'appointmentRequests'
  if (table === salonMember) return 'salonMember'
  if (table === member) return 'member'
  return 'unknown'
}

function setupDbMock() {
  const selectChain = {
    from: (table: unknown) => {
      mocks.ops.push({ kind: 'select', table })
      return {
        where: () => ({
          limit: () => ({
            for: async () => {
              if (table === staffProfileAccesses) {
                return mocks.accessRow ? [mocks.accessRow] : []
              }
              if (table === staffProfiles) {
                return mocks.profileRow ? [mocks.profileRow] : []
              }
              return []
            },
          }),
        }),
      }
    },
  }

  const tx = {
    select: () => selectChain,
    update: (table: unknown) => ({
      set: (set: Record<string, unknown>) => ({
        where: () => {
          mocks.ops.push({ kind: 'update', table, set })
          const apply = () => {
            if (table === staffProfileAccesses) {
              const next = {
                ...(mocks.accessRow ?? {}),
                ...set,
              }
              mocks.accessRow = next
              return [next]
            }
            if (table === staffProfiles) {
              const next = {
                ...(mocks.profileRow ?? {}),
                ...set,
              }
              mocks.profileRow = next
              return [next]
            }
            return [{}]
          }
          const result = Promise.resolve(apply())
          return Object.assign(result, {
            returning: async () => apply(),
          })
        },
      }),
    }),
    delete: (table: unknown) => ({
      where: async () => {
        mocks.ops.push({ kind: 'delete', table })
        return []
      },
    }),
  }

  mocks.transaction.mockImplementation(async (callback) => callback(tx))
  mocks.getDb.mockReturnValue({ transaction: mocks.transaction })
}

function seedActiveAccess() {
  mocks.accessRow = {
    id: 'access-1',
    salonId: 'salon-a',
    staffProfileId: 'profile-a',
    userId: 'user-1',
    revokedAt: null,
    createdAt: now,
    updatedAt: now,
  }
  mocks.profileRow = {
    id: 'profile-a',
    salonId: 'salon-a',
    userId: 'user-1',
    name: 'Sara',
    phone: '09121234567',
    color: 'mint',
    active: true,
    claimedAt: now,
    accessDetachedAt: null,
    createdAt: now,
    updatedAt: now,
  }
}

function opsFor(kind: 'select' | 'update' | 'delete', table: unknown) {
  return mocks.ops.filter((op) => op.kind === kind && op.table === table)
}

describe('evaluateStaffAccessRevocation', () => {
  it('allows manager revoke when Staff Profile Access is active', () => {
    expect(
      evaluateStaffAccessRevocation({
        mode: 'revoke_only',
        salonId: 'salon-a',
        profile,
        access,
      }),
    ).toEqual({ status: 'ok', profile, access })
  })

  it('allows staff leave when their own access is active', () => {
    expect(
      evaluateStaffAccessRevocation({
        mode: 'revoke_only',
        salonId: 'salon-a',
        profile,
        access,
      }),
    ).toEqual({ status: 'ok', profile, access })
  })

  it('rejects revoke when access is already revoked', () => {
    expect(
      evaluateStaffAccessRevocation({
        mode: 'revoke_only',
        salonId: 'salon-a',
        profile,
        access: { ...access, revokedAt: new Date('2026-07-01T00:00:00Z') },
      }),
    ).toEqual({ status: 'rejected', reason: 'already_revoked' })
  })

  it('rejects revoke when there is no access and no linked identity', () => {
    expect(
      evaluateStaffAccessRevocation({
        mode: 'revoke_only',
        salonId: 'salon-a',
        profile: { ...profile, userId: null },
        access: null,
      }),
    ).toEqual({ status: 'rejected', reason: 'access_not_found' })
  })

  it('allows revoke for claim-path profile linked by userId without access row', () => {
    expect(
      evaluateStaffAccessRevocation({
        mode: 'revoke_only',
        salonId: 'salon-a',
        profile,
        access: null,
      }),
    ).toEqual({ status: 'ok', profile, access: null })
  })

  it('rejects when the profile is missing', () => {
    expect(
      evaluateStaffAccessRevocation({
        mode: 'revoke_only',
        salonId: 'salon-a',
        profile: null,
        access,
      }),
    ).toEqual({ status: 'rejected', reason: 'profile_not_found' })
  })

  it('rejects when the profile belongs to another salon', () => {
    expect(
      evaluateStaffAccessRevocation({
        mode: 'revoke_only',
        salonId: 'salon-a',
        profile: { ...profile, salonId: 'salon-b' },
        access,
      }),
    ).toEqual({ status: 'rejected', reason: 'wrong_salon' })
  })

  it('allows deactivate even when access was already revoked', () => {
    expect(
      evaluateStaffAccessRevocation({
        mode: 'deactivate',
        salonId: 'salon-a',
        profile,
        access: { ...access, revokedAt: new Date('2026-07-01T00:00:00Z') },
      }),
    ).toEqual({
      status: 'ok',
      profile,
      access: { ...access, revokedAt: new Date('2026-07-01T00:00:00Z') },
    })
  })

  it('allows deactivate of an unclaimed pending Staff Profile without access', () => {
    expect(
      evaluateStaffAccessRevocation({
        mode: 'deactivate',
        salonId: 'salon-a',
        profile: { ...profile, userId: null },
        access: null,
      }),
    ).toEqual({
      status: 'ok',
      profile: { ...profile, userId: null },
      access: null,
    })
  })
})

describe('Staff Access Revocation persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.ops = []
    mocks.accessRow = null
    mocks.profileRow = null
    setupDbMock()
    seedActiveAccess()
  })

  it('revoke keeps schedule, capabilities, appointments, and history; remaps future appointments to the Staff Profile', async () => {
    const result = await revokeStaffProfileAccess({
      salonId: 'salon-a',
      targetId: 'user-1',
      now,
    })

    expect(result).toMatchObject({
      status: 'revoked',
      profileDeactivated: false,
      access: { revokedAt: now },
      profile: {
        id: 'profile-a',
        active: true,
        userId: null,
        accessDetachedAt: now,
      },
    })

    // Access is revoked; profile stays salon-owned and active.
    expect(opsFor('delete', staffProfiles)).toHaveLength(0)
    expect(opsFor('delete', staffSchedules)).toHaveLength(0)
    expect(opsFor('delete', staffServices)).toHaveLength(0)
    expect(opsFor('delete', appointments)).toHaveLength(0)
    expect(opsFor('delete', appointmentRequests)).toHaveLength(0)

    // Operational refs move from login identity → Staff Profile id (not deleted).
    expect(opsFor('update', staffSchedules)[0]?.set).toMatchObject({
      staffId: 'profile-a',
    })
    expect(opsFor('update', staffServices)[0]?.set).toMatchObject({
      staffUserId: 'profile-a',
    })
    expect(opsFor('update', appointments)[0]?.set).toMatchObject({
      staffId: 'profile-a',
    })
    expect(opsFor('update', appointmentRequests)[0]?.set).toMatchObject({
      staffId: 'profile-a',
    })

    // Membership is removed so the identity cannot re-enter the salon.
    expect(opsFor('delete', salonMember)).toHaveLength(1)
    expect(opsFor('delete', member)).toHaveLength(1)

    // Sanity: we never delete operational tables by accident.
    expect(
      mocks.ops
        .filter((op) => op.kind === 'delete')
        .map((op) => tableName(op.table))
        .sort(),
    ).toEqual(['member', 'salonMember'])
  })

  it('leave uses the same access-only revocation and preserves operational rows', async () => {
    const result = await leaveStaffProfileAccess({
      userId: 'user-1',
      salonId: 'salon-a',
      now,
    })

    expect(result).toMatchObject({
      status: 'revoked',
      profileDeactivated: false,
      access: { revokedAt: now },
      profile: { id: 'profile-a', active: true, userId: null },
    })
    expect(opsFor('delete', staffSchedules)).toHaveLength(0)
    expect(opsFor('delete', staffServices)).toHaveLength(0)
    expect(opsFor('delete', appointments)).toHaveLength(0)
    expect(opsFor('update', appointments)[0]?.set).toMatchObject({
      staffId: 'profile-a',
    })
  })

  it('deactivate sets access revokedAt while keeping profile, schedule, and capabilities', async () => {
    const result = await deactivateStaffProfileWithAccessRevocation({
      salonId: 'salon-a',
      targetId: 'user-1',
      now,
    })

    expect(result).toMatchObject({
      status: 'revoked',
      profileDeactivated: true,
      access: { revokedAt: now },
      profile: {
        id: 'profile-a',
        active: false,
        userId: null,
        accessDetachedAt: now,
      },
    })

    expect(opsFor('update', staffProfileAccesses)[0]?.set).toMatchObject({
      revokedAt: now,
    })
    expect(opsFor('update', staffProfiles)[0]?.set).toMatchObject({
      active: false,
      userId: null,
    })
    expect(opsFor('delete', staffProfiles)).toHaveLength(0)
    expect(opsFor('delete', staffSchedules)).toHaveLength(0)
    expect(opsFor('delete', staffServices)).toHaveLength(0)
    expect(opsFor('update', staffSchedules)[0]?.set).toMatchObject({
      staffId: 'profile-a',
    })
    expect(opsFor('update', staffServices)[0]?.set).toMatchObject({
      staffUserId: 'profile-a',
    })
  })
})
