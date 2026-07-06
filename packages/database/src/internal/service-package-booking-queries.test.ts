import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  appointments,
  servicePackageBookings,
  servicePackageTasks,
} from '../schema'
import { createServicePackageBooking } from './service-package-booking-queries'

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  transaction: vi.fn(),
  txInsert: vi.fn(),
  inserted: [] as Array<{ table: unknown; values: unknown }>,
  failTaskInsert: false,
  getServicePackageById: vi.fn(),
  getClientById: vi.fn(),
  getAllStaff: vi.fn(),
  staffMayPerformService: vi.fn(),
  checkStaffAvailabilityForAppointment: vi.fn(),
  getScheduleOverlapFlags: vi.fn(),
}))

vi.mock('../client', () => ({
  getDb: mocks.getDb,
}))

vi.mock('./service-package-queries', () => ({
  getServicePackageById: mocks.getServicePackageById,
}))

vi.mock('./client-queries', () => ({
  getClientById: mocks.getClientById,
}))

vi.mock('./staff-queries', () => ({
  checkStaffAvailabilityForAppointment:
    mocks.checkStaffAvailabilityForAppointment,
  getAllStaff: mocks.getAllStaff,
  staffMayPerformService: mocks.staffMayPerformService,
}))

vi.mock('./appointment-queries', () => ({
  getScheduleOverlapFlags: mocks.getScheduleOverlapFlags,
}))

const now = new Date('2026-07-02T10:00:00.000Z')

type InsertValues = Array<Record<string, unknown>>

const packageFixture = {
  id: 'pkg-1',
  salonId: 'salon-1',
  categoryId: null,
  name: 'Bride',
  description: null,
  color: null,
  active: true,
  priceOverride: null,
  sortOrder: 0,
  totalDuration: 90,
  componentPriceTotal: 600000,
  resolvedPrice: 600000,
  createdAt: now,
  updatedAt: now,
  components: [
    {
      id: 'component-1',
      salonId: 'salon-1',
      packageId: 'pkg-1',
      serviceId: 'service-1',
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
      service: {
        id: 'service-1',
        name: 'Hair',
        category: 'hair',
        categoryId: 'cat-1',
        duration: 60,
        price: 400000,
        color: 'rose',
        active: true,
        kind: 'standard',
      },
    },
    {
      id: 'component-2',
      salonId: 'salon-1',
      packageId: 'pkg-1',
      serviceId: 'service-2',
      sortOrder: 1,
      createdAt: now,
      updatedAt: now,
      service: {
        id: 'service-2',
        name: 'Makeup',
        category: 'hair',
        categoryId: 'cat-1',
        duration: 30,
        price: 200000,
        color: 'mint',
        active: true,
        kind: 'standard',
      },
    },
  ],
}

function setupDbMock() {
  const tx = {
    insert: mocks.txInsert.mockImplementation((table: unknown) => ({
      values: (values: unknown) => ({
        returning: async () => {
          mocks.inserted.push({ table, values })
          if (table === servicePackageBookings) {
            return [
              {
                id: 'booking-1',
                salonId: 'salon-1',
                packageId: 'pkg-1',
                clientId: 'client-1',
                leadStaffId: 'staff-1',
                date: '2026-07-02',
                bookedPackageName: 'Bride',
                bookedPackagePrice: 600000,
                status: 'scheduled',
                notes: null,
                createdByUserId: 'manager-1',
                createdAt: now,
                updatedAt: now,
              },
            ]
          }
          if (table === appointments) {
            return (values as InsertValues).map((value, index) => ({
              id: `appointment-${index + 1}`,
              createdAt: now,
              updatedAt: now,
              ...value,
            }))
          }
          if (table === servicePackageTasks) {
            if (mocks.failTaskInsert) throw new Error('task insert failed')
            return (values as InsertValues).map((value, index) => ({
              id: `task-${index + 1}`,
              createdAt: now,
              updatedAt: now,
              ...value,
            }))
          }
          return []
        },
      }),
    })),
  }
  mocks.transaction.mockImplementation(async (callback) => callback(tx))
  mocks.getDb.mockReturnValue({ transaction: mocks.transaction })
}

describe('createServicePackageBooking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.inserted = []
    mocks.failTaskInsert = false
    setupDbMock()
    mocks.getServicePackageById.mockResolvedValue(packageFixture)
    mocks.getClientById.mockResolvedValue({
      id: 'client-1',
      name: 'Client',
      phone: '09120000000',
      isPlaceholder: false,
      createdAt: now,
    })
    mocks.getAllStaff.mockResolvedValue([
      {
        id: 'staff-1',
        salonId: 'salon-1',
        role: 'staff',
        name: 'Staff One',
        color: 'rose',
        phone: '09120000001',
        createdAt: now,
      },
      {
        id: 'staff-2',
        salonId: 'salon-1',
        role: 'staff',
        name: 'Staff Two',
        color: 'mint',
        phone: '09120000002',
        createdAt: now,
      },
    ])
    mocks.staffMayPerformService.mockResolvedValue(true)
    mocks.checkStaffAvailabilityForAppointment.mockResolvedValue({ ok: true })
    mocks.getScheduleOverlapFlags.mockResolvedValue({
      staffConflict: false,
      clientConflict: false,
    })
  })

  it('creates one package booking, normal task appointments, and task links', async () => {
    const booking = await createServicePackageBooking({
      salonId: 'salon-1',
      packageId: 'pkg-1',
      clientId: 'client-1',
      date: '2026-07-02',
      createdByUserId: 'manager-1',
      tasks: [
        {
          packageComponentId: 'component-1',
          staffId: 'staff-1',
          startTime: '10:00',
          endTime: '11:00',
        },
        {
          packageComponentId: 'component-2',
          staffId: 'staff-2',
          startTime: '11:15',
          endTime: '11:45',
        },
      ],
    })

    expect(booking).toMatchObject({
      id: 'booking-1',
      bookedPackageName: 'Bride',
      bookedPackagePrice: 600000,
      leadStaffId: 'staff-1',
      tasks: [
        expect.objectContaining({
          packageComponentId: 'component-1',
          appointmentId: 'appointment-1',
          appointment: expect.objectContaining({
            bookedServiceName: 'Hair',
            bookedServicePrice: 400000,
            bookedAddonCount: 0,
          }),
        }),
        expect.objectContaining({
          packageComponentId: 'component-2',
          appointmentId: 'appointment-2',
        }),
      ],
    })
    expect(mocks.transaction).toHaveBeenCalledTimes(1)
    expect(mocks.inserted.map((entry) => entry.table)).toEqual([
      servicePackageBookings,
      appointments,
      servicePackageTasks,
    ])
    const appointmentValues = mocks.inserted.find(
      (entry) => entry.table === appointments,
    )?.values as InsertValues
    expect(appointmentValues).toEqual([
      expect.objectContaining({
        serviceId: 'service-1',
        bookedServiceName: 'Hair',
        bookedTotalDuration: 60,
        bookedTotalPrice: 400000,
      }),
      expect.objectContaining({
        serviceId: 'service-2',
        bookedServiceName: 'Makeup',
        bookedTotalDuration: 30,
        bookedTotalPrice: 200000,
      }),
    ])
  })

  it('rejects existing schedule conflicts before opening a transaction', async () => {
    mocks.getScheduleOverlapFlags.mockResolvedValueOnce({
      staffConflict: true,
      clientConflict: false,
    })

    await expect(
      createServicePackageBooking({
        salonId: 'salon-1',
        packageId: 'pkg-1',
        clientId: 'client-1',
        date: '2026-07-02',
        tasks: [
          {
            packageComponentId: 'component-1',
            staffId: 'staff-1',
            startTime: '10:00',
            endTime: '11:00',
          },
          {
            packageComponentId: 'component-2',
            staffId: 'staff-2',
            startTime: '11:15',
            endTime: '11:45',
          },
        ],
      }),
    ).rejects.toThrow('service package booking staff conflict')
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('rejects invalid component service capability before writes', async () => {
    mocks.staffMayPerformService.mockResolvedValueOnce(false)

    await expect(
      createServicePackageBooking({
        salonId: 'salon-1',
        packageId: 'pkg-1',
        clientId: 'client-1',
        date: '2026-07-02',
        tasks: [
          {
            packageComponentId: 'component-1',
            staffId: 'staff-1',
            startTime: '10:00',
            endTime: '11:00',
          },
          {
            packageComponentId: 'component-2',
            staffId: 'staff-2',
            startTime: '11:15',
            endTime: '11:45',
          },
        ],
      }),
    ).rejects.toThrow('service package booking staff cannot perform service')
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('keeps booking, appointments, and task links inside one transaction', async () => {
    mocks.failTaskInsert = true

    await expect(
      createServicePackageBooking({
        salonId: 'salon-1',
        packageId: 'pkg-1',
        clientId: 'client-1',
        date: '2026-07-02',
        tasks: [
          {
            packageComponentId: 'component-1',
            staffId: 'staff-1',
            startTime: '10:00',
            endTime: '11:00',
          },
          {
            packageComponentId: 'component-2',
            staffId: 'staff-2',
            startTime: '11:15',
            endTime: '11:45',
          },
        ],
      }),
    ).rejects.toThrow('task insert failed')

    expect(mocks.transaction).toHaveBeenCalledTimes(1)
    expect(mocks.inserted.map((entry) => entry.table)).toEqual([
      servicePackageBookings,
      appointments,
      servicePackageTasks,
    ])
  })
})
