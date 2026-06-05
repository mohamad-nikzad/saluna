import { describe, expect, it } from 'vitest'

import {
  appointmentCreateSchema,
  appointmentFormSchema,
  appointmentUpdateSchema,
  availabilitySearchSchema,
  completePlaceholderClientSchema,
} from './appointment'

const base = {
  staffId: 'staff-1',
  serviceId: 'service-1',
  date: '2026-05-11',
  startTime: '۰۹:۳۰',
  endTime: '۱۰:۱۵',
  durationMinutes: '۴۵',
}

describe('appointmentCreateSchema', () => {
  it('normalizes times, duration, notes, and placeholder client text', () => {
    const result = appointmentCreateSchema.parse({
      ...base,
      placeholderClient: {
        name: '  دوست سارا  ',
        notes: '  شماره را بعداً می‌گیرم  ',
      },
      notes: '  رنگ قبلی حساسیت داشت  ',
    })

    expect(result).toMatchObject({
      staffId: 'staff-1',
      serviceId: 'service-1',
      date: '2026-05-11',
      startTime: '09:30',
      endTime: '10:15',
      durationMinutes: 45,
      notes: 'رنگ قبلی حساسیت داشت',
      placeholderClient: {
        name: 'دوست سارا',
        notes: 'شماره را بعداً می‌گیرم',
      },
    })
  })

  it('requires exactly one client source', () => {
    expect(appointmentCreateSchema.safeParse(base).success).toBe(false)
    expect(
      appointmentCreateSchema.safeParse({
        ...base,
        clientId: 'client-1',
        placeholderClient: { name: 'مهمان' },
      }).success,
    ).toBe(false)
  })

  it('rejects end before start and invalid dates', () => {
    expect(
      appointmentCreateSchema.safeParse({
        ...base,
        clientId: 'client-1',
        startTime: '11:00',
        endTime: '10:00',
      }).success,
    ).toBe(false)
    expect(
      appointmentCreateSchema.safeParse({
        ...base,
        clientId: 'client-1',
        date: '2026-02-31',
      }).success,
    ).toBe(false)
  })
})

describe('appointment server schemas', () => {
  it('normalizes update payloads without requiring every field', () => {
    const result = appointmentUpdateSchema.parse({
      status: 'confirmed',
      notes: '  آماده شد  ',
    })
    expect(result).toEqual({
      status: 'confirmed',
      notes: 'آماده شد',
    })
  })

  it('normalizes placeholder completion fields', () => {
    const result = completePlaceholderClientSchema.parse({
      name: '  سارا  ',
      phone: '۰۹۱۲۳۴۵۶۷۸۹',
      notes: '  پیگیری شود  ',
    })
    expect(result).toMatchObject({
      name: 'سارا',
      phone: '09123456789',
      notes: 'پیگیری شود',
    })
  })

  it('validates availability search inputs', () => {
    const result = availabilitySearchSchema.parse({
      serviceId: 'svc-1',
      date: '2026-05-11',
    })
    expect(result).toEqual({
      serviceId: 'svc-1',
      staffSelection: '__any__',
      date: '2026-05-11',
    })
  })
})

describe('appointmentFormSchema', () => {
  it('emits a clientId payload from regular form values', () => {
    const result = appointmentFormSchema.parse({
      ...base,
      useTemporaryClient: false,
      clientId: 'client-1',
      notes: '   ',
    })

    expect(result).toEqual({
      clientId: 'client-1',
      staffId: 'staff-1',
      serviceId: 'service-1',
      date: '2026-05-11',
      startTime: '09:30',
      endTime: '10:15',
      durationMinutes: 45,
      notes: undefined,
      id: undefined,
      placeholderClient: undefined,
    })
  })

  it('emits a placeholderClient payload from temporary-client form values', () => {
    const result = appointmentFormSchema.parse({
      ...base,
      useTemporaryClient: true,
      temporaryClientName: '  مهمان  ',
      temporaryClientNotes: '',
    })

    expect(result.clientId).toBeUndefined()
    expect(result.placeholderClient).toEqual({
      name: 'مهمان',
      notes: undefined,
    })
  })

  it('pins validation errors to the UI fields', () => {
    const result = appointmentFormSchema.safeParse({
      ...base,
      useTemporaryClient: true,
      temporaryClientName: '',
      staffId: '',
      serviceId: '',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join('.'))
      expect(paths).toContain('temporaryClientName')
      expect(paths).toContain('staffId')
      expect(paths).toContain('serviceId')
    }
  })

  it('rejects a cleared duration instead of falling back to the old value', () => {
    const result = appointmentFormSchema.safeParse({
      ...base,
      useTemporaryClient: false,
      clientId: 'client-1',
      durationMinutes: '',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(
        result.error.issues.map((issue) => issue.path.join('.')),
      ).toContain('durationMinutes')
    }
  })
})
