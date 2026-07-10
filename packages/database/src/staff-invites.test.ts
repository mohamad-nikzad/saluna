import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  evaluateCancelManagerStaffInvite,
  evaluateManagerStaffInvite,
  evaluateResendManagerStaffInvite,
  evaluateStaffInviteLinkRouting,
  resolveStaffInvitePhonesMatch,
  STAFF_INVITE_TTL_MS,
} from './staff-invites'

const baseProfile = {
  id: 'profile-1',
  salonId: 'salon-1',
  userId: null as string | null,
  phone: '09121234567',
  active: true,
}

const now = new Date('2026-07-11T12:00:00Z')

const profileRow = {
  id: 'profile-1',
  salonId: 'salon-1',
  userId: null,
  name: 'Sara',
  phone: '09121234567',
  color: 'mint',
  active: true,
  claimedAt: null,
  accessDetachedAt: null,
  createdAt: now,
  updatedAt: now,
}

const pendingInviteRow = {
  id: 'invite-1',
  salonId: 'salon-1',
  staffProfileId: 'profile-1',
  phone: '09121234567',
  status: 'pending' as const,
  tokenHash: 'old-hash',
  invitedByUserId: 'manager-1',
  expiresAt: new Date('2026-07-20T12:00:00Z'),
  lastDeliveredAt: new Date('2026-07-01T12:00:00Z'),
  acceptedAt: null,
  declinedAt: null,
  revokedAt: null,
  expiredAt: null,
  createdAt: now,
  updatedAt: now,
}

describe('evaluateManagerStaffInvite', () => {
  it('creates a new Staff Profile when the salon has no match for the phone', () => {
    expect(
      evaluateManagerStaffInvite({
        existingProfile: null,
        pendingInvite: null,
        legacyMemberWithPhone: false,
      }),
    ).toEqual({ status: 'create_profile' })
  })

  it('reuses an active Staff Profile with no accepted access and no pending invite', () => {
    expect(
      evaluateManagerStaffInvite({
        existingProfile: baseProfile,
        pendingInvite: null,
        legacyMemberWithPhone: false,
      }),
    ).toEqual({ status: 'reuse_profile', profileId: 'profile-1' })
  })

  it('rejects inviting an inactive Staff Profile', () => {
    expect(
      evaluateManagerStaffInvite({
        existingProfile: { ...baseProfile, active: false },
        pendingInvite: null,
        legacyMemberWithPhone: false,
      }),
    ).toEqual({ status: 'rejected', reason: 'inactive_profile' })
  })

  it('rejects a duplicate pending Staff Invite for the same phone', () => {
    expect(
      evaluateManagerStaffInvite({
        existingProfile: baseProfile,
        pendingInvite: { id: 'invite-1', staffProfileId: 'profile-1' },
        legacyMemberWithPhone: false,
      }),
    ).toEqual({ status: 'rejected', reason: 'duplicate_pending_invite' })
  })

  it('rejects when an active Staff Profile already has accepted access', () => {
    expect(
      evaluateManagerStaffInvite({
        existingProfile: { ...baseProfile, userId: 'user-1' },
        pendingInvite: null,
        legacyMemberWithPhone: false,
      }),
    ).toEqual({ status: 'rejected', reason: 'duplicate_active_profile' })
  })

  it('rejects when a legacy salon member already uses the phone', () => {
    expect(
      evaluateManagerStaffInvite({
        existingProfile: null,
        pendingInvite: null,
        legacyMemberWithPhone: true,
      }),
    ).toEqual({ status: 'rejected', reason: 'duplicate_active_profile' })
  })
})

describe('evaluateCancelManagerStaffInvite', () => {
  it('revokes the pending invite without deleting the Staff Profile', () => {
    const decision = evaluateCancelManagerStaffInvite({
      profile: profileRow,
      pendingInvite: pendingInviteRow,
      now,
    })

    expect(decision).toEqual({
      status: 'cancel',
      profile: profileRow,
      inviteId: 'invite-1',
      patch: {
        status: 'revoked',
        revokedAt: now,
        updatedAt: now,
      },
    })
    // Profile is returned for the response; cancel never issues a profile delete.
    expect(decision.status === 'cancel' && decision.profile.id).toBe('profile-1')
  })

  it('rejects when the Staff Profile is missing', () => {
    expect(
      evaluateCancelManagerStaffInvite({
        profile: null,
        pendingInvite: pendingInviteRow,
        now,
      }),
    ).toEqual({ status: 'rejected', reason: 'invite_not_found' })
  })

  it('rejects when there is no pending invite', () => {
    expect(
      evaluateCancelManagerStaffInvite({
        profile: profileRow,
        pendingInvite: null,
        now,
      }),
    ).toEqual({ status: 'rejected', reason: 'invite_not_pending' })
  })
})

describe('evaluateResendManagerStaffInvite', () => {
  it('refreshes the same pending invite row without creating another profile', () => {
    const inviteToken = 'new-invite-token-value'
    const decision = evaluateResendManagerStaffInvite({
      profile: profileRow,
      pendingInvite: pendingInviteRow,
      inviteToken,
      now,
    })

    expect(decision).toMatchObject({
      status: 'resend',
      profile: profileRow,
      inviteId: 'invite-1',
      inviteToken,
      patch: {
        tokenHash: createHash('sha256').update(inviteToken).digest('hex'),
        expiresAt: new Date(now.getTime() + STAFF_INVITE_TTL_MS),
        lastDeliveredAt: now,
        updatedAt: now,
      },
    })
    // Same profile + same invite id — resend never inserts a duplicate profile.
    expect(decision.status === 'resend' && decision.inviteId).toBe(
      pendingInviteRow.id,
    )
    expect(decision.status === 'resend' && decision.profile.id).toBe(
      profileRow.id,
    )
  })

  it('rejects resend for an inactive Staff Profile', () => {
    expect(
      evaluateResendManagerStaffInvite({
        profile: { ...profileRow, active: false },
        pendingInvite: pendingInviteRow,
        inviteToken: 'token',
        now,
      }),
    ).toEqual({ status: 'rejected', reason: 'inactive_profile' })
  })

  it('rejects when there is no pending invite to resend', () => {
    expect(
      evaluateResendManagerStaffInvite({
        profile: profileRow,
        pendingInvite: null,
        inviteToken: 'token',
        now,
      }),
    ).toEqual({ status: 'rejected', reason: 'invite_not_pending' })
  })
})

describe('resolveStaffInvitePhonesMatch', () => {
  it('returns null when there is no session', () => {
    expect(
      resolveStaffInvitePhonesMatch({
        sessionPresent: false,
        sessionPhone: null,
        phoneVerified: false,
        invitePhone: '09121234567',
      }),
    ).toBeNull()
  })

  it('returns null when the invited phone is present but not yet verified', () => {
    expect(
      resolveStaffInvitePhonesMatch({
        sessionPresent: true,
        sessionPhone: '09121234567',
        phoneVerified: false,
        invitePhone: '09121234567',
      }),
    ).toBeNull()
  })

  it('returns false for a wrong phone even when unverified', () => {
    expect(
      resolveStaffInvitePhonesMatch({
        sessionPresent: true,
        sessionPhone: '09129876543',
        phoneVerified: false,
        invitePhone: '09121234567',
      }),
    ).toBe(false)
  })

  it('returns true only for a verified matching phone', () => {
    expect(
      resolveStaffInvitePhonesMatch({
        sessionPresent: true,
        sessionPhone: '09121234567',
        phoneVerified: true,
        invitePhone: '09121234567',
      }),
    ).toBe(true)
  })

  it('returns false for a verified wrong phone', () => {
    expect(
      resolveStaffInvitePhonesMatch({
        sessionPresent: true,
        sessionPhone: '09129876543',
        phoneVerified: true,
        invitePhone: '09121234567',
      }),
    ).toBe(false)
  })
})

describe('evaluateStaffInviteLinkRouting', () => {
  it('routes unauthenticated registered phones to login', () => {
    expect(
      evaluateStaffInviteLinkRouting({
        inviteStatus: 'pending',
        sessionPresent: false,
        phonesMatch: null,
        phoneRegistered: true,
      }),
    ).toEqual({ action: 'login' })
  })

  it('routes unauthenticated new phones to registration', () => {
    expect(
      evaluateStaffInviteLinkRouting({
        inviteStatus: 'pending',
        sessionPresent: false,
        phonesMatch: null,
        phoneRegistered: false,
      }),
    ).toEqual({ action: 'register' })
  })

  it('shows switch-account when the verified session phone does not match', () => {
    expect(
      evaluateStaffInviteLinkRouting({
        inviteStatus: 'pending',
        sessionPresent: true,
        phonesMatch: false,
        phoneRegistered: true,
      }),
    ).toEqual({ action: 'switch_account' })
  })

  it('routes unverified matching sessions to login/OTP instead of switch-account', () => {
    expect(
      evaluateStaffInviteLinkRouting({
        inviteStatus: 'pending',
        sessionPresent: true,
        phonesMatch: null,
        phoneRegistered: true,
      }),
    ).toEqual({ action: 'login' })
  })

  it('continues when the verified session phone matches the invite', () => {
    expect(
      evaluateStaffInviteLinkRouting({
        inviteStatus: 'pending',
        sessionPresent: true,
        phonesMatch: true,
        phoneRegistered: true,
      }),
    ).toEqual({ action: 'continue' })
  })

  it('blocks expired invite links without granting access', () => {
    expect(
      evaluateStaffInviteLinkRouting({
        inviteStatus: 'expired',
        sessionPresent: false,
        phonesMatch: null,
        phoneRegistered: true,
      }),
    ).toEqual({ action: 'unavailable', reason: 'expired' })
  })
})

describe('deliverStaffInvite SMS hook', () => {
  it('skips real SMS delivery without requiring a provider', async () => {
    const { deliverStaffInvite } = await import('./staff-invites')
    await expect(
      deliverStaffInvite({
        inviteId: '00000000-0000-4000-8000-000000000001',
        channel: 'sms',
        inviteToken: 'unused-in-v1',
      }),
    ).resolves.toEqual({ status: 'skipped', reason: 'sms_not_configured' })
  })
})
