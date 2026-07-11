import { describe, it, expect } from 'vitest'
import {
  appointmentIntervalsConflict,
  hasAppointmentConflict,
  detectScheduleOverlaps,
  isBlockingAppointmentStatus,
} from './appointment-conflict'

describe('isBlockingAppointmentStatus', () => {
  it('treats scheduled and confirmed as blocking', () => {
    expect(isBlockingAppointmentStatus('scheduled')).toBe(true)
    expect(isBlockingAppointmentStatus('confirmed')).toBe(true)
  })

  it('treats terminal / inactive statuses as non-blocking', () => {
    expect(isBlockingAppointmentStatus('completed')).toBe(false)
    expect(isBlockingAppointmentStatus('cancelled')).toBe(false)
    expect(isBlockingAppointmentStatus('no-show')).toBe(false)
  })
})

describe('appointmentIntervalsConflict', () => {
  it('returns true when ranges overlap', () => {
    expect(
      appointmentIntervalsConflict('09:00', '10:00', '09:30', '10:30'),
    ).toBe(true)
  })

  it('returns false when ranges are adjacent without overlap', () => {
    expect(
      appointmentIntervalsConflict('09:00', '10:00', '10:00', '11:00'),
    ).toBe(false)
  })
})

describe('hasAppointmentConflict', () => {
  it('ignores cancelled appointments', () => {
    const ok = hasAppointmentConflict(
      [
        {
          id: '1',
          staffId: 'a',
          date: '2026-01-01',
          startTime: '09:00',
          endTime: '10:00',
          status: 'cancelled',
        },
      ],
      'a',
      '2026-01-01',
      '09:30',
      '10:30',
    )
    expect(ok).toBe(false)
  })

  it('ignores completed appointments', () => {
    expect(
      hasAppointmentConflict(
        [
          {
            id: '1',
            staffId: 'a',
            date: '2026-01-01',
            startTime: '09:00',
            endTime: '10:00',
            status: 'completed',
          },
        ],
        'a',
        '2026-01-01',
        '09:30',
        '10:30',
      ),
    ).toBe(false)
  })

  it('detects conflict with scheduled appointment', () => {
    const bad = hasAppointmentConflict(
      [
        {
          id: '1',
          staffId: 'a',
          date: '2026-01-01',
          startTime: '09:00',
          endTime: '10:00',
          status: 'scheduled',
        },
      ],
      'a',
      '2026-01-01',
      '09:30',
      '10:30',
    )
    expect(bad).toBe(true)
  })

  it('excludes current appointment id on edit', () => {
    expect(
      hasAppointmentConflict(
        [
          {
            id: 'self',
            staffId: 'a',
            date: '2026-01-01',
            startTime: '09:00',
            endTime: '10:00',
            status: 'scheduled',
          },
        ],
        'a',
        '2026-01-01',
        '09:00',
        '10:00',
        'self',
      ),
    ).toBe(false)
  })
})

describe('detectScheduleOverlaps', () => {
  const baseRow = {
    date: '2026-01-01',
    startTime: '09:00',
    endTime: '10:00',
    status: 'scheduled' as const,
  }

  it('allows different staff and different client', () => {
    const flags = detectScheduleOverlaps(
      [{ ...baseRow, id: '1', staffId: 's1', clientId: 'c1' }],
      {
        staffId: 's2',
        clientId: 'c2',
        date: '2026-01-01',
        startTime: '09:30',
        endTime: '10:30',
      },
    )
    expect(flags).toEqual({ staffConflict: false, clientConflict: false })
  })

  it('blocks same staff different client', () => {
    const flags = detectScheduleOverlaps(
      [{ ...baseRow, id: '1', staffId: 's1', clientId: 'c1' }],
      {
        staffId: 's1',
        clientId: 'c2',
        date: '2026-01-01',
        startTime: '09:30',
        endTime: '10:30',
      },
    )
    expect(flags.staffConflict).toBe(true)
    expect(flags.clientConflict).toBe(false)
  })

  it('blocks same client different staff', () => {
    const flags = detectScheduleOverlaps(
      [{ ...baseRow, id: '1', staffId: 's1', clientId: 'c1' }],
      {
        staffId: 's2',
        clientId: 'c1',
        date: '2026-01-01',
        startTime: '09:30',
        endTime: '10:30',
      },
    )
    expect(flags.staffConflict).toBe(false)
    expect(flags.clientConflict).toBe(true)
  })

  it('blocks same client and same staff', () => {
    const flags = detectScheduleOverlaps(
      [{ ...baseRow, id: '1', staffId: 's1', clientId: 'c1' }],
      {
        staffId: 's1',
        clientId: 'c1',
        date: '2026-01-01',
        startTime: '09:30',
        endTime: '10:30',
      },
    )
    expect(flags.staffConflict).toBe(true)
    expect(flags.clientConflict).toBe(true)
  })

  it('ignores cancelled overlapping rows', () => {
    const flags = detectScheduleOverlaps(
      [
        {
          ...baseRow,
          id: '1',
          staffId: 's1',
          clientId: 'c1',
          status: 'cancelled',
        },
      ],
      {
        staffId: 's1',
        clientId: 'c2',
        date: '2026-01-01',
        startTime: '09:30',
        endTime: '10:30',
      },
    )
    expect(flags).toEqual({ staffConflict: false, clientConflict: false })
  })

  it('respects excludeId', () => {
    const flags = detectScheduleOverlaps(
      [{ ...baseRow, id: 'self', staffId: 's1', clientId: 'c1' }],
      {
        staffId: 's1',
        clientId: 'c1',
        date: '2026-01-01',
        startTime: '09:00',
        endTime: '10:00',
        excludeId: 'self',
      },
    )
    expect(flags).toEqual({ staffConflict: false, clientConflict: false })
  })

  it('ignores overlapping rows from a different salon when tenant context is provided', () => {
    const flags = detectScheduleOverlaps(
      [
        {
          ...baseRow,
          id: 'other-salon',
          salonId: 'salon-b',
          staffId: 's1',
          clientId: 'c1',
        },
      ],
      {
        salonId: 'salon-a',
        staffId: 's1',
        clientId: 'c1',
        date: '2026-01-01',
        startTime: '09:30',
        endTime: '10:30',
      },
    )
    expect(flags).toEqual({ staffConflict: false, clientConflict: false })
  })
})
