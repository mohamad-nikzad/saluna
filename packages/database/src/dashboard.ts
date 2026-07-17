import { and, count, eq, gte, lte, ne, or, isNull, sql } from 'drizzle-orm'
import { normalizeCalendarColorId } from '@repo/salon-core/calendar-colors'
import { STAFF_COLORS } from '@repo/salon-core/types'
import { appointments, clients, member, salonMember, user } from './schema'
import { getDb } from './client'
import { getSalonFinancialSummary } from './internal/commission-queries'
import { getTodayData } from './internal/today-queries'

const DEFAULT_STAFF_COLOR = normalizeCalendarColorId(STAFF_COLORS[0])

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function weekBounds() {
  const now = new Date()
  const day = now.getDay()
  const diffToSat = day === 6 ? 0 : -(day + 1)
  const start = new Date(now)
  start.setDate(now.getDate() + diffToSat)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

function monthBounds() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

export async function getDashboardData(salonId: string) {
  const db = getDb()
  const today = todayStr()
  const week = weekBounds()
  const month = monthBounds()

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
          eq(appointments.date, today),
          ne(appointments.status, 'cancelled'),
        ),
      ),

    db
      .select({ value: count() })
      .from(appointments)
      .where(
        and(
          eq(appointments.salonId, salonId),
          gte(appointments.date, week.start),
          lte(appointments.date, week.end),
          ne(appointments.status, 'cancelled'),
        ),
      ),

    db
      .select({ value: count() })
      .from(appointments)
      .where(
        and(
          eq(appointments.salonId, salonId),
          gte(appointments.date, month.start),
          lte(appointments.date, month.end),
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
        and(eq(appointments.salonId, salonId), eq(appointments.date, today)),
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
          gte(appointments.date, month.start),
          lte(appointments.date, month.end),
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
          gte(appointments.date, month.start),
          lte(appointments.date, month.end),
          ne(appointments.status, 'cancelled'),
        ),
      )
      .groupBy(appointments.serviceId, appointments.bookedServiceName)
      .orderBy(sql`count(*) desc`)
      .limit(5),

    db
      .select({
        staffId: appointments.staffId,
        staffName: user.name,
        staffColor: salonMember.color,
        count: count(),
      })
      .from(appointments)
      .innerJoin(user, eq(appointments.staffId, user.id))
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
          gte(appointments.date, month.start),
          lte(appointments.date, month.end),
          ne(appointments.status, 'cancelled'),
        ),
      )
      .groupBy(appointments.staffId, user.name, salonMember.color)
      .orderBy(sql`count(*) desc`),

    getSalonFinancialSummary({
      salonId,
      startDate: month.start,
      endDate: month.end,
    }),

    db
      .select({ value: count() })
      .from(clients)
      .where(
        and(
          eq(clients.salonId, salonId),
          gte(clients.createdAt, new Date(month.start + 'T00:00:00')),
          lte(clients.createdAt, new Date(month.end + 'T23:59:59')),
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
    monthRevenue: monthFinancialSummary.grossAppointmentRevenue,
    monthSalonRetainedAmount: monthFinancialSummary.salonRetainedAmount,
    newClientsThisMonth: newClientsThisMonth[0]?.value ?? 0,
  }
}

export { getTodayData }
