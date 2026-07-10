import { describe, expect, it } from 'vitest'
import { evaluateStaffAccessRevocation } from './staff-access-revocation'

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
