import { describe, expect, it } from 'vitest'

import type { Client } from './types'
import {
  chooseDeviceContactPhone,
  collectDeviceContactPhones,
  composeDeviceContactName,
  findClientByCanonicalPhone,
  mapDeviceContactsToDrafts,
  resolveSingleDeviceContact,
} from './device-contacts'

function client(
  overrides: Partial<Client> & Pick<Client, 'id' | 'name'>,
): Client {
  return {
    phone: null,
    isPlaceholder: false,
    createdAt: new Date(),
    ...overrides,
  }
}

describe('composeDeviceContactName', () => {
  it('returns trimmed first name entry', () => {
    expect(composeDeviceContactName(['  مریم احمدی  '])).toBe('مریم احمدی')
  })

  it('returns empty string when name is missing or empty', () => {
    expect(composeDeviceContactName()).toBe('')
    expect(composeDeviceContactName([])).toBe('')
    expect(composeDeviceContactName(['   '])).toBe('')
  })
})

describe('chooseDeviceContactPhone', () => {
  it('returns canonical mobile for a single valid tel', () => {
    expect(chooseDeviceContactPhone(['09123456789'])).toBe('09123456789')
  })

  it('picks the first normalizable mobile when multiple tels are present', () => {
    expect(
      chooseDeviceContactPhone(['02112345678', '09123456789', '09121111111']),
    ).toBe('09123456789')
  })

  it('normalizes Persian digits and +98 prefix', () => {
    expect(chooseDeviceContactPhone(['۰۹۱۲۳۴۵۶۷۸۹'])).toBe('09123456789')
    expect(chooseDeviceContactPhone(['+989123456789'])).toBe('09123456789')
    expect(chooseDeviceContactPhone(['tel:+989123456789'])).toBe('09123456789')
  })

  it('returns null when tel is empty or missing', () => {
    expect(chooseDeviceContactPhone()).toBeNull()
    expect(chooseDeviceContactPhone([])).toBeNull()
    expect(chooseDeviceContactPhone([''])).toBeNull()
  })
})

describe('collectDeviceContactPhones', () => {
  it('returns deduped valid mobiles in order', () => {
    expect(
      collectDeviceContactPhones([
        '09121111111',
        '+989121111111',
        '09122222222',
      ]),
    ).toEqual(['09121111111', '09122222222'])
  })

  it('skips landlines and invalid numbers', () => {
    expect(
      collectDeviceContactPhones(['02112345678', '', '09123456789']),
    ).toEqual(['09123456789'])
  })

  it('returns empty array when tels are missing', () => {
    expect(collectDeviceContactPhones()).toEqual([])
    expect(collectDeviceContactPhones([])).toEqual([])
  })
})

describe('resolveSingleDeviceContact', () => {
  it('returns ready when exactly one valid phone', () => {
    expect(
      resolveSingleDeviceContact({
        name: ['مریم احمدی'],
        tel: ['09123456789'],
      }),
    ).toEqual({
      kind: 'ready',
      name: 'مریم احمدی',
      phone: '09123456789',
    })
  })

  it('returns ready when multiple tels but only one normalizes', () => {
    expect(
      resolveSingleDeviceContact({
        name: ['علی'],
        tel: ['02112345678', '09123456789'],
      }),
    ).toEqual({
      kind: 'ready',
      name: 'علی',
      phone: '09123456789',
    })
  })

  it('returns choose-phone when two or more distinct valid phones', () => {
    expect(
      resolveSingleDeviceContact({
        name: ['سارا'],
        tel: ['09121111111', '09122222222'],
      }),
    ).toEqual({
      kind: 'choose-phone',
      name: 'سارا',
      phones: ['09121111111', '09122222222'],
    })
  })

  it('dedupes equivalent phone formats into ready', () => {
    expect(
      resolveSingleDeviceContact({
        name: ['رضا'],
        tel: ['09123456789', '+989123456789'],
      }),
    ).toEqual({
      kind: 'ready',
      name: 'رضا',
      phone: '09123456789',
    })
  })

  it('returns invalid when no normalizable phone', () => {
    expect(
      resolveSingleDeviceContact({
        name: ['نادر'],
        tel: ['02112345678'],
      }),
    ).toEqual({
      kind: 'invalid',
      name: 'نادر',
    })
  })

  it('returns invalid with empty name when tel is missing', () => {
    expect(resolveSingleDeviceContact({ name: [], tel: [] })).toEqual({
      kind: 'invalid',
      name: '',
    })
  })
})

describe('findClientByCanonicalPhone', () => {
  const clients: Client[] = [
    client({ id: '1', name: 'مریم', phone: '09121111111' }),
    client({ id: '2', name: 'علی', phone: '09122222222' }),
    client({ id: '3', name: 'بدون شماره', phone: null }),
  ]

  it('finds client by canonical phone match', () => {
    expect(findClientByCanonicalPhone(clients, '09121111111')).toEqual(
      clients[0],
    )
  })

  it('matches alternate input formats via canonicalSalonPhone', () => {
    expect(findClientByCanonicalPhone(clients, '+989122222222')).toEqual(
      clients[1],
    )
  })

  it('returns undefined when no client matches', () => {
    expect(findClientByCanonicalPhone(clients, '09129999999')).toBeUndefined()
  })

  it('skips clients without phone', () => {
    expect(
      findClientByCanonicalPhone([clients[2]!], '09121111111'),
    ).toBeUndefined()
  })
})

describe('mapDeviceContactsToDrafts', () => {
  it('maps a single contact with name and valid mobile', () => {
    const [draft] = mapDeviceContactsToDrafts([
      { name: ['مریم احمدی'], tel: ['09123456789'] },
    ])

    expect(draft).toMatchObject({
      name: 'مریم احمدی',
      phone: '09123456789',
    })
    expect(draft?.localId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
  })

  it('returns phone null when tel is empty', () => {
    const [draft] = mapDeviceContactsToDrafts([{ name: ['مریم'], tel: [] }])

    expect(draft).toMatchObject({
      name: 'مریم',
      phone: null,
    })
  })

  it('returns empty name when name is missing', () => {
    const [draft] = mapDeviceContactsToDrafts([{ tel: ['09123456789'] }])

    expect(draft).toMatchObject({
      name: '',
      phone: '09123456789',
    })
  })

  it('maps multiple picker rows to drafts with unique localIds', () => {
    const drafts = mapDeviceContactsToDrafts([
      { name: ['علی'], tel: ['09121111111'] },
      { name: ['سارا'], tel: ['09122222222'] },
    ])

    expect(drafts).toHaveLength(2)
    expect(drafts[0]).toMatchObject({ name: 'علی', phone: '09121111111' })
    expect(drafts[1]).toMatchObject({ name: 'سارا', phone: '09122222222' })
    expect(drafts[0]?.localId).not.toBe(drafts[1]?.localId)
  })
})
