import { describe, expect, it } from 'vitest'
import { evaluateManagerStaffInvite } from './staff-invites'

const baseProfile = {
  id: 'profile-1',
  salonId: 'salon-1',
  userId: null as string | null,
  phone: '09121234567',
  active: true,
  accessDetachedAt: null as Date | null,
}

describe('evaluateManagerStaffInvite', () => {
  it('creates a new Staff Profile when the salon has no match for the phone', () => {
    expect(
      evaluateManagerStaffInvite({
        phone: '09121234567',
        existingProfile: null,
        pendingInvite: null,
        legacyMemberWithPhone: false,
      }),
    ).toEqual({ status: 'create_profile' })
  })

  it('reuses an active unclaimed Staff Profile without a pending invite', () => {
    expect(
      evaluateManagerStaffInvite({
        phone: '09121234567',
        existingProfile: baseProfile,
        pendingInvite: null,
        legacyMemberWithPhone: false,
      }),
    ).toEqual({ status: 'reuse_profile', profileId: 'profile-1' })
  })

  it('rejects inviting an inactive Staff Profile', () => {
    expect(
      evaluateManagerStaffInvite({
        phone: '09121234567',
        existingProfile: { ...baseProfile, active: false },
        pendingInvite: null,
        legacyMemberWithPhone: false,
      }),
    ).toEqual({ status: 'rejected', reason: 'inactive_profile' })
  })

  it('rejects a duplicate pending Staff Invite for the same phone', () => {
    expect(
      evaluateManagerStaffInvite({
        phone: '09121234567',
        existingProfile: baseProfile,
        pendingInvite: { id: 'invite-1', staffProfileId: 'profile-1' },
        legacyMemberWithPhone: false,
      }),
    ).toEqual({ status: 'rejected', reason: 'duplicate_pending_invite' })
  })

  it('rejects when an active Staff Profile already has accepted access', () => {
    expect(
      evaluateManagerStaffInvite({
        phone: '09121234567',
        existingProfile: { ...baseProfile, userId: 'user-1' },
        pendingInvite: null,
        legacyMemberWithPhone: false,
      }),
    ).toEqual({ status: 'rejected', reason: 'duplicate_active_profile' })
  })

  it('rejects when a legacy salon member already uses the phone', () => {
    expect(
      evaluateManagerStaffInvite({
        phone: '09121234567',
        existingProfile: null,
        pendingInvite: null,
        legacyMemberWithPhone: true,
      }),
    ).toEqual({ status: 'rejected', reason: 'duplicate_active_profile' })
  })
})
