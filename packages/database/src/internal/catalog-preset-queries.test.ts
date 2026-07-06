import { describe, expect, it } from 'vitest'

import type { CatalogPresetTree } from '@repo/salon-core/forms/catalog-preset'

import { buildCatalogPresetImportPlan } from './catalog-preset-queries'

const presetTree = [
  {
    name: 'مو',
    services: [
      { name: 'کوتاهی مو', duration: 45, price: 450_000, color: 'coral' },
      { name: 'براشینگ مو', duration: 45, price: 500_000, color: 'gold' },
    ],
  },
  {
    name: 'ناخن',
    services: [
      { name: 'مانیکور', duration: 45, price: 450_000, color: 'rose' },
    ],
  },
] satisfies CatalogPresetTree

describe('catalog preset import planning', () => {
  it('builds a category and service-only import plan', () => {
    expect(
      buildCatalogPresetImportPlan(presetTree, [
        { categoryIndex: 0, serviceIndices: [1] },
        { categoryIndex: 1, serviceIndices: [0] },
      ]),
    ).toEqual([
      {
        name: 'مو',
        services: [
          { name: 'براشینگ مو', duration: 45, price: 500_000, color: 'gold' },
        ],
      },
      {
        name: 'ناخن',
        services: [
          { name: 'مانیکور', duration: 45, price: 450_000, color: 'rose' },
        ],
      },
    ])
  })

  it('ignores invalid and duplicate selected service indices', () => {
    expect(
      buildCatalogPresetImportPlan(presetTree, [
        { categoryIndex: 0, serviceIndices: [0, 0, 99] },
        { categoryIndex: 99, serviceIndices: [0] },
      ]),
    ).toEqual([
      {
        name: 'مو',
        services: [
          { name: 'کوتاهی مو', duration: 45, price: 450_000, color: 'coral' },
        ],
      },
    ])
  })

  it('rejects empty and duplicate service selections before import', () => {
    expect(() =>
      buildCatalogPresetImportPlan(presetTree, [
        { categoryIndex: 99, serviceIndices: [0] },
      ]),
    ).toThrow('catalog preset selection is empty')

    expect(() =>
      buildCatalogPresetImportPlan(
        [
          ...presetTree,
          {
            name: 'تکراری',
            services: [
              {
                name: 'کوتاهی مو',
                duration: 45,
                price: 450_000,
                color: 'coral',
              },
            ],
          },
        ],
        [
          { categoryIndex: 0, serviceIndices: [0] },
          { categoryIndex: 2, serviceIndices: [0] },
        ],
      ),
    ).toThrow('catalog preset selection contains duplicate services')
  })
})
