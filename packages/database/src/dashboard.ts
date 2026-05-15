import { and, count, eq, gte, lte, ne, sql } from 'drizzle-orm'
import { appointments, clients, users } from './schema'
import { getDb } from './client'
import { getTodayData } from './internal/today-queries'

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
    monthRevenue,
    newClientsThisMonth,
  ] = await Promise.all([
    db.select({ value: count() }).from(clients).where(eq(clients.salonId, salonId)),

    db
      .select({ value: count() })
      .from(users)
      .where(and(eq(users.salonId, salonId), eq(users.active, true))),

    db
      .select({ value: count() })
      .from(appointments)
      .where(
        and(
          eq(appointments.salonId, salonId),
          eq(appointments.date, today),
          ne(appointments.status, 'cancelled')
        )
      ),

    db
      .select({ value: count() })
      .from(appointments)
      .where(
        and(
          eq(appointments.salonId, salonId),
          gte(appointments.date, week.start),
          lte(appointments.date, week.end),
          ne(appointments.status, 'cancelled')
        )
      ),

    db
      .select({ value: count() })
      .from(appointments)
      .where(
        and(
          eq(appointments.salonId, salonId),
          gte(appointments.date, month.start),
          lte(appointments.date, month.end),
          ne(appointments.status, 'cancelled')
        )
      ),

    db
      .select({
        status: appointments.status,
        count: count(),
      })
      .from(appointments)
      .where(and(eq(appointments.salonId, salonId), eq(appointments.date, today)))
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
          lte(appointments.date, month.end)
        )
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
          ne(appointments.status, 'cancelled')
        )
      )
      .groupBy(appointments.serviceId, appointments.bookedServiceName)
      .orderBy(sql`count(*) desc`)
      .limit(5),

    db
      .select({
        staffId: appointments.staffId,
        staffName: users.name,
        staffColor: users.color,
        count: count(),
      })
      .from(appointments)
      .innerJoin(users, and(eq(appointments.staffId, users.id), eq(users.salonId, salonId)))
      .where(
        and(
          eq(appointments.salonId, salonId),
          gte(appointments.date, month.start),
          lte(appointments.date, month.end),
          ne(appointments.status, 'cancelled')
        )
      )
      .groupBy(appointments.staffId, users.name, users.color)
      .orderBy(sql`count(*) desc`),

    db
      .select({
        value: sql<number>`coalesce(sum(${appointments.bookedServicePrice}), 0)`,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.salonId, salonId),
          gte(appointments.date, month.start),
          lte(appointments.date, month.end),
          eq(appointments.status, 'completed')
        )
      ),

    db
      .select({ value: count() })
      .from(clients)
      .where(
        and(
          eq(clients.salonId, salonId),
          gte(clients.createdAt, new Date(month.start + 'T00:00:00')),
          lte(clients.createdAt, new Date(month.end + 'T23:59:59'))
        )
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
      color: row.staffColor,
      count: row.count,
    })),
    monthRevenue: Number(monthRevenue[0]?.value ?? 0),
    newClientsThisMonth: newClientsThisMonth[0]?.value ?? 0,
  }
}

export { getTodayData }
