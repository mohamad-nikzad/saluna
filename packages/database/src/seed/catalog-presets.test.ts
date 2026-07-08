import { describe, expect, it } from 'vitest'

import { catalogPresetSeeds } from './catalog-presets'

describe('catalog preset seeds', () => {
  it('author starter presets as categories and services only', () => {
    for (const preset of catalogPresetSeeds) {
      for (const category of preset.tree) {
        expect('families' in category).toBe(false)
        expect(category.services.length).toBeGreaterThan(0)

        const serviceNames = new Set<string>()
        for (const service of category.services) {
          expect('variants' in service).toBe(false)
          expect(service.name).not.toMatch(/پکیج|package/i)
          expect(serviceNames.has(service.name)).toBe(false)
          serviceNames.add(service.name)
        }
      }
    }
  })
})
