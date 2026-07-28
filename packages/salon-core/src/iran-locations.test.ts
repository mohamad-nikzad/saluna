import { describe, expect, it } from 'vitest'

import {
  changeSalonLocation,
  getIranCities,
  IRAN_LOCATION_SNAPSHOT,
  IRAN_PROVINCES,
  normalizePersianSearch,
  persianSearchFilter,
} from './iran-locations'

describe('Iran location snapshot', () => {
  it('contains all provinces and cleaned city rows with source provenance', () => {
    const cities = IRAN_LOCATION_SNAPSHOT.provinces.flatMap(
      (province) => province.cities,
    )

    expect(IRAN_PROVINCES).toHaveLength(31)
    expect(IRAN_PROVINCES[0]).toBe('تهران')
    expect(cities).toHaveLength(341)
    expect(IRAN_LOCATION_SNAPSHOT.source.commit).toBe(
      'c0c2d4374521fdcfaa1f5dab6043784d699b447d',
    )
    expect(IRAN_LOCATION_SNAPSHOT.source.reference).toContain(
      'iran_cities_with_coordinates.json',
    )
    expect(
      cities.every(
        (city) =>
          typeof city.name === 'string' &&
          city.name.length > 0 &&
          !('id' in city) &&
          !('latitude' in city) &&
          !('longitude' in city),
      ),
    ).toBe(true)
    expect(
      IRAN_LOCATION_SNAPSHOT.provinces.every(
        (province) =>
          !('id' in province) &&
          !('center' in province) &&
          !('landlinePrefix' in province) &&
          !('carLicencePlates' in province),
      ),
    ).toBe(true)
    expect(cities.some((city) => /ي|ك/.test(city.name))).toBe(false)
    expect(IRAN_PROVINCES).toContain('چهارمحال و بختیاری')
    expect(getIranCities('تهران')).toContain('تهران')
  })

  it('returns only cities in the selected province', () => {
    expect(getIranCities('تهران')).toContain('تهران')
    expect(getIranCities('تهران')).not.toContain('شیراز')
    expect(getIranCities('ناشناخته')).toEqual([])
  })
})

describe('Salon location selection', () => {
  it('normalizes Arabic Persian variants for search', () => {
    expect(normalizePersianSearch('كيش')).toBe('کیش')
    expect(persianSearchFilter('کیش', 'كيش')).toBe(1)
  })

  it('clears dependent values when province or city changes', () => {
    const location = {
      province: 'تهران',
      city: 'تهران',
      neighborhood: 'ونک',
    }

    expect(changeSalonLocation(location, 'province', 'فارس')).toEqual({
      province: 'فارس',
      city: '',
      neighborhood: '',
    })
    expect(changeSalonLocation(location, 'city', 'ری')).toEqual({
      province: 'تهران',
      city: 'ری',
      neighborhood: '',
    })
    expect(
      changeSalonLocation(location, 'neighborhood', 'محله سفارشی'),
    ).toEqual({
      province: 'تهران',
      city: 'تهران',
      neighborhood: 'محله سفارشی',
    })
  })
})
