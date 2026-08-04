import { expect, it } from 'vitest'
import { phoneLookupVariants } from './phone'

it('includes legacy Iranian mobile formats in database lookups', () => {
  expect(phoneLookupVariants('09123456789')).toEqual([
    '09123456789',
    '9123456789',
    '989123456789',
  ])
})
