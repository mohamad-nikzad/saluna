import { describe, it, expect } from 'vitest'

import {
  MANAGER_WRITE_OPERATIONS,
  MANAGER_WRITE_POLICIES,
  assertOnlineForWrite,
  getWritePolicy,
  OFFLINE_WRITE_BLOCKED_MESSAGE,
  writePolicyQueuesOffline,
  writePolicyRequiresOnline,
  writePolicyUsesDataClient,
} from './manager-write-policy'

describe('manager-write-policy', () => {
  it('defines a policy for every known operation', () => {
    for (const operation of MANAGER_WRITE_OPERATIONS) {
      expect(MANAGER_WRITE_POLICIES[operation]).toBeDefined()
    }
  })

  it('keeps appointment request approve/reject online-only (ADR)', () => {
    expect(getWritePolicy('appointmentRequest.approve')).toBe('require-online')
    expect(getWritePolicy('appointmentRequest.reject')).toBe('require-online')
    expect(writePolicyRequiresOnline('appointmentRequest.approve')).toBe(true)
    expect(writePolicyQueuesOffline('appointmentRequest.approve')).toBe(false)
  })

  it('queues manager appointment writes offline', () => {
    expect(getWritePolicy('appointment.update')).toBe('queue-offline')
    expect(getWritePolicy('appointment.updateStatus')).toBe('queue-offline')
    expect(writePolicyQueuesOffline('appointment.delete')).toBe(true)
  })

  it('requires online for staff today appointment status', () => {
    expect(getWritePolicy('staffToday.appointment.updateStatus')).toBe(
      'require-online',
    )
    expect(
      writePolicyUsesDataClient('staffToday.appointment.updateStatus'),
    ).toBe(false)
  })

  it('assertOnlineForWrite throws when require-online and offline', () => {
    expect(() =>
      assertOnlineForWrite('appointmentRequest.approve', false),
    ).toThrow(OFFLINE_WRITE_BLOCKED_MESSAGE)

    expect(() =>
      assertOnlineForWrite('staffToday.appointment.updateStatus', false),
    ).toThrow(OFFLINE_WRITE_BLOCKED_MESSAGE)
  })

  it('assertOnlineForWrite allows queue-offline when offline', () => {
    expect(() =>
      assertOnlineForWrite('appointment.update', false),
    ).not.toThrow()
  })

})
