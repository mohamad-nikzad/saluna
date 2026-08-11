import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getSalonFinancialSummary: vi.fn(),
}))

vi.mock('./client', () => ({ getDb: mocks.getDb }))
vi.mock('./internal/commission-queries', () => ({
  getSalonFinancialSummary: mocks.getSalonFinancialSummary,
}))

import { getDashboardData } from './dashboard'

function emptyQuery() {
  const query = {
    from: () => query,
    leftJoin: () => query,
    innerJoin: () => query,
    where: () => query,
    groupBy: () => query,
    orderBy: () => query,
    limit: () => query,
    then: (resolve: (rows: never[]) => unknown) =>
      Promise.resolve([]).then(resolve),
  }
  return query
}

describe('dashboard date ranges', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-30T21:00:00.000Z'))
    mocks.getDb.mockReturnValue({ select: () => emptyQuery() })
    mocks.getSalonFinancialSummary.mockResolvedValue({
      grossAppointmentRevenue: 0,
      salonRetainedAmount: 0,
    })
  })

  it('uses the Tehran calendar month after local midnight', async () => {
    await getDashboardData('salon-1')

    expect(mocks.getSalonFinancialSummary).toHaveBeenCalledWith({
      salonId: 'salon-1',
      startDate: '2026-05-01',
      endDate: '2026-05-31',
    })
  })
})
