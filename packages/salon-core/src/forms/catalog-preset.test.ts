import { describe, expect, it } from 'vitest'

import {
  applyCatalogPresetBodySchema,
  normalizeCatalogPresetTree,
  presetTreeSchema,
} from './catalog-preset'

describe('catalog preset form schemas', () => {
  it('accepts flattened category and service preset trees', () => {
    expect(() =>
      presetTreeSchema.parse([
        {
          name: 'مو',
          services: [
            {
              name: 'کوتاهی مو',
              duration: 45,
              price: 450_000,
              color: 'coral',
            },
          ],
        },
      ]),
    ).not.toThrow()
  })

  it('does not accept family-shaped preset trees for new client flows', () => {
    expect(() =>
      presetTreeSchema.parse([
        {
          name: 'مو',
          families: [
            {
              name: 'کوتاهی',
              variants: [
                {
                  name: 'کوتاهی مو',
                  duration: 45,
                  price: 450_000,
                  color: 'coral',
                },
              ],
            },
          ],
        },
      ]),
    ).toThrow()
  })

  it('normalizes legacy stored family trees to flattened services', () => {
    expect(
      normalizeCatalogPresetTree([
        {
          name: 'مو',
          families: [
            {
              name: 'کوتاهی',
              variants: [
                {
                  name: 'کوتاهی مو',
                  duration: 45,
                  price: 450_000,
                  color: 'coral',
                },
              ],
            },
            {
              name: 'براشینگ',
              variants: [
                {
                  name: 'براشینگ مو',
                  duration: 45,
                  price: 500_000,
                  color: 'gold',
                },
              ],
            },
          ],
        },
      ]),
    ).toEqual([
      {
        name: 'مو',
        services: [
          { name: 'کوتاهی مو', duration: 45, price: 450_000, color: 'coral' },
          { name: 'براشینگ مو', duration: 45, price: 500_000, color: 'gold' },
        ],
      },
    ])
  })

  it('accepts service-index preset apply selections', () => {
    expect(() =>
      applyCatalogPresetBodySchema.parse({
        selection: [{ categoryIndex: 0, serviceIndices: [0, 1] }],
      }),
    ).not.toThrow()
  })
})
