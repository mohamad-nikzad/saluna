import snapshot from './data/iran-locations.json'

export const IRAN_LOCATION_SNAPSHOT = snapshot

export type SalonLocation = {
  province: string
  city: string
  neighborhood: string
}

export const IRAN_PROVINCES = snapshot.provinces.map(({ name }) => name)

export function getIranCities(province: string): string[] {
  const cities =
    snapshot.provinces.find((item) => item.name === province)?.cities ?? []
  return [...new Set(cities.map(({ name }) => name))]
}

export function normalizePersianSearch(value: string): string {
  return value
    .normalize('NFKC')
    .replaceAll('ي', 'ی')
    .replaceAll('ك', 'ک')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('fa')
}

export function persianSearchFilter(value: string, search: string): number {
  return normalizePersianSearch(value).includes(normalizePersianSearch(search))
    ? 1
    : 0
}

export function changeSalonLocation(
  current: SalonLocation,
  field: keyof SalonLocation,
  value: string,
): SalonLocation {
  if (field === 'province') {
    return { province: value, city: '', neighborhood: '' }
  }
  if (field === 'city') {
    return { ...current, city: value, neighborhood: '' }
  }
  return { ...current, neighborhood: value }
}
