import { describe, expect, it } from 'vitest'
import { PERSIAN_STARTER_SERVICE_TEMPLATES } from './starter-service-templates'

describe('PERSIAN_STARTER_SERVICE_TEMPLATES', () => {
  it('includes the initial editable Persian catalog areas', () => {
    expect(
      PERSIAN_STARTER_SERVICE_TEMPLATES.map((template) => template.category),
    ).toEqual(['ناخن', 'مو', 'پوست', 'مژه', 'ابرو', 'آرایش دائم', 'اپیلاسیون'])
  })

  it('contains a common nail extension path', () => {
    const nails = PERSIAN_STARTER_SERVICE_TEMPLATES.find(
      (template) => template.category === 'ناخن',
    )

    expect(nails?.services).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'کاشت پودری',
          duration: 120,
          price: 0,
        }),
      ]),
    )
  })

  it('uses stable unique category and service names for idempotent imports', () => {
    const categories = new Set<string>()
    const serviceNames = new Set<string>()

    for (const category of PERSIAN_STARTER_SERVICE_TEMPLATES) {
      expect(categories.has(category.category)).toBe(false)
      categories.add(category.category)

      for (const service of category.services) {
        expect(serviceNames.has(service.name)).toBe(false)
        serviceNames.add(service.name)
        expect(service.duration).toBeGreaterThan(0)
        expect(service.price).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('does not define starter combo or package services', () => {
    for (const category of PERSIAN_STARTER_SERVICE_TEMPLATES) {
      for (const service of category.services) {
        expect(service).not.toHaveProperty('kind')
        expect(service.name).not.toContain('پکیج')
      }
    }
  })
})
