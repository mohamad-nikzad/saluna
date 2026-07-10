import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
}))

vi.mock('./client', () => ({
  getDb: mocks.getDb,
}))

import {
  evaluateStaffNotificationRecipient,
  evaluateStaffTenantAccess,
  listActiveStaffProfileAccessesForUser,
  resolveStaffNotificationRecipient,
} from './staff-profile-access'

const accessA = {
  salonId: 'salon-a',
  staffProfileId: 'profile-a',
  profileActive: true,
}

const accessB = {
  salonId: 'salon-b',
  staffProfileId: 'profile-b',
  profileActive: true,
}

function selectChain<T>(rows: T[], opts?: { limit?: boolean }) {
  const builder = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
  }
  builder.from.mockReturnValue(builder)
  builder.innerJoin.mockReturnValue(builder)
  if (opts?.limit) {
    builder.where.mockReturnValue(builder)
    builder.limit.mockResolvedValue(rows)
  } else {
    builder.where.mockResolvedValue(rows)
  }
  return builder
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('evaluateStaffTenantAccess', () => {
  it('grants access for the requested salon when Staff Profile Access is active', () => {
    expect(
      evaluateStaffTenantAccess({
        requestedSalonId: 'salon-b',
        activeAccesses: [accessA, accessB],
      }),
    ).toEqual({
      status: 'ok',
      salonId: 'salon-b',
      staffProfileId: 'profile-b',
    })
  })

  it('rejects a salon with no active Staff Profile Access (wrong salon)', () => {
    expect(
      evaluateStaffTenantAccess({
        requestedSalonId: 'salon-c',
        activeAccesses: [accessA],
      }),
    ).toEqual({ status: 'rejected', reason: 'wrong_salon' })
  })

  it('rejects when the identity has no active Staff Profile Access', () => {
    expect(
      evaluateStaffTenantAccess({
        requestedSalonId: 'salon-a',
        activeAccesses: [],
      }),
    ).toEqual({ status: 'rejected', reason: 'no_access' })
  })

  it('rejects when the linked Staff Profile is inactive', () => {
    expect(
      evaluateStaffTenantAccess({
        requestedSalonId: 'salon-a',
        activeAccesses: [{ ...accessA, profileActive: false }],
      }),
    ).toEqual({ status: 'rejected', reason: 'inactive_profile' })
  })

  it('selects the sole active Staff Profile Access when no salon is requested', () => {
    expect(
      evaluateStaffTenantAccess({
        requestedSalonId: null,
        activeAccesses: [accessA],
      }),
    ).toEqual({
      status: 'ok',
      salonId: 'salon-a',
      staffProfileId: 'profile-a',
    })
  })

  it('rejects when multiple accesses exist and no salon is requested', () => {
    expect(
      evaluateStaffTenantAccess({
        requestedSalonId: null,
        activeAccesses: [accessA, accessB],
      }),
    ).toEqual({ status: 'rejected', reason: 'salon_required' })
  })

  it('treats pending, declined, expired, and revoked invites as no access (empty activeAccesses)', () => {
    // listActiveStaffProfileAccessesForUser only returns non-revoked access rows;
    // pending/declined/expired invites never produce activeAccesses entries.
    expect(
      evaluateStaffTenantAccess({
        requestedSalonId: 'salon-a',
        activeAccesses: [],
      }),
    ).toEqual({ status: 'rejected', reason: 'no_access' })
  })

  it('rejects salon context after Staff Profile Access for that salon is revoked', () => {
    // Before revoke the identity may enter salon-a. After revoke,
    // listActiveStaffProfileAccessesForUser drops the revoked row (isNull(revokedAt)),
    // so the same salon context is rejected.
    expect(
      evaluateStaffTenantAccess({
        requestedSalonId: 'salon-a',
        activeAccesses: [accessA, accessB],
      }),
    ).toEqual({
      status: 'ok',
      salonId: 'salon-a',
      staffProfileId: 'profile-a',
    })

    expect(
      evaluateStaffTenantAccess({
        requestedSalonId: 'salon-a',
        activeAccesses: [accessB],
      }),
    ).toEqual({ status: 'rejected', reason: 'wrong_salon' })

    expect(
      evaluateStaffTenantAccess({
        requestedSalonId: 'salon-a',
        activeAccesses: [],
      }),
    ).toEqual({ status: 'rejected', reason: 'no_access' })
  })
})

describe('evaluateStaffNotificationRecipient', () => {
  const candidateA = {
    userId: 'user-1',
    salonId: 'salon-a',
    staffProfileId: 'profile-a',
    profileActive: true,
  }
  const candidateB = {
    userId: 'user-1',
    salonId: 'salon-b',
    staffProfileId: 'profile-b',
    profileActive: true,
  }

  it('resolves the recipient from active Staff Profile Access by user id', () => {
    expect(
      evaluateStaffNotificationRecipient({
        salonId: 'salon-a',
        staffId: 'user-1',
        candidates: [candidateA, candidateB],
      }),
    ).toEqual({ userId: 'user-1', staffProfileId: 'profile-a' })
  })

  it('resolves the recipient from active Staff Profile Access by profile id', () => {
    expect(
      evaluateStaffNotificationRecipient({
        salonId: 'salon-b',
        staffId: 'profile-b',
        candidates: [candidateA, candidateB],
      }),
    ).toEqual({ userId: 'user-1', staffProfileId: 'profile-b' })
  })

  it('fans out per salon: same identity matches only the salon of the event', () => {
    expect(
      evaluateStaffNotificationRecipient({
        salonId: 'salon-b',
        staffId: 'user-1',
        candidates: [candidateA, candidateB],
      }),
    ).toEqual({ userId: 'user-1', staffProfileId: 'profile-b' })
  })

  it('excludes pre-filtered empty candidates (pending/declined/expired/revoked already dropped)', () => {
    expect(
      evaluateStaffNotificationRecipient({
        salonId: 'salon-a',
        staffId: 'user-1',
        candidates: [],
      }),
    ).toBeNull()
  })

  it('excludes inactive Staff Profiles', () => {
    expect(
      evaluateStaffNotificationRecipient({
        salonId: 'salon-a',
        staffId: 'user-1',
        candidates: [{ ...candidateA, profileActive: false }],
      }),
    ).toBeNull()
  })

  it('excludes candidates for a different salon', () => {
    expect(
      evaluateStaffNotificationRecipient({
        salonId: 'salon-c',
        staffId: 'user-1',
        candidates: [candidateA, candidateB],
      }),
    ).toBeNull()
  })
})

describe('listActiveStaffProfileAccessesForUser', () => {
  it('excludes a salon when Staff Profile Access has revokedAt set, even if claim-path profile remains', async () => {
    const selectBuilders = [
      selectChain([]),
      selectChain([
        {
          salonId: 'salon-a',
          staffProfileId: 'profile-a',
          profileActive: true,
        },
      ]),
      selectChain([{ salonId: 'salon-a', revokedAt: new Date('2026-07-01') }]),
    ]
    mocks.getDb.mockReturnValue({
      select: vi.fn(() => selectBuilders.shift()),
    })

    await expect(
      listActiveStaffProfileAccessesForUser('user-1'),
    ).resolves.toEqual([])
  })

  it('keeps claim-path salon when no access row exists and none are revoked', async () => {
    const selectBuilders = [
      selectChain([]),
      selectChain([
        {
          salonId: 'salon-a',
          staffProfileId: 'profile-a',
          profileActive: true,
        },
      ]),
      selectChain([]),
    ]
    mocks.getDb.mockReturnValue({
      select: vi.fn(() => selectBuilders.shift()),
    })

    await expect(
      listActiveStaffProfileAccessesForUser('user-1'),
    ).resolves.toEqual([
      {
        salonId: 'salon-a',
        staffProfileId: 'profile-a',
        profileActive: true,
      },
    ])
  })

  it('prefers non-revoked access rows and does not query revoked when claim is already covered', async () => {
    const selectBuilders = [
      selectChain([
        {
          salonId: 'salon-a',
          staffProfileId: 'profile-a',
          profileActive: true,
        },
      ]),
      selectChain([
        {
          salonId: 'salon-a',
          staffProfileId: 'profile-a',
          profileActive: true,
        },
      ]),
    ]
    const select = vi.fn(() => selectBuilders.shift())
    mocks.getDb.mockReturnValue({ select })

    await expect(
      listActiveStaffProfileAccessesForUser('user-1'),
    ).resolves.toEqual([
      {
        salonId: 'salon-a',
        staffProfileId: 'profile-a',
        profileActive: true,
      },
    ])
    expect(select).toHaveBeenCalledTimes(2)
  })
})

describe('resolveStaffNotificationRecipient', () => {
  it('excludes fan-out when Staff Profile Access has revokedAt set (claim-path still linked)', async () => {
    const selectBuilders = [
      // Active (non-revoked) access query — revoked row filtered by SQL.
      selectChain([]),
      // Claim-path profile still linked via userId.
      selectChain(
        [
          {
            userId: 'user-1',
            salonId: 'salon-a',
            staffProfileId: 'profile-a',
            profileActive: true,
            salonName: 'سالن آفتاب',
          },
        ],
        { limit: true },
      ),
      // Explicit revokedAt guard.
      selectChain([{ id: 'access-revoked', revokedAt: new Date('2026-07-01') }], {
        limit: true,
      }),
    ]
    mocks.getDb.mockReturnValue({
      select: vi.fn(() => selectBuilders.shift()),
    })

    await expect(
      resolveStaffNotificationRecipient({
        salonId: 'salon-a',
        staffId: 'user-1',
      }),
    ).resolves.toBeNull()
  })

  it('resolves claim-path recipient when no access row and revokedAt is not set', async () => {
    const selectBuilders = [
      selectChain([]),
      selectChain(
        [
          {
            userId: 'user-1',
            salonId: 'salon-a',
            staffProfileId: 'profile-a',
            profileActive: true,
            salonName: 'سالن آفتاب',
          },
        ],
        { limit: true },
      ),
      selectChain([], { limit: true }),
    ]
    mocks.getDb.mockReturnValue({
      select: vi.fn(() => selectBuilders.shift()),
    })

    await expect(
      resolveStaffNotificationRecipient({
        salonId: 'salon-a',
        staffId: 'user-1',
      }),
    ).resolves.toEqual({
      userId: 'user-1',
      staffProfileId: 'profile-a',
      salonId: 'salon-a',
      salonName: 'سالن آفتاب',
    })
  })

  it('resolves from non-revoked Staff Profile Access without claim fallback', async () => {
    const accessRow = {
      userId: 'user-1',
      salonId: 'salon-a',
      staffProfileId: 'profile-a',
      profileActive: true,
      salonName: 'سالن آفتاب',
    }
    const selectBuilders = [selectChain([accessRow])]
    const select = vi.fn(() => selectBuilders.shift())
    mocks.getDb.mockReturnValue({ select })

    await expect(
      resolveStaffNotificationRecipient({
        salonId: 'salon-a',
        staffId: 'user-1',
      }),
    ).resolves.toEqual({
      userId: 'user-1',
      staffProfileId: 'profile-a',
      salonId: 'salon-a',
      salonName: 'سالن آفتاب',
    })
    expect(select).toHaveBeenCalledTimes(1)
  })
})
