import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Service } from '@repo/salon-core/types'
import { addDaysYmd, salonTodayYmd } from '@repo/salon-core/salon-local-time'

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getAllServices: vi.fn(),
}))

vi.mock('../client', () => ({
  getDb: mocks.getDb,
}))

vi.mock('./service-queries', () => ({
  getAllServices: mocks.getAllServices,
}))

import {
  createAppointmentRequest,
  filterPublicBookableServices,
  getPublicAvailability,
  isPublicBookableService,
  isPublicSalonStatus,
} from './public-queries'

describe('public salon status gate', () => {
  it('keeps Setup Salons out of public salon, availability, and AppointmentRequest flows', () => {
    expect(isPublicSalonStatus('setup')).toBe(false)
    expect(isPublicSalonStatus('suspended')).toBe(false)
    expect(isPublicSalonStatus('archived')).toBe(false)
    expect(isPublicSalonStatus('active')).toBe(true)
  })
})

function service(
  overrides: Partial<Service> & Pick<Service, 'id' | 'name'>,
): Service {
  return {
    category: 'hair',
    categoryId: 'category-1',
    familyId: null,
    duration: 30,
    price: 100_000,
    color: 'bg-saluna-rose',
    active: true,
    kind: 'standard',
    ...overrides,
    id: overrides.id,
    name: overrides.name,
  }
}

function selectLimitBuilder<T>(rows: T[]) {
  const builder = {
    from: vi.fn(),
    leftJoin: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
  }
  builder.from.mockReturnValue(builder)
  builder.leftJoin.mockReturnValue(builder)
  builder.where.mockReturnValue(builder)
  builder.limit.mockResolvedValue(rows)
  return builder
}

function selectWhereBuilder<T>(rows: T[]) {
  const builder = {
    from: vi.fn(),
    where: vi.fn(),
  }
  builder.from.mockReturnValue(builder)
  builder.where.mockResolvedValue(rows)
  return builder
}

function setupPublicSalonDb(input?: {
  services?: Service[]
  visibilityRows?: Array<{ serviceId: string; visible: boolean }>
}) {
  const salonRow = {
    id: 'salon-1',
    slug: 'salon',
    name: 'Saluna',
    phone: null,
    address: null,
    mapGoogle: null,
    mapNeshan: null,
    mapBalad: null,
    socialInstagram: null,
    socialTelegram: null,
    socialWhatsapp: null,
    website: null,
    timezone: 'Asia/Tehran',
    locale: 'fa-IR',
    status: 'active',
  }
  const settingsRow = {
    enabled: true,
    bioText: null,
    themeId: 'rose',
    layoutId: 'agenda',
    appointmentRequestsEnabled: true,
  }
  const selectBuilders = [
    selectLimitBuilder([salonRow]),
    selectLimitBuilder([settingsRow]),
    selectWhereBuilder(input?.visibilityRows ?? []),
  ]
  const insertBuilder = {
    values: vi.fn(),
    returning: vi.fn(),
  }
  insertBuilder.values.mockReturnValue(insertBuilder)
  insertBuilder.returning.mockResolvedValue([
    {
      id: 'request-1',
      confirmationToken: '11111111-1111-1111-1111-111111111111',
    },
  ])
  const db = {
    select: vi.fn(() => selectBuilders.shift()),
    insert: vi.fn(() => insertBuilder),
  }
  mocks.getDb.mockReturnValue(db)
  mocks.getAllServices.mockResolvedValue(
    input?.services ?? [
      service({
        id: 'service-1',
        name: 'کوتاهی',
        duration: 45,
        price: 750_000,
      }),
    ],
  )
  return { db, insertBuilder }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('public booking service filter', () => {
  it('keeps only active public-visible normal ServiceVariants', () => {
    const visible = filterPublicBookableServices(
      [
        service({ id: 'hidden', name: 'Hidden' }),
        service({ id: 'combo', name: 'Legacy Combo', kind: 'combo' }),
        service({ id: 'inactive', name: 'Inactive', active: false }),
        service({ id: 'visible-b', name: 'براشینگ' }),
        service({ id: 'visible-a', name: 'اصلاح' }),
      ],
      [{ serviceId: 'hidden', visible: false }],
    )

    expect(visible.map((item) => item.id)).toEqual(['visible-a', 'visible-b'])
  })

  it('treats legacy combo rows as not publicly bookable even when active', () => {
    expect(isPublicBookableService({ active: true, kind: 'combo' })).toBe(false)
    expect(isPublicBookableService({ active: true, kind: 'standard' })).toBe(
      true,
    )
  })
})

describe('public appointment request creation', () => {
  it('snapshots the selected visible normal ServiceVariant at submit time', async () => {
    const { insertBuilder } = setupPublicSalonDb()
    const date = addDaysYmd(salonTodayYmd(), 1)

    const result = await createAppointmentRequest({
      slug: 'salon',
      serviceId: 'service-1',
      date,
      startTime: '10:00',
      customerName: 'سارا',
      customerPhone: '09121234567',
    })

    expect(result).toEqual({
      ok: true,
      id: 'request-1',
      confirmationToken: '11111111-1111-1111-1111-111111111111',
    })
    expect(insertBuilder.values).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceId: 'service-1',
        requestedDate: date,
        requestedStartTime: '10:00',
        requestedEndTime: '10:45',
        bookedServiceName: 'کوتاهی',
        bookedServiceDuration: 45,
        bookedServicePrice: 750_000,
      }),
    )
  })

  it('rejects legacy combo rows for public submit and availability', async () => {
    const services = [
      service({ id: 'service-1', name: 'کوتاهی' }),
      service({ id: 'combo-1', name: 'پکیج قدیمی', kind: 'combo' }),
    ]
    const date = addDaysYmd(salonTodayYmd(), 1)
    const { db } = setupPublicSalonDb({ services })

    const submit = await createAppointmentRequest({
      slug: 'salon',
      serviceId: 'combo-1',
      date,
      startTime: '10:00',
      customerName: 'سارا',
      customerPhone: '09121234567',
    })

    expect(submit).toEqual({
      ok: false,
      status: 404,
      error: 'خدمت یافت نشد',
    })
    expect(db.insert).not.toHaveBeenCalled()

    setupPublicSalonDb({ services })
    const availability = await getPublicAvailability({
      slug: 'salon',
      serviceId: 'combo-1',
      date,
      mode: 'day',
    })

    expect(availability).toEqual({
      ok: false,
      status: 404,
      error: 'خدمت یافت نشد',
    })
  })
})
