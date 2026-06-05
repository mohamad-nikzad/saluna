import { describe, expect, it } from 'vitest'
import { sameAddonIds } from '@repo/salon-core/appointment-time'
import { addonLineValues, totalSnapshotFromServiceAndAddons } from './appointment-queries'
import type { ServiceAddon } from '@repo/salon-core/types'

describe('appointment update helpers', () => {
  it('treats add-on ids as unchanged regardless of order', () => {
    expect(sameAddonIds(['addon-b', 'addon-a'], ['addon-a', 'addon-b'])).toBe(true)
    expect(sameAddonIds(['addon-a'], ['addon-b'])).toBe(false)
  })
})

describe('appointment add-on snapshots', () => {
  it('copies selected add-on values into historical appointment lines', () => {
    const addon: ServiceAddon = {
      id: 'addon-1',
      salonId: 'salon-1',
      name: 'فرنچ',
      priceDelta: 50000,
      durationDelta: 15,
      active: true,
      sortOrder: 10,
      description: null,
      color: null,
      scopes: [],
      createdAt: new Date('2026-05-01T00:00:00Z'),
      updatedAt: new Date('2026-05-01T00:00:00Z'),
    }

    const [line] = addonLineValues({
      salonId: 'salon-1',
      appointmentId: 'appointment-1',
      addons: [addon],
    })

    addon.name = 'فرنچ ویژه'
    addon.priceDelta = 70000
    addon.durationDelta = 20

    expect(line).toMatchObject({
      serviceAddonId: 'addon-1',
      bookedAddonName: 'فرنچ',
      bookedAddonPriceDelta: 50000,
      bookedAddonDurationDelta: 15,
      sortOrder: 0,
    })
  })

  it('calculates booked totals from base service plus selected add-ons', () => {
    expect(
      totalSnapshotFromServiceAndAddons(
        { duration: 45, price: 300000 },
        [
          { durationDelta: 15, priceDelta: 50000 },
          { durationDelta: 0, priceDelta: 25000 },
        ]
      )
    ).toEqual({
      bookedTotalDuration: 60,
      bookedTotalPrice: 375000,
    })
  })
})
