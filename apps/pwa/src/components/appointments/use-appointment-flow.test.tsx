// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useAppointmentFlow } from './use-appointment-flow'

afterEach(() => vi.unstubAllGlobals())

describe('useAppointmentFlow', () => {
  it('starts a fresh form session for every create intent', () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    const { result } = renderHook(() =>
      useAppointmentFlow({
        defaultDate: '2026-07-13',
        defaultTime: '09:00',
      }),
    )

    act(() => result.current.actions.openCreate('2026-07-14', '10:30'))

    expect(result.current.state.createSession).toBe(1)
    expect(result.current.state.createIntent).toEqual({
      date: '2026-07-14',
      time: '10:30',
    })

    act(() => result.current.actions.handleCreateOpenChange(false))
    act(() => result.current.actions.openCreate('2026-07-14', '10:30'))

    expect(result.current.state.createSession).toBe(2)
  })

  it('preserves prefilled and availability intent values in a fresh session', () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    const { result } = renderHook(() => useAppointmentFlow())

    act(() =>
      result.current.actions.openCreateIntent({
        date: '2026-07-15',
        time: '11:00',
        staffId: 'staff-1',
        serviceId: 'service-1',
        clientId: 'client-1',
      }),
    )

    expect(result.current.state.createIntent).toEqual({
      date: '2026-07-15',
      time: '11:00',
      staffId: 'staff-1',
      serviceId: 'service-1',
      clientId: 'client-1',
    })
    expect(result.current.state.createSession).toBe(1)

    act(() =>
      result.current.actions.openCreateFromAvailability({
        slot: {
          date: '2026-07-16',
          startTime: '14:30',
          staffId: 'staff-2',
        },
        serviceId: 'service-2',
      }),
    )

    expect(result.current.state.createIntent).toEqual({
      date: '2026-07-16',
      time: '14:30',
      staffId: 'staff-2',
      serviceId: 'service-2',
    })
    expect(result.current.state.createSession).toBe(2)
    expect(result.current.state.createOpen).toBe(true)
  })
})
