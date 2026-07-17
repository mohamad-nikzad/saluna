import { z } from '@hono/zod-openapi'

export const appointmentStatusSchema = z
  .enum(['scheduled', 'confirmed', 'completed', 'cancelled', 'no-show'])
  .openapi('AppointmentStatus')

export const statusCountSchema = z
  .object({
    status: appointmentStatusSchema,
    count: z.number(),
  })
  .openapi('AppointmentStatusCount')

export const popularServiceCountSchema = z
  .object({
    name: z.string(),
    count: z.number(),
  })
  .openapi('PopularServiceCount')

export const staffLoadItemSchema = z
  .object({
    name: z.string(),
    color: z.string(),
    count: z.number(),
  })
  .openapi('StaffLoadItem')

export const dashboardDataSchema = z
  .object({
    totalClients: z.number(),
    totalStaff: z.number(),
    todayAppointments: z.number(),
    weekAppointments: z.number(),
    monthAppointments: z.number(),
    todayStatusBreakdown: z.array(statusCountSchema),
    monthStatusBreakdown: z.array(statusCountSchema),
    popularServices: z.array(popularServiceCountSchema),
    staffLoad: z.array(staffLoadItemSchema),
    monthRevenue: z.number(),
    monthSalonRetainedAmount: z.number(),
    newClientsThisMonth: z.number(),
  })
  .openapi('DashboardData')
