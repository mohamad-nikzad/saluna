import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createClientsBulk } from './client-queries'

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  insert: vi.fn(),
  existingPhones: [] as string[],
  insertedPhones: [] as string[],
  insertError: null as Error | null,
  lastInsertValues: null as Record<string, unknown> | null,
}))

vi.mock('../client', () => ({
  getDb: mocks.getDb,
}))

function setupDbMock() {
  mocks.getDb.mockReturnValue({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => {
          const phones = [...new Set([...mocks.existingPhones, ...mocks.insertedPhones])]
          return phones.map((phone) => ({ phone }))
        }),
      })),
    })),
    insert: mocks.insert.mockImplementation(() => ({
      values: vi.fn((values: Record<string, unknown>) => {
        mocks.lastInsertValues = values
        return {
          returning: vi.fn(async () => {
            if (mocks.insertError) throw mocks.insertError
            const phone = values.phone as string | null
            if (phone && (mocks.existingPhones.includes(phone) || mocks.insertedPhones.includes(phone))) {
              throw new Error('duplicate key value violates unique constraint')
            }
            if (phone) mocks.insertedPhones.push(phone)
            return [
              {
                id: `client-${mocks.insertedPhones.length}`,
                salonId: values.salonId,
                name: values.name,
                phone,
                isPlaceholder: values.isPlaceholder ?? false,
                notes: values.notes ?? null,
                createdAt: new Date('2026-06-09T10:00:00Z'),
              },
            ]
          }),
        }
      }),
    })),
  })
}

describe('createClientsBulk', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.existingPhones = []
    mocks.insertedPhones = []
    mocks.insertError = null
    mocks.lastInsertValues = null
    setupDbMock()
  })

  it('creates all valid clients when none exist', async () => {
    const result = await createClientsBulk('salon-1', [
      { name: 'مریم', phone: '09121111111' },
      { name: 'سارا', phone: '09122222222' },
    ])

    expect(result.created).toHaveLength(2)
    expect(result.skipped).toEqual([])
    expect(result.created.map((client) => client.phone)).toEqual(['09121111111', '09122222222'])
  })

  it('skips clients whose phone already exists in the salon', async () => {
    mocks.existingPhones = ['09121111111']

    const result = await createClientsBulk('salon-1', [
      { name: 'مریم', phone: '09121111111' },
      { name: 'سارا', phone: '09122222222' },
    ])

    expect(result.created).toHaveLength(1)
    expect(result.created[0]?.phone).toBe('09122222222')
    expect(result.skipped).toEqual([{ phone: '09121111111', reason: 'duplicate-phone' }])
  })

  it('skips invalid rows without blocking valid ones', async () => {
    const result = await createClientsBulk('salon-1', [
      { name: 'مریم', phone: '123' },
      { name: 'سارا', phone: '09122222222' },
    ])

    expect(result.created).toHaveLength(1)
    expect(result.created[0]?.phone).toBe('09122222222')
    expect(result.skipped).toEqual([{ phone: '123', reason: 'invalid' }])
  })

  it('pre-checks duplicates via batched existing-phone lookup before insert', async () => {
    mocks.existingPhones = ['09123333333']

    const result = await createClientsBulk('salon-1', [
      { name: 'رضا', phone: '09123333333' },
    ])

    expect(result.created).toHaveLength(0)
    expect(result.skipped).toEqual([{ phone: '09123333333', reason: 'duplicate-phone' }])
    expect(mocks.insert).not.toHaveBeenCalled()
  })

  it('skips duplicate-phone when insert races a concurrent create', async () => {
    mocks.insertError = new Error('duplicate key value violates unique constraint')

    const result = await createClientsBulk('salon-1', [
      { name: 'مینا', phone: '09124444444' },
    ])

    expect(result.created).toHaveLength(0)
    expect(result.skipped).toEqual([{ phone: '09124444444', reason: 'duplicate-phone' }])
  })

  it('skips later in-batch duplicates after the first row is created', async () => {
    const result = await createClientsBulk('salon-1', [
      { name: 'مریم', phone: '09125555555' },
      { name: 'مریم دوم', phone: '09125555555' },
    ])

    expect(result.created).toHaveLength(1)
    expect(result.skipped).toEqual([{ phone: '09125555555', reason: 'duplicate-phone' }])
  })
})
