import { describe, expect, it } from 'vitest'

import {
  staffCreateRequestSchema,
  staffCreateSchema,
  staffScheduleDaySchema,
  staffScheduleRequestSchema,
  staffScheduleSchema,
  staffServiceIdsSchema,
} from './staff'

describe('staffCreateSchema', () => {
  it('normalizes phone, trims name, defaults role to staff', () => {
    const result = staffCreateSchema.parse({
      name: '  نرگس کاظمی  ',
      phone: '۰۹۱۲۳۴۵۶۷۸۹',
    })
    expect(result.name).toBe('نرگس کاظمی')
    expect(result.phone).toBe('09123456789')
    expect(result.role).toBe('staff')
  })

  it('accepts manager role in the payload shape', () => {
    const result = staffCreateSchema.parse({
      name: 'م',
      phone: '09123456789',
      role: 'manager',
    })
    expect(result.role).toBe('manager')
  })

  it('rejects invalid phone', () => {
    const result = staffCreateSchema.safeParse({
      name: 'x',
      phone: '12',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty name', () => {
    const result = staffCreateSchema.safeParse({
      name: '   ',
      phone: '09123456789',
    })
    expect(result.success).toBe(false)
  })

  it('matches the API request schema', () => {
    const result = staffCreateRequestSchema.parse({
      name: 'نرگس',
      phone: '09123456789',
    })
    expect(result).toEqual({
      name: 'نرگس',
      phone: '09123456789',
      role: 'staff',
    })
  })
})

describe('staffScheduleDaySchema', () => {
  it('accepts an active row with end > start', () => {
    const result = staffScheduleDaySchema.parse({
      dayOfWeek: 6,
      active: true,
      workingStart: '09:00',
      workingEnd: '19:00',
    })
    expect(result.active).toBe(true)
  })

  it('rejects end <= start when active', () => {
    const result = staffScheduleDaySchema.safeParse({
      dayOfWeek: 6,
      active: true,
      workingStart: '19:00',
      workingEnd: '09:00',
    })
    expect(result.success).toBe(false)
  })

  it('allows end <= start when inactive', () => {
    const result = staffScheduleDaySchema.safeParse({
      dayOfWeek: 5,
      active: false,
      workingStart: '19:00',
      workingEnd: '09:00',
    })
    expect(result.success).toBe(true)
  })

  it('normalizes persian digits in times', () => {
    const result = staffScheduleDaySchema.parse({
      dayOfWeek: 0,
      active: true,
      workingStart: '۰۹:۰۰',
      workingEnd: '۱۹:۰۰',
    })
    expect(result.workingStart).toBe('09:00')
    expect(result.workingEnd).toBe('19:00')
  })

  it('rejects malformed time', () => {
    const result = staffScheduleDaySchema.safeParse({
      dayOfWeek: 0,
      active: true,
      workingStart: '9am',
      workingEnd: '19:00',
    })
    expect(result.success).toBe(false)
  })
})

describe('staffScheduleSchema', () => {
  it('parses a full week', () => {
    const rows = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
      dayOfWeek: day,
      active: day !== 5,
      workingStart: '09:00',
      workingEnd: '19:00',
    }))
    const result = staffScheduleSchema.parse(rows)
    expect(result).toHaveLength(7)
  })
})

describe('staffCreateRequestSchema', () => {
  it('accepts name and phone only (extra password field is ignored)', () => {
    const result = staffCreateRequestSchema.parse({
      name: 'Ali',
      phone: '09121234567',
      password: 'secret123',
      role: 'staff',
    })
    expect(result).toEqual({
      name: 'Ali',
      phone: '09121234567',
      role: 'staff',
    })
  })
})

describe('staff server schemas', () => {
  it('requires a non-empty schedule request', () => {
    expect(staffScheduleRequestSchema.safeParse({ schedule: [] }).success).toBe(
      false,
    )
  })

  it('normalizes empty staff service selections to unrestricted', () => {
    expect(
      staffServiceIdsSchema.parse({ serviceIds: [] }).serviceIds,
    ).toBeNull()
    expect(
      staffServiceIdsSchema.parse({ serviceIds: ['svc-1', 'svc-1', ' '] })
        .serviceIds,
    ).toEqual(['svc-1'])
  })
})
