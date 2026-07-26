import { and, asc, count, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import { addDaysYmd } from '@repo/salon-core/salon-local-time'
import { getDb } from '../client'
import { appointments, salonClosureDates } from '../schema'

type Db = ReturnType<typeof getDb>
type DbTransaction = Parameters<Parameters<Db['transaction']>[0]>[0]

const SALON_CLOSED_MESSAGE = 'این روز برای رزرو بسته است'

export class SalonClosedError extends Error {
  code = 'SALON_CLOSED' as const

  constructor() {
    super(SALON_CLOSED_MESSAGE)
    this.name = 'SalonClosedError'
  }
}

function datesBetween(startDate: string, endDate: string): string[] {
  const dates: string[] = []
  for (let date = startDate; date <= endDate; date = addDaysYmd(date, 1)) {
    dates.push(date)
  }
  return dates
}

async function lockSalonIntake(tx: DbTransaction, salonId: string) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${'salon-closure:' + salonId}))`,
  )
}

export async function assertSalonDateOpen(
  tx: DbTransaction,
  salonId: string,
  date: string,
) {
  await lockSalonIntake(tx, salonId)
  const [closed] = await tx
    .select({ date: salonClosureDates.date })
    .from(salonClosureDates)
    .where(
      and(
        eq(salonClosureDates.salonId, salonId),
        eq(salonClosureDates.date, date),
      ),
    )
    .limit(1)
  if (closed) throw new SalonClosedError()
}

export async function listSalonClosureDates(
  salonId: string,
  startDate?: string,
  endDate?: string,
) {
  return getDb()
    .select({ date: salonClosureDates.date })
    .from(salonClosureDates)
    .where(
      and(
        eq(salonClosureDates.salonId, salonId),
        startDate ? gte(salonClosureDates.date, startDate) : undefined,
        endDate ? lte(salonClosureDates.date, endDate) : undefined,
      ),
    )
    .orderBy(asc(salonClosureDates.date))
}

type CloseSalonDatesResult =
  | { ok: true; dates: string[] }
  | {
      ok: false
      appointmentCount: number
      appointmentsByDate: Array<{ date: string; count: number }>
    }

export async function closeSalonDates(input: {
  salonId: string
  startDate: string
  endDate: string
  confirmed: boolean
}): Promise<CloseSalonDatesResult> {
  const db = getDb()
  return db.transaction(async (tx) => {
    await lockSalonIntake(tx, input.salonId)
    const selectedDates = datesBetween(input.startDate, input.endDate)
    const existing = await tx
      .select({ date: salonClosureDates.date })
      .from(salonClosureDates)
      .where(
        and(
          eq(salonClosureDates.salonId, input.salonId),
          inArray(salonClosureDates.date, selectedDates),
        ),
      )
    const existingDates = new Set(existing.map((row) => row.date))
    const dates = selectedDates.filter((date) => !existingDates.has(date))
    if (dates.length === 0) return { ok: true, dates: [] }

    const appointmentsByDate = await tx
      .select({ date: appointments.date, count: count() })
      .from(appointments)
      .where(
        and(
          eq(appointments.salonId, input.salonId),
          inArray(appointments.date, dates),
          inArray(appointments.status, ['scheduled', 'confirmed']),
        ),
      )
      .groupBy(appointments.date)
      .orderBy(asc(appointments.date))
    const appointmentCount = appointmentsByDate.reduce(
      (total, row) => total + row.count,
      0,
    )
    if (appointmentCount > 0 && !input.confirmed) {
      return { ok: false, appointmentCount, appointmentsByDate }
    }

    await tx
      .insert(salonClosureDates)
      .values(dates.map((date) => ({ salonId: input.salonId, date })))
      .onConflictDoNothing()
    return { ok: true, dates }
  })
}

export async function reopenSalonDates(input: {
  salonId: string
  startDate: string
  endDate: string
}) {
  const rows = await getDb()
    .delete(salonClosureDates)
    .where(
      and(
        eq(salonClosureDates.salonId, input.salonId),
        gte(salonClosureDates.date, input.startDate),
        lte(salonClosureDates.date, input.endDate),
      ),
    )
    .returning({ date: salonClosureDates.date })
  return rows.map((row) => row.date)
}
