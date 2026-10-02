import { describe, expect, it } from 'vitest'

import {
  EmptyAppointmentRosterError,
  assertValidAppointmentRoster,
  orderedRoster,
} from '@repo/salon-core/appointment-roster'

/**
 * Seam contract tests: create/update persistence goes through
 * insertAppointmentRoster / replaceAppointmentRoster, which both
 * call orderedRoster + assertValidAppointmentRoster before SQL.
 */
describe('appointment roster seam contract', () => {
  it('accepts multi-staff create/update payloads with one lead and full allocations', () => {
    const roster = orderedRoster([
      { staffId: 'extra', isLead: false, allocationBasisPoints: 4000 },
      { staffId: 'lead', isLead: true, allocationBasisPoints: 6000 },
    ])
    expect(roster).toEqual([
      { staffId: 'lead', isLead: true, allocationBasisPoints: 6000 },
      { staffId: 'extra', isLead: false, allocationBasisPoints: 4000 },
    ])
    expect(() => assertValidAppointmentRoster(roster)).not.toThrow()
  })

  it('hard-fails empty roster before any SQL write', () => {
    expect(() => assertValidAppointmentRoster([])).toThrow(
      EmptyAppointmentRosterError,
    )
    expect(() => orderedRoster([])).toThrow(EmptyAppointmentRosterError)
  })
})
