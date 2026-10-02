import { describe, expect, it } from 'vitest'
import { formatCompactServiceLabel } from '@repo/salon-core/service-catalog'
import { attachAppointmentDetails } from './row-mappers'

const createdAt = new Date('2026-10-01T00:00:00Z')

describe('appointment service category', () => {
  it.each(['ناخن', 'مو', 'پوست', 'مژه و ابرو'])(
    'uses the catalog category %s in the calendar label',
    (categoryName) => {
      const appointment = attachAppointmentDetails({
        appointment: {
          id: 'appointment-1',
          salonId: 'salon-1',
          clientId: 'client-1',
          serviceId: 'service-1',
          date: '2026-10-01',
          startTime: '10:00',
          endTime: '10:30',
          bookedServiceName: 'ترمیم ناخن',
          bookedServiceDuration: 30,
          bookedServicePrice: 100,
          bookedTotalDuration: 30,
          bookedTotalPrice: 100,
          status: 'scheduled',
          notes: null,
          createdByUserId: null,
          commissionExcludedAt: null,
          createdAt,
          updatedAt: createdAt,
        },
        client: {
          id: 'client-1',
          salonId: 'salon-1',
          name: 'Client',
          phone: null,
          isPlaceholder: false,
          birthDate: null,
          acquisitionSource: null,
          notes: null,
          createdAt,
        },
        staff: null,
        preparedStaff: {
          id: 'staff-1',
          salonId: 'salon-1',
          name: 'Staff',
          phone: '09120000001',
          color: 'rose',
          createdAt,
        },
        service: {
          id: 'service-1',
          salonId: 'salon-1',
          categoryId: 'category-1',
          familyId: null,
          name: 'ترمیم ناخن',
          duration: 30,
          price: 100,
          color: 'rose',
          active: true,
          allowMultipleStaff: false,
          description: null,
          kind: 'standard',
          createdAt,
        },
        category: { id: 'category-1', name: categoryName },
        family: null,
      })

      expect(appointment.service.categoryName).toBe(categoryName)
      expect(formatCompactServiceLabel(appointment.service)).toBe(
        `${categoryName} / ترمیم ناخن`,
      )
    },
  )
})
