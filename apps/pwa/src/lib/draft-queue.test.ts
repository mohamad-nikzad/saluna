import { describe, expect, it } from 'vitest'

import { organizeDrafts } from './draft-queue'

describe('manager Draft queue', () => {
  it('groups each Draft once by its earliest remaining date and orders ties oldest-first', () => {
    const drafts = [
      {
        id: 'newer',
        acceptableDates: ['2026-07-20', '2026-07-25', '2026-08-08'],
        createdAt: '2026-07-20T10:00:00Z',
      },
      {
        id: 'later',
        acceptableDates: ['2026-08-08'],
        createdAt: '2026-07-18T10:00:00Z',
      },
      {
        id: 'older',
        acceptableDates: ['2026-07-25'],
        createdAt: '2026-07-19T10:00:00Z',
      },
    ]

    expect(organizeDrafts(drafts, '2026-07-21')).toEqual([
      {
        id: 'next-week',
        drafts: [drafts[2], drafts[0]],
      },
      {
        id: 'later',
        drafts: [drafts[1]],
      },
    ])
    expect(drafts[0].acceptableDates).toEqual([
      '2026-07-20',
      '2026-07-25',
      '2026-08-08',
    ])
  })
})
