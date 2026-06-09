import { afterEach, describe, expect, it, vi } from 'vitest'

import { pickDeviceContacts } from './device-contacts'

describe('pickDeviceContacts', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns null when user cancels or selects nothing', async () => {
    vi.stubGlobal('navigator', {
      contacts: {
        select: vi.fn().mockResolvedValue([]),
      },
    })

    await expect(pickDeviceContacts({ multiple: false })).resolves.toBeNull()
  })

  it('returns mapped rows on success', async () => {
    vi.stubGlobal('navigator', {
      contacts: {
        select: vi.fn().mockResolvedValue([
          { name: ['مریم احمدی'], tel: ['09123456789'] },
        ]),
      },
    })

    await expect(pickDeviceContacts({ multiple: false })).resolves.toEqual([
      { name: ['مریم احمدی'], tel: ['09123456789'] },
    ])
  })

  it('returns null when contacts API is unavailable', async () => {
    vi.stubGlobal('navigator', {})

    await expect(pickDeviceContacts({ multiple: true })).resolves.toBeNull()
  })

  it('returns null when select throws', async () => {
    vi.stubGlobal('navigator', {
      contacts: {
        select: vi.fn().mockRejectedValue(new Error('denied')),
      },
    })

    await expect(pickDeviceContacts({ multiple: false })).resolves.toBeNull()
  })
})
