import { describe, expect, it } from 'vitest'
import {
  evaluateStaffNotificationRecipient,
  evaluateStaffTenantAccess,
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

  it('excludes revoked, pending, declined, and expired access (empty candidates)', () => {
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
