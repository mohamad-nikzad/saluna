import { describe, expect, it } from 'vitest'
import { evaluateStaffProfileClaim } from './setup-staff'

type ClaimInput = Parameters<typeof evaluateStaffProfileClaim>[0]

const profile = {
  id: 'profile-1',
  salonId: 'salon-1',
  userId: null,
  name: 'Sara',
  phone: '09121234567',
  active: true,
  claimedAt: null,
  accessDetachedAt: null,
  createdAt: new Date('2026-06-23T00:00:00Z'),
  updatedAt: new Date('2026-06-23T00:00:00Z'),
}

const base = {
  identity: {
    phoneNumber: '09121234567',
    username: '09121234567',
    verified: true,
  },
  phone: '09121234567',
  userId: 'user-1',
  matches: [profile],
  membershipSalonIds: [] as string[],
}

describe('Staff Profile claim decisions', () => {
  it('accepts one verified unclaimed match', () => {
    expect(evaluateStaffProfileClaim(base)).toMatchObject({
      status: 'candidate',
      profile: { id: 'profile-1' },
    })
  })

  it.each([
    [
      { ...base, identity: { ...base.identity, verified: false } },
      'phone_mismatch',
    ],
    [
      { ...base, matches: [profile, { ...profile, id: 'profile-2' }] },
      'ambiguous',
    ],
    [
      { ...base, matches: [{ ...profile, userId: 'other-user' }] },
      'already_claimed',
    ],
    [{ ...base, membershipSalonIds: ['other-salon'] }, 'ineligible'],
  ])('rejects unsafe claims', (input, reason) => {
    expect(evaluateStaffProfileClaim(input as ClaimInput)).toEqual({
      status: 'rejected',
      reason,
    })
  })

  it('retains the previous Staff Profile as the operational-history transfer source', () => {
    const source = {
      ...profile,
      id: 'profile-old',
      salonId: 'salon-old',
      userId: 'user-1',
      salonStatus: 'active' as const,
    }
    const target = { ...profile, salonStatus: 'setup' as const }

    expect(
      evaluateStaffProfileClaim({
        ...base,
        matches: [source, target],
        membershipSalonIds: ['salon-old'],
      }),
    ).toMatchObject({
      status: 'candidate',
      profile: { id: 'profile-1' },
      sourceProfile: { id: 'profile-old' },
    })
  })

  it('treats a completed transfer retry as idempotent', () => {
    expect(
      evaluateStaffProfileClaim({
        ...base,
        matches: [
          { ...profile, accessDetachedAt: new Date(), salonStatus: 'active' },
          {
            ...profile,
            id: 'profile-new',
            salonId: 'salon-new',
            userId: 'user-1',
            salonStatus: 'setup',
          },
        ],
        membershipSalonIds: ['salon-new'],
      }),
    ).toMatchObject({
      status: 'candidate',
      profile: { id: 'profile-new' },
    })
  })

  it('rejects a transfer that would preserve an unrelated concurrent membership', () => {
    expect(
      evaluateStaffProfileClaim({
        ...base,
        matches: [
          {
            ...profile,
            id: 'profile-old',
            salonId: 'salon-old',
            userId: 'user-1',
            salonStatus: 'active',
          },
          { ...profile, salonStatus: 'setup' },
        ],
        membershipSalonIds: ['salon-old', 'unrelated-salon'],
      }),
    ).toEqual({ status: 'rejected', reason: 'ineligible' })
  })
})
