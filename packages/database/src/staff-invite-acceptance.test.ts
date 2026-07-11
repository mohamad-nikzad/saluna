import { describe, expect, it } from 'vitest'
import {
  evaluateStaffInviteAcceptance,
  evaluateStaffInviteDecline,
} from './staff-invite-acceptance'

const now = new Date('2026-07-09T12:00:00Z')

const invite = {
  id: 'invite-1',
  salonId: 'salon-b',
  staffProfileId: 'profile-b',
  phone: '09121234567',
  status: 'pending' as const,
  expiresAt: new Date('2026-07-20T12:00:00Z'),
}

const identity = {
  userId: 'user-1',
  phoneNumber: '09121234567',
  username: '09121234567',
  verified: true,
}

describe('evaluateStaffInviteAcceptance', () => {
  it('accepts a pending invite for the verified matching phone', () => {
    expect(
      evaluateStaffInviteAcceptance({
        identity,
        invite,
        profile: {
          id: 'profile-b',
          salonId: 'salon-b',
          userId: null,
          active: true,
        },
        existingAccessForUserSalon: null,
        existingAccessForProfile: null,
        now,
      }),
    ).toEqual({ status: 'accept' })
  })

  it('rejects when the session phone does not match the invite phone', () => {
    expect(
      evaluateStaffInviteAcceptance({
        identity: {
          ...identity,
          phoneNumber: '09129876543',
          username: '09129876543',
        },
        invite,
        profile: {
          id: 'profile-b',
          salonId: 'salon-b',
          userId: null,
          active: true,
        },
        existingAccessForUserSalon: null,
        existingAccessForProfile: null,
        now,
      }),
    ).toEqual({ status: 'rejected', reason: 'phone_mismatch' })
  })

  it('rejects when the phone is not verified', () => {
    expect(
      evaluateStaffInviteAcceptance({
        identity: { ...identity, verified: false },
        invite,
        profile: {
          id: 'profile-b',
          salonId: 'salon-b',
          userId: null,
          active: true,
        },
        existingAccessForUserSalon: null,
        existingAccessForProfile: null,
        now,
      }),
    ).toEqual({ status: 'rejected', reason: 'phone_unverified' })
  })

  it('rejects when the invite is not pending', () => {
    expect(
      evaluateStaffInviteAcceptance({
        identity,
        invite: { ...invite, status: 'declined' },
        profile: {
          id: 'profile-b',
          salonId: 'salon-b',
          userId: null,
          active: true,
        },
        existingAccessForUserSalon: null,
        existingAccessForProfile: null,
        now,
      }),
    ).toEqual({ status: 'rejected', reason: 'invite_not_pending' })
  })

  it('rejects when the invite has expired', () => {
    expect(
      evaluateStaffInviteAcceptance({
        identity,
        invite: { ...invite, expiresAt: new Date('2026-07-01T12:00:00Z') },
        profile: {
          id: 'profile-b',
          salonId: 'salon-b',
          userId: null,
          active: true,
        },
        existingAccessForUserSalon: null,
        existingAccessForProfile: null,
        now,
      }),
    ).toEqual({ status: 'rejected', reason: 'invite_expired' })
  })

  it('rejects when the Staff Profile is inactive', () => {
    expect(
      evaluateStaffInviteAcceptance({
        identity,
        invite,
        profile: {
          id: 'profile-b',
          salonId: 'salon-b',
          userId: null,
          active: false,
        },
        existingAccessForUserSalon: null,
        existingAccessForProfile: null,
        now,
      }),
    ).toEqual({ status: 'rejected', reason: 'inactive_profile' })
  })

  it('rejects a second active Staff Profile Access in the same salon', () => {
    expect(
      evaluateStaffInviteAcceptance({
        identity,
        invite,
        profile: {
          id: 'profile-b',
          salonId: 'salon-b',
          userId: null,
          active: true,
        },
        existingAccessForUserSalon: {
          id: 'access-other',
          staffProfileId: 'profile-other',
        },
        existingAccessForProfile: null,
        now,
      }),
    ).toEqual({ status: 'rejected', reason: 'duplicate_salon_access' })
  })

  it('rejects when the Staff Profile already has an active accepted identity', () => {
    expect(
      evaluateStaffInviteAcceptance({
        identity,
        invite,
        profile: {
          id: 'profile-b',
          salonId: 'salon-b',
          userId: 'other-user',
          active: true,
        },
        existingAccessForUserSalon: null,
        existingAccessForProfile: {
          id: 'access-taken',
          userId: 'other-user',
        },
        now,
      }),
    ).toEqual({ status: 'rejected', reason: 'profile_already_accepted' })
  })

  it('allows accepting while the identity already has Staff Profile Access in another salon', () => {
    expect(
      evaluateStaffInviteAcceptance({
        identity,
        invite,
        profile: {
          id: 'profile-b',
          salonId: 'salon-b',
          userId: null,
          active: true,
        },
        existingAccessForUserSalon: null,
        existingAccessForProfile: null,
        now,
      }),
    ).toEqual({ status: 'accept' })
  })
})

describe('evaluateStaffInviteDecline', () => {
  it('declines a pending invite for the verified matching phone', () => {
    expect(
      evaluateStaffInviteDecline({
        identity,
        invite,
      }),
    ).toEqual({ status: 'decline' })
  })

  it('rejects decline for a different phone', () => {
    expect(
      evaluateStaffInviteDecline({
        identity: {
          ...identity,
          phoneNumber: '09129876543',
          username: '09129876543',
        },
        invite,
      }),
    ).toEqual({ status: 'rejected', reason: 'phone_mismatch' })
  })

  it('rejects decline when the invite is not pending', () => {
    expect(
      evaluateStaffInviteDecline({
        identity,
        invite: { ...invite, status: 'accepted' },
      }),
    ).toEqual({ status: 'rejected', reason: 'invite_not_pending' })
  })
})
