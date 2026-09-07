import { describe, expect, it } from 'vitest'

import {
  EmptyAppointmentRosterError,
  assertValidAppointmentRoster,
  isValidAppointmentRoster,
  leadStaffId,
  orderedRoster,
} from './appointment-roster'

describe('Appointment roster invariants', () => {
  it('requires exactly one lead, unique staff, and allocations summing to 10000', () => {
    expect(
      isValidAppointmentRoster([
        { staffId: 'a', isLead: true, allocationBasisPoints: 5000 },
        { staffId: 'b', isLead: false, allocationBasisPoints: 5000 },
      ]),
    ).toBe(true)
    expect(isValidAppointmentRoster([])).toBe(false)
    expect(
      isValidAppointmentRoster([
        { staffId: 'a', isLead: true, allocationBasisPoints: 10000 },
        { staffId: 'b', isLead: true, allocationBasisPoints: 0 },
      ]),
    ).toBe(false)
    expect(
      isValidAppointmentRoster([
        { staffId: 'a', isLead: true, allocationBasisPoints: 5000 },
        { staffId: 'a', isLead: false, allocationBasisPoints: 5000 },
      ]),
    ).toBe(false)
    expect(
      isValidAppointmentRoster([
        { staffId: 'a', isLead: true, allocationBasisPoints: 6000 },
        { staffId: 'b', isLead: false, allocationBasisPoints: 3000 },
      ]),
    ).toBe(false)
  })

  it('hard-fails on empty roster and orders lead first', () => {
    expect(() => assertValidAppointmentRoster([])).toThrow(
      EmptyAppointmentRosterError,
    )
    expect(
      orderedRoster([
        { staffId: 'b', isLead: false, allocationBasisPoints: 4000 },
        { staffId: 'a', isLead: true, allocationBasisPoints: 6000 },
      ]),
    ).toEqual([
      { staffId: 'a', isLead: true, allocationBasisPoints: 6000 },
      { staffId: 'b', isLead: false, allocationBasisPoints: 4000 },
    ])
    expect(
      leadStaffId([
        { staffId: 'b', isLead: false, allocationBasisPoints: 4000 },
        { staffId: 'a', isLead: true, allocationBasisPoints: 6000 },
      ]),
    ).toBe('a')
  })
})
