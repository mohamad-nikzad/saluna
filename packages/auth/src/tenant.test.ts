import { describe, expect, it } from 'vitest'

import {
  hasTenantPermission,
  staffAppointmentStaffIds,
  staffOwnsAppointment,
} from './tenant'

describe('tenant permissions', () => {
  it.each(['view_support_tickets', 'manage_support_tickets'] as const)(
    'allows managers to use %s',
    (permission) => {
      expect(hasTenantPermission('manager', permission)).toBe(true)
    },
  )

  it.each(['view_support_tickets', 'manage_support_tickets'] as const)(
    'denies staff access to %s',
    (permission) => {
      expect(hasTenantPermission('staff', permission)).toBe(false)
    },
  )
})

describe('staff appointment ownership', () => {
  it('matches the linked Staff Profile id', () => {
    expect(
      staffOwnsAppointment('profile-a', {
        userId: 'u1',
        staffProfileId: 'profile-a',
      }),
    ).toBe(true)
  })

  it('matches the legacy claimed user id used as staffId', () => {
    expect(
      staffOwnsAppointment('u1', {
        userId: 'u1',
        staffProfileId: 'profile-a',
      }),
    ).toBe(true)
  })

  it('rejects appointments for another Staff Profile', () => {
    expect(
      staffOwnsAppointment('profile-other', {
        userId: 'u1',
        staffProfileId: 'profile-a',
      }),
    ).toBe(false)
  })

  it('lists both user and Staff Profile ids for staff filters', () => {
    expect(
      staffAppointmentStaffIds({
        role: 'staff',
        userId: 'u1',
        staffProfileId: 'profile-a',
      }),
    ).toEqual(['u1', 'profile-a'])
  })

  it('returns undefined staff filter for managers', () => {
    expect(
      staffAppointmentStaffIds({
        role: 'manager',
        userId: 'u1',
        staffProfileId: undefined,
      }),
    ).toBeUndefined()
  })
})
