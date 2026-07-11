import { describe, expect, it } from 'vitest'
import {
  autoPickServiceForStaff,
  autoPickStaffForService,
  eligibleServicesForStaff,
  eligibleStaffForService,
} from './staff-service-autofill'
import type { Service, User } from './types'

const baseUser = (over: Partial<User>): User => ({
  id: 'u1',
  salonId: 'salon-1',
  name: 'Test',
  role: 'staff',
  color: 'bg-staff-1',
  phone: '09120000000',
  createdAt: new Date(),
  ...over,
})

const svc = (
  over: Partial<Service> & Pick<Service, 'id' | 'name' | 'category'>,
): Service => ({
  duration: 45,
  price: 1,
  color: 'bg-staff-1',
  active: true,
  categoryId: 'cat-stub',
  familyId: null,
  ...over,
})

describe('eligibleServicesForStaff', () => {
  it('treats null serviceIds as all active services', () => {
    const member = baseUser({ serviceIds: null })
    const list = [
      svc({ id: 'a', name: 'A', category: 'hair', active: false }),
      svc({ id: 'b', name: 'B', category: 'nails' }),
    ]
    const e = eligibleServicesForStaff(member, list)
    expect(e.map((s) => s.id)).toEqual(['b'])
  })

  it('filters by assigned ids', () => {
    const member = baseUser({ serviceIds: ['x'] })
    const list = [
      svc({ id: 'x', name: 'X', category: 'hair' }),
      svc({ id: 'y', name: 'Y', category: 'hair' }),
    ]
    expect(eligibleServicesForStaff(member, list).map((s) => s.id)).toEqual([
      'x',
    ])
  })

  it('treats an empty explicit service list as no eligible services', () => {
    const member = baseUser({ serviceIds: [] })
    const list = [svc({ id: 'x', name: 'X', category: 'hair' })]
    expect(eligibleServicesForStaff(member, list)).toEqual([])
  })
})

describe('autoPickServiceForStaff', () => {
  it('returns the only service', () => {
    const one = [svc({ id: '1', name: 'یک', category: 'nails' })]
    expect(autoPickServiceForStaff(one)?.id).toBe('1')
  })

  it('returns longest duration when all same category', () => {
    const two = [
      svc({ id: 'a', name: 'آلفا', category: 'hair', duration: 30 }),
      svc({ id: 'b', name: 'بتا', category: 'hair', duration: 90 }),
    ]
    const picked = autoPickServiceForStaff(two)
    expect(picked?.category).toBe('hair')
    expect(picked?.id).toBe('b')
  })

  it('returns null when multiple categories and staff is unrestricted', () => {
    const mixed = [
      svc({ id: 'a', name: 'A', category: 'hair' }),
      svc({ id: 'b', name: 'B', category: 'nails' }),
    ]
    expect(autoPickServiceForStaff(mixed)).toBeNull()
  })

  it('returns longest duration when mixed categories and explicit staff list', () => {
    const mixed = [
      svc({ id: 'a', name: 'A', category: 'hair', duration: 45 }),
      svc({ id: 'b', name: 'B', category: 'nails', duration: 120 }),
    ]
    expect(
      autoPickServiceForStaff(mixed, { staffHasExplicitServiceList: true })?.id,
    ).toBe('b')
  })
})

describe('autoPickStaffForService', () => {
  it('returns sole eligible staff', () => {
    const staff: User[] = [
      baseUser({ id: '1', serviceIds: ['s1'] }),
      baseUser({ id: '2', serviceIds: ['s2'] }),
    ]
    const only = autoPickStaffForService(staff, 's1')
    expect(only?.id).toBe('1')
  })

  it('returns null when ambiguous', () => {
    const staff: User[] = [
      baseUser({ id: '1', serviceIds: null }),
      baseUser({ id: '2', serviceIds: null }),
    ]
    expect(autoPickStaffForService(staff, 's1')).toBeNull()
  })
})

describe('eligibleStaffForService', () => {
  it('includes unrestricted staff', () => {
    const staff: User[] = [
      baseUser({ id: '1', serviceIds: null }),
      baseUser({ id: '2', serviceIds: ['other'] }),
    ]
    const e = eligibleStaffForService(staff, 's1')
    expect(e.map((u) => u.id)).toEqual(['1'])
  })

  it('excludes staff with an empty explicit service list', () => {
    const staff: User[] = [
      baseUser({ id: '1', serviceIds: [] }),
      baseUser({ id: '2', serviceIds: ['s1'] }),
    ]
    const e = eligibleStaffForService(staff, 's1')
    expect(e.map((u) => u.id)).toEqual(['2'])
  })
})
