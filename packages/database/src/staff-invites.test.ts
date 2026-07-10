import { describe, expect, it } from 'vitest'
import {
  evaluateManagerStaffInvite,
  evaluateStaffInviteLinkRouting,
} from './staff-invites'

const baseProfile = {
  id: 'profile-1',
  salonId: 'salon-1',
  userId: null as string | null,
  phone: '09121234567',
  active: true,
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

  it('shows switch-account when the session phone does not match', () => {
    expect(
      evaluateStaffInviteLinkRouting({
        inviteStatus: 'pending',
        sessionPresent: true,
        phonesMatch: false,
        phoneRegistered: true,
      }),
    ).toEqual({ action: 'switch_account' })
  })

  it('continues when the session phone matches the invite', () => {
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
