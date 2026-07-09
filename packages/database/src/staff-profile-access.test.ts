import { describe, expect, it } from 'vitest'
import { evaluateStaffTenantAccess } from './staff-profile-access'

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
})
