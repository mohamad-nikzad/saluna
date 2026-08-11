import {
  jalaliMonthLength,
  jalaliToGregorianStr,
  parseGregorianToJalali,
} from './jalali'
import { addDaysYmd, salonTodayYmd } from './salon-local-time'

export type CommissionPeriod = 'today' | 'week' | 'month' | 'custom'

export function percentageToBasisPoints(percentage: number): number {
  const basisPoints = Math.round(percentage * 100)
  if (
    !Number.isFinite(percentage) ||
    percentage <= 0 ||
    percentage > 100 ||
    Math.abs(percentage * 100 - basisPoints) > 1e-9
  ) {
    throw new Error(
      'percentage must be greater than 0, at most 100, and have at most two decimals',
    )
  }
  return basisPoints
}

export function commissionAmount(
  basis: number,
  percentageBasisPoints: number,
): number {
  return Number(
    (BigInt(basis) * BigInt(percentageBasisPoints) + 5_000n) / 10_000n,
  )
}

export function equalWorkAllocations(staffIds: readonly string[]) {
  if (staffIds.length === 0) return []
  const share = Math.floor(10_000 / staffIds.length)
  const remainder = 10_000 - share * staffIds.length
  return staffIds.map((staffId, index) => ({
    staffId,
    allocationBasisPoints: share + (index === 0 ? remainder : 0),
  }))
}

export function validateWorkAllocations(
  staffIds: readonly string[],
  allocations: readonly { staffId: string; allocationBasisPoints: number }[],
) {
  const ids = new Set(staffIds)
  return (
    ids.size === staffIds.length &&
    allocations.length === staffIds.length &&
    new Set(allocations.map((allocation) => allocation.staffId)).size ===
      allocations.length &&
    allocations.every(
      (allocation) =>
        ids.has(allocation.staffId) &&
        Number.isInteger(allocation.allocationBasisPoints) &&
        allocation.allocationBasisPoints >= 0 &&
        allocation.allocationBasisPoints <= 10_000,
    ) &&
    allocations.reduce(
      (sum, allocation) => sum + allocation.allocationBasisPoints,
      0,
    ) === 10_000
  )
}

export function allocateWorkBasis(
  appointmentTotal: number,
  allocations: readonly { allocationBasisPoints: number }[],
) {
  if (
    appointmentTotal < 0 ||
    allocations.length === 0 ||
    allocations.reduce(
      (sum, allocation) => sum + allocation.allocationBasisPoints,
      0,
    ) !== 10_000
  ) {
    throw new Error('work allocations must divide a non-negative total exactly')
  }
  const bases = allocations.map((allocation) =>
    Number(
      (BigInt(appointmentTotal) * BigInt(allocation.allocationBasisPoints)) /
        10_000n,
    ),
  )
  bases[0]! += appointmentTotal - bases.reduce((sum, basis) => sum + basis, 0)
  return bases
}

export function allocatePackagePrice(
  bookedPackagePrice: number,
  taskBookedPrices: readonly number[],
): number[] {
  const total = taskBookedPrices.reduce((sum, price) => sum + price, 0)
  if (bookedPackagePrice < 0 || taskBookedPrices.length === 0 || total <= 0) {
    throw new Error(
      'package allocation requires non-negative package price and positive task prices',
    )
  }

  const packagePrice = BigInt(bookedPackagePrice)
  const denominator = BigInt(total)
  const allocations = taskBookedPrices.map((price) =>
    Number((packagePrice * BigInt(price)) / denominator),
  )
  let remainder =
    bookedPackagePrice - allocations.reduce((sum, value) => sum + value, 0)
  for (let index = 0; remainder > 0; index++, remainder--) {
    allocations[index]++
  }
  return allocations
}

const YMD_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function validYmd(value: string | undefined): value is string {
  if (!value || !YMD_PATTERN.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.toISOString().slice(0, 10) === value
}

export function commissionPeriodRange(input: {
  period: CommissionPeriod
  startDate?: string
  endDate?: string
  now?: Date
}): { startDate: string; endDate: string } {
  const today = salonTodayYmd(input.now)
  if (input.period === 'today') return { startDate: today, endDate: today }

  if (input.period === 'week') {
    const day = new Date(`${today}T12:00:00Z`).getUTCDay()
    const startDate = addDaysYmd(today, -((day + 1) % 7))
    return { startDate, endDate: addDaysYmd(startDate, 6) }
  }

  if (input.period === 'month') {
    const { jy, jm } = parseGregorianToJalali(today)
    return {
      startDate: jalaliToGregorianStr(jy, jm, 1),
      endDate: jalaliToGregorianStr(jy, jm, jalaliMonthLength(jy, jm)),
    }
  }

  if (
    !validYmd(input.startDate) ||
    !validYmd(input.endDate) ||
    input.startDate > input.endDate
  ) {
    throw new Error('custom period requires a valid inclusive date range')
  }
  return { startDate: input.startDate, endDate: input.endDate }
}
