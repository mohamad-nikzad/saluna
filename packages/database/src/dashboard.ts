import { and, count, eq, gte, lt, lte, ne, or, isNull, sql } from 'drizzle-orm'
import { normalizeCalendarColorId } from '@repo/salon-core/calendar-colors'
import { reportingPeriodRange } from '@repo/salon-core/reporting-period'
import { salonLocalInclusiveRangeInstants } from '@repo/salon-core/salon-local-time'
import { STAFF_COLORS } from '@repo/salon-core/types'
import {
  appointmentStaffAssignments,
  appointments,
  clients,
  member,
  salonMember,
  user,
} from './schema'
import { getDb } from './client'
import { getSalonMoneyReport } from './internal/salon-money-report-queries'
import { getTodayData } from './internal/today-queries'

const DEFAULT_STAFF_COLOR = normalizeCalendarColorId(STAFF_COLORS[0])

export async function getDashboardData(salonId: string) {
  const db = getDb()
  const today = reportingPeriodRange({ period: 'today' })
  const week = reportingPeriodRange({ period: 'week' })
  const month = reportingPeriodRange({ period: 'month' })
  const newClientsCreatedAt = salonLocalInclusiveRangeInstants(month)

  const [
    clientCountResult,
    staffCountResult,
    todayAppointments,
    weekAppointments,
    monthAppointments,
    todayStatusBreakdown,
    monthStatusBreakdown,
    popularServices,
    staffLoad,
    monthFinancialSummary,
    newClientsThisMonth,
  ] = await Promise.all([
    db
      .select({ value: count() })
      .from(clients)
      .where(eq(clients.salonId, salonId)),

    db
      .select({ value: count() })
      .from(member)
      .leftJoin(
        salonMember,
        and(
          eq(salonMember.userId, member.userId),
          eq(salonMember.organizationId, salonId),
        ),
      )
      .where(
        and(
          eq(member.organizationId, salonId),
          or(isNull(salonMember.active), eq(salonMember.active, true)),
        ),
      ),

    db
      .select({ value: count() })
      .from(appointments)
      .where(
        and(
          eq(appointments.salonId, salonId),
          eq(appointments.date, today.startDate),
          ne(appointments.status, 'cancelled'),
        ),
      ),

    db
      .select({ value: count() })
      .from(appointments)
      .where(
        and(
          eq(appointments.salonId, salonId),
          gte(appointments.date, week.startDate),
          lte(appointments.date, week.endDate),
          ne(appointments.status, 'cancelled'),
        ),
      ),

    db
      .select({ value: count() })
      .from(appointments)
      .where(
        and(
          eq(appointments.salonId, salonId),
          gte(appointments.date, month.startDate),
          lte(appointments.date, month.endDate),
          ne(appointments.status, 'cancelled'),
        ),
      ),

    db
      .select({
        status: appointments.status,
        count: count(),
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.salonId, salonId),
          eq(appointments.date, today.startDate),
        ),
      )
      .groupBy(appointments.status),

    db
      .select({
        status: appointments.status,
        count: count(),
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.salonId, salonId),
          gte(appointments.date, month.startDate),
          lte(appointments.date, month.endDate),
        ),
      )
      .groupBy(appointments.status),

    db
      .select({
        serviceId: appointments.serviceId,
        serviceName: appointments.bookedServiceName,
        count: count(),
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.salonId, salonId),
          gte(appointments.date, month.startDate),
          lte(appointments.date, month.endDate),
          ne(appointments.status, 'cancelled'),
        ),
      )
      .groupBy(appointments.serviceId, appointments.bookedServiceName)
      .orderBy(sql`count(*) desc`)
      .limit(5),

    db
      .select({
        staffId: appointmentStaffAssignments.staffId,
        staffName: user.name,
        staffColor: salonMember.color,
        count: count(),
      })
      .from(appointments)
      .innerJoin(
        appointmentStaffAssignments,
        and(
          eq(appointmentStaffAssignments.appointmentId, appointments.id),
          eq(appointmentStaffAssignments.isLead, true),
        ),
      )
      .innerJoin(user, eq(appointmentStaffAssignments.staffId, user.id))
      .leftJoin(
        salonMember,
        and(
          eq(salonMember.userId, user.id),
          eq(salonMember.organizationId, salonId),
        ),
      )
      .where(
        and(
          eq(appointments.salonId, salonId),
          gte(appointments.date, month.startDate),
          lte(appointments.date, month.endDate),
          ne(appointments.status, 'cancelled'),
        ),
      )
      .groupBy(
        appointmentStaffAssignments.staffId,
        user.name,
        salonMember.color,
      )
      .orderBy(sql`count(*) desc`),

    getSalonMoneyReport({
      salonId,
      startDate: month.startDate,
      endDate: month.endDate,
    }),

    db
      .select({ value: count() })
      .from(clients)
      .where(
        and(
          eq(clients.salonId, salonId),
          gte(clients.createdAt, newClientsCreatedAt.start),
          lt(clients.createdAt, newClientsCreatedAt.endExclusive),
        ),
      ),
  ])

  return {
    totalClients: clientCountResult[0]?.value ?? 0,
    totalStaff: staffCountResult[0]?.value ?? 0,
    todayAppointments: todayAppointments[0]?.value ?? 0,
    weekAppointments: weekAppointments[0]?.value ?? 0,
    monthAppointments: monthAppointments[0]?.value ?? 0,
    todayStatusBreakdown: todayStatusBreakdown.map((row) => ({
      status: row.status,
      count: row.count,
    })),
    monthStatusBreakdown: monthStatusBreakdown.map((row) => ({
      status: row.status,
      count: row.count,
    })),
    popularServices: popularServices.map((row) => ({
      name: row.serviceName,
      count: row.count,
    })),
    staffLoad: staffLoad.map((row) => ({
      name: row.staffName,
      color: row.staffColor ?? DEFAULT_STAFF_COLOR,
      count: row.count,
    })),
    monthRevenue:
      monthFinancialSummary.ok
        ? monthFinancialSummary.report.summary.bookedTotal
        : 0,
    monthSalonRetainedAmount:
      monthFinancialSummary.ok
        ? monthFinancialSummary.report.summary.salonRetainedAmount
        : 0,
    newClientsThisMonth: newClientsThisMonth[0]?.value ?? 0,
  }
}

export { getTodayData }
