import { describe, it, expect } from 'vitest'

import type {
  AppointmentWithDetails,
  TodayAttentionItem,
  TodayData,
  User,
} from '@repo/salon-core/types'

import {
  bookedServiceWithAddonCount,
  buildManagerTodayViewModel,
  buildStaffTodayViewModel,
  buildWeekStrip,
  firstNameOf,
  greetingForHour,
  groupAttentionItems,
  sortAppointments,
  summarizeNextOpenSlot,
} from './today-view-model'
import { personInitials } from '#/lib/roster-visuals'

function appt(
  overrides: Partial<AppointmentWithDetails> &
    Pick<AppointmentWithDetails, 'id' | 'date' | 'startTime' | 'endTime'>,
): AppointmentWithDetails {
  return {
    clientId: 'c1',
    staffId: 's1',
    serviceId: 'svc1',
    bookedServiceName: 'کوتاهی',
    bookedServiceDuration: 30,
    bookedServicePrice: 0,
    bookedTotalDuration: 30,
    bookedTotalPrice: 0,
    bookedAddonCount: 0,
    status: 'scheduled',
    createdAt: new Date(),
    updatedAt: new Date(),
    client: { id: 'c1', name: 'مشتری', phone: null, isPlaceholder: false, createdAt: new Date() },
    staff: { id: 's1', name: 'کارمند' } as User,
    service: { id: 'svc1' } as AppointmentWithDetails['service'],
    ...overrides,
  }
}

function attention(
  overrides: Partial<TodayAttentionItem> & Pick<TodayAttentionItem, 'id' | 'type' | 'priority'>,
): TodayAttentionItem {
  return {
    title: 'عنوان',
    detail: 'جزئیات',
    ...overrides,
  }
}

function todayData(overrides: Partial<TodayData>): TodayData {
  return {
    date: '2026-06-02',
    counts: {
      scheduled: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
      'no-show': 0,
    },
    appointments: [],
    attentionItems: [],
    staffLoad: [],
    openSlots: [],
    ...overrides,
  }
}

describe('sortAppointments', () => {
  it('sorts by date then start time without mutating the input', () => {
    const input = [
      appt({ id: 'b', date: '2026-06-02', startTime: '11:00', endTime: '11:30' }),
      appt({ id: 'a', date: '2026-06-02', startTime: '09:00', endTime: '09:30' }),
      appt({ id: 'c', date: '2026-06-01', startTime: '23:00', endTime: '23:30' }),
    ]
    const sorted = sortAppointments(input)
    expect(sorted.map((a) => a.id)).toEqual(['c', 'a', 'b'])
    expect(input.map((a) => a.id)).toEqual(['b', 'a', 'c'])
  })
})

describe('bookedServiceWithAddonCount', () => {
  it('returns the bare service name when there are no addons', () => {
    expect(
      bookedServiceWithAddonCount(
        appt({ id: '1', date: '2026-06-02', startTime: '09:00', endTime: '09:30' }),
      ),
    ).toBe('کوتاهی')
  })

  it('appends a persian-digit addon count', () => {
    expect(
      bookedServiceWithAddonCount(
        appt({
          id: '1',
          date: '2026-06-02',
          startTime: '09:00',
          endTime: '09:30',
          bookedAddonCount: 2,
        }),
      ),
    ).toBe('کوتاهی +۲')
  })
})

describe('summarizeNextOpenSlot', () => {
  it('describes the absence of a slot', () => {
    expect(summarizeNextOpenSlot(null)).toBe('بازه آزاد دیگری ندارد')
  })

  it('frames a slot that starts now', () => {
    expect(
      summarizeNextOpenSlot({
        dayLabel: 'امروز',
        startTime: '10:00',
        endTime: '11:00',
        startsNow: true,
        additionalRanges: 0,
      }),
    ).toBe('از الان تا ۱۱:۰۰')
  })

  it('mentions additional ranges when present', () => {
    expect(
      summarizeNextOpenSlot({
        dayLabel: 'فردا',
        startTime: '10:00',
        endTime: '11:00',
        startsNow: false,
        additionalRanges: 3,
      }),
    ).toBe('۱۰:۰۰ تا ۱۱:۰۰ · ۳ بازه دیگر')
  })
})

describe('groupAttentionItems', () => {
  it('merges items sharing a key, dedupes labels, and keeps the highest-priority copy', () => {
    const result = groupAttentionItems([
      attention({ id: '1', appointmentId: 'apt', type: 'soon', priority: 5, title: 'دیرتر' }),
      attention({ id: '2', appointmentId: 'apt', type: 'vip', priority: 1, title: 'زودتر' }),
      attention({ id: '3', appointmentId: 'apt', type: 'soon', priority: 9 }),
    ])
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('زودتر')
    expect(result[0].priority).toBe(1)
    expect(result[0].labels).toEqual(['نزدیک', 'VIP'])
  })

  it('sorts distinct groups by ascending priority', () => {
    const result = groupAttentionItems([
      attention({ id: 'a', type: 'soon', priority: 5 }),
      attention({ id: 'b', type: 'vip', priority: 2 }),
    ])
    expect(result.map((r) => r.id)).toEqual(['b', 'a'])
  })
})

describe('buildWeekStrip', () => {
  it('returns seven consecutive days starting on the Saturday of that week', () => {
    // 2026-06-02 is a Tuesday; the prior Saturday is 2026-05-30.
    const strip = buildWeekStrip('2026-06-02')
    expect(strip).toHaveLength(7)
    expect(strip[0].ymd).toBe('2026-05-30')
    expect(strip[6].ymd).toBe('2026-06-05')
    expect(strip.some((d) => d.ymd === '2026-06-02')).toBe(true)
  })
})

describe('greetingForHour', () => {
  it('maps hours to the matching greeting', () => {
    expect(greetingForHour(3)).toBe('شب بخیر')
    expect(greetingForHour(8)).toBe('صبح بخیر')
    expect(greetingForHour(14)).toBe('وقت بخیر')
    expect(greetingForHour(18)).toBe('عصر بخیر')
    expect(greetingForHour(22)).toBe('شب بخیر')
  })
})

describe('firstNameOf / personInitials', () => {
  it('takes the first whitespace-separated token', () => {
    expect(firstNameOf('علی رضایی')).toBe('علی')
    expect(firstNameOf('  ')).toBe('  ')
  })

  it('derives initials from up to two name parts', () => {
    expect(personInitials('')).toBe('؟')
    expect(personInitials('Sara')).toBe('Sa')
    expect(personInitials('Sara Ahmadi')).toBe('SA')
  })
})

describe('buildManagerTodayViewModel', () => {
  it('returns empty defaults when there is no data', () => {
    const vm = buildManagerTodayViewModel({ data: undefined, staff: [] })
    expect(vm.queue).toEqual([])
    expect(vm.totalAppointments).toBe(0)
    expect(vm.defaultCreateTime).toBe('09:00')
  })

  it('builds queue, counts, attention, and team rows from data', () => {
    const data = todayData({
      counts: {
        scheduled: 2,
        confirmed: 1,
        completed: 1,
        cancelled: 1,
        'no-show': 1,
      },
      appointments: [
        appt({ id: 'done', date: '2026-06-02', startTime: '08:00', endTime: '08:30', status: 'completed' }),
        appt({ id: 'cancelled', date: '2026-06-02', startTime: '09:00', endTime: '09:30', status: 'cancelled' }),
        appt({ id: 'noshow', date: '2026-06-02', startTime: '10:00', endTime: '10:30', status: 'no-show' }),
        appt({ id: 'active', date: '2026-06-02', startTime: '07:00', endTime: '07:30', status: 'confirmed' }),
      ],
      attentionItems: [attention({ id: 'x', type: 'vip', priority: 1 })],
      staffLoad: [
        { staffId: 's1', staffName: 'الف', appointmentCount: 2, bookedMinutes: 60 },
        { staffId: 'sX', staffName: 'ب', appointmentCount: 1, bookedMinutes: 30 },
      ],
      openSlots: [
        { staffId: 's1', staffName: 'الف', ranges: [{ startTime: '14:00', endTime: '15:00' }] },
        { staffId: 's2', staffName: 'ب', ranges: [{ startTime: '10:00', endTime: '11:00' }] },
      ],
    })
    const staff: User[] = [{ id: 's1', name: 'الف', color: 'rose' } as User]

    const vm = buildManagerTodayViewModel({ data, staff })

    // cancelled and no-show are excluded; remaining are sorted by start time.
    expect(vm.queue.map((a) => a.id)).toEqual(['active', 'done'])
    expect(vm.activeCount).toBe(1)
    expect(vm.totalAppointments).toBe(6)
    expect(vm.doneCount).toBe(1)
    expect(vm.droppedCount).toBe(2)
    expect(vm.attentionItems).toHaveLength(1)
    expect(vm.teamRows[0].color).toBe('rose')
    expect(vm.teamRows[1].color).toBeUndefined()
    // earliest open-slot start time across all staff.
    expect(vm.defaultCreateTime).toBe('10:00')
  })

  it('caps attention items at five', () => {
    const data = todayData({
      attentionItems: Array.from({ length: 8 }, (_, i) =>
        attention({ id: `a${i}`, type: 'soon', priority: i }),
      ),
    })
    expect(buildManagerTodayViewModel({ data, staff: [] }).attentionItems).toHaveLength(5)
  })
})

describe('buildStaffTodayViewModel', () => {
  it('selects the in-progress and upcoming appointments by clock time', () => {
    const data = todayData({
      appointments: [
        appt({ id: 'past', date: '2026-06-02', startTime: '08:00', endTime: '09:00', status: 'confirmed' }),
        appt({ id: 'now', date: '2026-06-02', startTime: '09:30', endTime: '10:30', status: 'confirmed' }),
        appt({ id: 'next', date: '2026-06-02', startTime: '11:00', endTime: '12:00', status: 'scheduled' }),
        appt({ id: 'done', date: '2026-06-02', startTime: '13:00', endTime: '14:00', status: 'completed' }),
      ],
    })

    const vm = buildStaffTodayViewModel({
      todayData: data,
      tomorrowData: undefined,
      clockHm: '10:00',
      tomorrowLoading: false,
    })

    expect(vm.currentAppointment?.id).toBe('now')
    expect(vm.nextAppointment?.id).toBe('next')
    expect(vm.todayAppointments).toHaveLength(4)
  })

  it('drops cancelled appointments from tomorrow', () => {
    const tomorrow = todayData({
      date: '2026-06-03',
      appointments: [
        appt({ id: 'keep', date: '2026-06-03', startTime: '09:00', endTime: '09:30' }),
        appt({ id: 'gone', date: '2026-06-03', startTime: '10:00', endTime: '10:30', status: 'cancelled' }),
      ],
    })
    const vm = buildStaffTodayViewModel({
      todayData: todayData({}),
      tomorrowData: tomorrow,
      clockHm: '08:00',
      tomorrowLoading: false,
    })
    expect(vm.tomorrowAppointments.map((a) => a.id)).toEqual(['keep'])
  })

  it('flags that tomorrow open slots are still loading', () => {
    const vm = buildStaffTodayViewModel({
      todayData: todayData({ openSlots: [] }),
      tomorrowData: undefined,
      clockHm: '20:00',
      tomorrowLoading: true,
    })
    expect(vm.nextOpenSlot).toBeNull()
    expect(vm.checkingTomorrowOpenSlots).toBe(true)
  })
})
