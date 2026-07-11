import type { Service, User } from './types'

function sortServices(a: Service, b: Service): number {
  const c = a.category.localeCompare(b.category)
  if (c !== 0) return c
  return a.name.localeCompare(b.name, 'fa')
}

/** Active services this staff member may perform (null restriction = all active). */
export function eligibleServicesForStaff(
  staffMember: User,
  activeServices: Service[],
): Service[] {
  const active = activeServices.filter((s) => s.active)
  if (staffMember.serviceIds == null) {
    return [...active].sort(sortServices)
  }
  const allowed = new Set(staffMember.serviceIds)
  return active.filter((s) => allowed.has(s.id)).sort(sortServices)
}

export type AutoPickServiceOptions = {
  /**
   * When true, staff has an explicit `serviceIds` list (not “all services”).
   * If they can do several categories, we still pick one service so the form is usable;
   * unrestricted staff keeps `false` to avoid arbitrary picks.
   */
  staffHasExplicitServiceList?: boolean
}

/** Prefer longer bookings (e.g. رنگ مو over کوتاهی مو), then name. */
function pickPreferredService(services: Service[]): Service {
  return [...services].sort((a, b) => {
    if (b.duration !== a.duration) return b.duration - a.duration
    return a.name.localeCompare(b.name, 'fa')
  })[0]
}

/**
 * Picks a service to pre-fill: one eligible; several same category → longest duration then name;
 * several mixed categories with explicit staff list → same preference across all eligible.
 */
export function autoPickServiceForStaff(
  eligible: Service[],
  options?: AutoPickServiceOptions,
): Service | null {
  if (eligible.length === 0) return null
  if (eligible.length === 1) return eligible[0]
  const firstCat = eligible[0].category
  if (eligible.every((s) => s.category === firstCat)) {
    return pickPreferredService(eligible)
  }
  if (options?.staffHasExplicitServiceList) {
    return pickPreferredService(eligible)
  }
  return null
}

export function eligibleStaffForService(
  allStaff: User[],
  serviceId: string,
): User[] {
  return allStaff.filter(
    (member) =>
      member.serviceIds == null || member.serviceIds.includes(serviceId),
  )
}

export function autoPickStaffForService(
  allStaff: User[],
  serviceId: string,
): User | null {
  const eligible = eligibleStaffForService(allStaff, serviceId)
  return eligible.length === 1 ? eligible[0] : null
}
