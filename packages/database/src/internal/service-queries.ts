import { and, asc, eq, inArray, ne, or } from 'drizzle-orm'
import { PERSIAN_STARTER_SERVICE_TEMPLATES } from '@repo/salon-core/starter-service-templates'
import type {
  ComboComponent,
  ComboComponentsSummary,
  Service,
  ServiceAddon,
  ServiceAddonScope,
  ServiceCategory,
  ServiceFamily,
} from '@repo/salon-core/types'
import { getDb } from '../client'
import {
  serviceAddonCategoryScopes,
  serviceAddonFamilyScopes,
  serviceAddons,
  serviceAddonScopes,
  serviceAddonServiceScopes,
  serviceCategories,
  serviceComboComponents,
  serviceFamilies,
  services,
} from '../schema'
import {
  joinedRowToService,
  rowToServiceCategory,
  rowToServiceFamily,
} from './row-mappers'
import { isClientProvidedEntityId } from './client-queries'
import { resolveServiceCategory } from './service-catalog-resolution'

type CreateCategoryInput = {
  id?: string
  salonId: string
  name: string
  active?: boolean
}

type UpdateCategoryInput = Partial<Pick<ServiceCategory, 'name' | 'active'>>

type CreateFamilyInput = {
  id?: string
  salonId: string
  categoryId: string
  name: string
  active?: boolean
}

type UpdateFamilyInput = Partial<
  Pick<ServiceFamily, 'categoryId' | 'name' | 'active'>
>

export {
  CatalogReferenceError,
  type CatalogReferenceErrorReason,
} from './service-catalog-resolution'

export type ServiceAddonScopeInput =
  | { type: 'all' }
  | { type: 'category'; categoryId: string }
  | { type: 'service'; serviceId: string }

type LegacyServiceAddonScopeInput =
  | ServiceAddonScopeInput
  | { type: 'family'; familyId: string }

type CreateServiceAddonInput = {
  id?: string
  salonId: string
  name: string
  priceDelta: number
  durationDelta: number
  active?: boolean
  sortOrder?: number
  description?: string | null
  color?: string | null
  scopes?: ServiceAddonScopeInput[]
}

type UpdateServiceAddonInput = Partial<
  Pick<
    ServiceAddon,
    | 'name'
    | 'priceDelta'
    | 'durationDelta'
    | 'active'
    | 'sortOrder'
    | 'description'
    | 'color'
  >
> & {
  scopes?: ServiceAddonScopeInput[]
}

export function normalizeServiceAddonName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('fa-IR')
}

export function validateServiceAddonDeltas(input: {
  priceDelta: number
  durationDelta: number
}) {
  if (input.priceDelta < 0 || input.durationDelta < 0) {
    throw new Error(
      'service add-on price and duration deltas must be non-negative',
    )
  }
  if (input.priceDelta === 0 && input.durationDelta === 0) {
    throw new Error('service add-on price or duration delta must be positive')
  }
}

export function normalizeServiceAddonScopes(
  scopes: LegacyServiceAddonScopeInput[],
  catalog: {
    families: Array<{ id: string; categoryId: string }>
    services: Array<{ id: string; categoryId: string; familyId: string | null }>
  },
): ServiceAddonScopeInput[] {
  if (scopes.some((scope) => scope.type === 'all')) {
    return [{ type: 'all' }]
  }
  const categoryIds = new Set(
    scopes
      .filter((scope) => scope.type === 'category')
      .map((scope) => scope.categoryId),
  )
  const familyCategory = new Map(
    catalog.families.map((family) => [family.id, family.categoryId]),
  )
  const serviceById = new Map(
    catalog.services.map((service) => [service.id, service]),
  )
  const familyIds = new Set(
    scopes
      .filter((scope) => scope.type === 'family')
      .map((scope) => scope.familyId)
      .filter(
        (familyId) => !categoryIds.has(familyCategory.get(familyId) ?? ''),
      ),
  )

  const seen = new Set<string>()
  const normalized: ServiceAddonScopeInput[] = []
  for (const scope of scopes) {
    if (scope.type === 'all') continue
    if (scope.type === 'category') {
      const key = `category:${scope.categoryId}`
      if (!seen.has(key)) {
        seen.add(key)
        normalized.push(scope)
      }
      continue
    }
    if (scope.type === 'family') {
      if (categoryIds.has(familyCategory.get(scope.familyId) ?? '')) continue
      for (const service of catalog.services) {
        if (service.familyId !== scope.familyId) continue
        const key = `service:${service.id}`
        if (!seen.has(key)) {
          seen.add(key)
          normalized.push({ type: 'service', serviceId: service.id })
        }
      }
      continue
    }
    const service = serviceById.get(scope.serviceId)
    if (service?.familyId && familyIds.has(service.familyId)) continue
    if (service && categoryIds.has(service.categoryId)) continue
    const key = `service:${scope.serviceId}`
    if (!seen.has(key)) {
      seen.add(key)
      normalized.push(scope)
    }
  }
  return normalized
}

export function validateComboComponentReplacement(input: {
  comboServiceId: string
  comboActive: boolean
  componentServiceIds: string[]
  foundComponents: Array<{ id: string; kind: Service['kind'] }>
}) {
  const { comboServiceId, comboActive, componentServiceIds, foundComponents } =
    input
  if (new Set(componentServiceIds).size !== componentServiceIds.length) {
    throw new Error('combo components cannot contain duplicates')
  }
  if (componentServiceIds.includes(comboServiceId)) {
    throw new Error('combo service cannot contain itself')
  }
  if (comboActive && componentServiceIds.length === 0) {
    throw new Error('active combo service must have at least one component')
  }
  if (foundComponents.length !== componentServiceIds.length) {
    throw new Error('combo component service not found')
  }
  if (foundComponents.some((row) => row.kind === 'combo')) {
    throw new Error('combo service cannot contain another combo service')
  }
}

async function countValidComboComponents(
  comboServiceId: string,
  salonId: string,
): Promise<number> {
  const db = getDb()
  const rows = await db
    .select({ id: serviceComboComponents.id })
    .from(serviceComboComponents)
    .innerJoin(
      services,
      and(
        eq(serviceComboComponents.componentServiceId, services.id),
        eq(services.salonId, salonId),
        eq(services.kind, 'standard'),
      ),
    )
    .where(
      and(
        eq(serviceComboComponents.salonId, salonId),
        eq(serviceComboComponents.comboServiceId, comboServiceId),
      ),
    )
  return rows.length
}

export async function validateActiveServiceIds(
  ids: string[],
  salonId: string,
): Promise<boolean> {
  if (ids.length === 0) return true
  const db = getDb()
  const rows = await db
    .select({ id: services.id })
    .from(services)
    .where(
      and(
        eq(services.salonId, salonId),
        eq(services.active, true),
        inArray(services.id, ids),
      ),
    )
  return rows.length === ids.length
}

export async function getAllServices(
  salonId: string,
  includeInactive = false,
): Promise<Service[]> {
  const db = getDb()
  const rows = includeInactive
    ? await db
        .select({
          service: services,
          family: {
            id: serviceFamilies.id,
            name: serviceFamilies.name,
          },
          category: {
            id: serviceCategories.id,
            name: serviceCategories.name,
          },
        })
        .from(services)
        .leftJoin(serviceFamilies, eq(services.familyId, serviceFamilies.id))
        .leftJoin(
          serviceCategories,
          eq(services.categoryId, serviceCategories.id),
        )
        .where(eq(services.salonId, salonId))
        .orderBy(
          asc(serviceCategories.name),
          asc(serviceFamilies.name),
          asc(services.name),
        )
    : await db
        .select({
          service: services,
          family: {
            id: serviceFamilies.id,
            name: serviceFamilies.name,
          },
          category: {
            id: serviceCategories.id,
            name: serviceCategories.name,
          },
        })
        .from(services)
        .leftJoin(serviceFamilies, eq(services.familyId, serviceFamilies.id))
        .leftJoin(
          serviceCategories,
          eq(services.categoryId, serviceCategories.id),
        )
        .where(and(eq(services.salonId, salonId), eq(services.active, true)))
        .orderBy(
          asc(serviceCategories.name),
          asc(serviceFamilies.name),
          asc(services.name),
        )
  return rows.map(joinedRowToService)
}

export async function getServiceById(
  id: string,
  salonId: string,
): Promise<Service | undefined> {
  const db = getDb()
  const rows = await db
    .select({
      service: services,
      family: {
        id: serviceFamilies.id,
        name: serviceFamilies.name,
      },
      category: {
        id: serviceCategories.id,
        name: serviceCategories.name,
      },
    })
    .from(services)
    .leftJoin(serviceFamilies, eq(services.familyId, serviceFamilies.id))
    .leftJoin(serviceCategories, eq(services.categoryId, serviceCategories.id))
    .where(and(eq(services.id, id), eq(services.salonId, salonId)))
    .limit(1)
  const row = rows[0]
  return row ? joinedRowToService(row) : undefined
}

export async function createService(
  input: Pick<Service, 'name' | 'duration' | 'price' | 'color'> & {
    id?: string
    salonId: string
    categoryId?: string | null
    active?: boolean
    description?: string | null
  },
): Promise<Service> {
  const db = getDb()
  const categoryId = await resolveServiceCategory(
    input.salonId,
    input.categoryId,
    null,
  )
  const values: typeof services.$inferInsert = {
    salonId: input.salonId,
    name: input.name,
    categoryId,
    duration: input.duration,
    price: input.price,
    color: input.color,
    active: input.active ?? true,
    description: input.description ?? null,
  }
  if (isClientProvidedEntityId(input.id)) {
    values.id = input.id
  }
  const [row] = await db.insert(services).values(values).returning()
  const service = await getServiceById(row.id, input.salonId)
  return (
    service ??
    joinedRowToService({ service: row, family: null, category: null })
  )
}

export async function updateService(
  id: string,
  salonId: string,
  data: Partial<
    Pick<
      Service,
      | 'name'
      | 'categoryId'
      | 'duration'
      | 'price'
      | 'color'
      | 'active'
      | 'description'
    >
  >,
): Promise<Service | undefined> {
  const db = getDb()
  const existing = await getServiceById(id, salonId)
  if (!existing) return undefined
  let nextCategoryId: string | undefined
  if (data.categoryId !== undefined) {
    nextCategoryId = await resolveServiceCategory(
      salonId,
      data.categoryId,
      null,
    )
  }
  const [row] = await db
    .update(services)
    .set({
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(nextCategoryId !== undefined ? { categoryId: nextCategoryId } : {}),
      ...(data.duration !== undefined ? { duration: data.duration } : {}),
      ...(data.price !== undefined ? { price: data.price } : {}),
      ...(data.color !== undefined ? { color: data.color } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
      ...(data.description !== undefined
        ? { description: data.description }
        : {}),
    })
    .where(and(eq(services.id, id), eq(services.salonId, salonId)))
    .returning()
  return row ? await getServiceById(row.id, salonId) : undefined
}

export async function getComboComponents(
  comboServiceId: string,
  salonId: string,
): Promise<ComboComponentsSummary | undefined> {
  const combo = await getServiceById(comboServiceId, salonId)
  if (!combo || combo.kind !== 'combo') return undefined

  const db = getDb()
  const rows = await db
    .select({
      component: serviceComboComponents,
      service: services,
      family: {
        id: serviceFamilies.id,
        name: serviceFamilies.name,
      },
      category: {
        id: serviceCategories.id,
        name: serviceCategories.name,
      },
    })
    .from(serviceComboComponents)
    .innerJoin(
      services,
      and(
        eq(serviceComboComponents.componentServiceId, services.id),
        eq(services.salonId, salonId),
      ),
    )
    .leftJoin(serviceFamilies, eq(services.familyId, serviceFamilies.id))
    .leftJoin(serviceCategories, eq(services.categoryId, serviceCategories.id))
    .where(
      and(
        eq(serviceComboComponents.salonId, salonId),
        eq(serviceComboComponents.comboServiceId, comboServiceId),
      ),
    )
    .orderBy(asc(serviceComboComponents.sortOrder), asc(services.name))

  const components: ComboComponent[] = rows.map((row) => ({
    id: row.component.id,
    salonId: row.component.salonId,
    comboServiceId: row.component.comboServiceId,
    componentServiceId: row.component.componentServiceId,
    sortOrder: row.component.sortOrder,
    service: joinedRowToService({
      service: row.service,
      family: row.family,
      category: row.category,
    }),
    createdAt: row.component.createdAt,
    updatedAt: row.component.updatedAt,
  }))

  return {
    comboServiceId,
    components,
    totalDuration: components.reduce(
      (sum, item) => sum + item.service.duration,
      0,
    ),
    totalPrice: components.reduce((sum, item) => sum + item.service.price, 0),
  }
}

export async function replaceComboComponents(
  comboServiceId: string,
  salonId: string,
  componentServiceIds: string[],
): Promise<ComboComponentsSummary> {
  const combo = await getServiceById(comboServiceId, salonId)
  if (!combo || combo.kind !== 'combo') {
    throw new Error('combo service not found')
  }

  const db = getDb()
  const componentRows =
    componentServiceIds.length === 0
      ? []
      : await db
          .select({ id: services.id, kind: services.kind })
          .from(services)
          .where(
            and(
              eq(services.salonId, salonId),
              inArray(services.id, componentServiceIds),
            ),
          )

  validateComboComponentReplacement({
    comboServiceId,
    comboActive: combo.active,
    componentServiceIds,
    foundComponents: componentRows,
  })

  await db.transaction(async (tx) => {
    await tx
      .delete(serviceComboComponents)
      .where(
        and(
          eq(serviceComboComponents.salonId, salonId),
          eq(serviceComboComponents.comboServiceId, comboServiceId),
        ),
      )

    if (componentServiceIds.length > 0) {
      await tx.insert(serviceComboComponents).values(
        componentServiceIds.map((componentServiceId, index) => ({
          salonId,
          comboServiceId,
          componentServiceId,
          sortOrder: index,
        })),
      )
    }
  })

  const summary = await getComboComponents(comboServiceId, salonId)
  if (!summary) throw new Error('combo service not found')
  return summary
}

export async function validateComboServiceIsBookable(
  serviceId: string,
  salonId: string,
): Promise<boolean> {
  const service = await getServiceById(serviceId, salonId)
  if (!service || service.kind !== 'combo' || !service.active) return true
  return (await countValidComboComponents(serviceId, salonId)) > 0
}

async function assertUniqueActiveAddonName(input: {
  salonId: string
  name: string
  excludeId?: string
}) {
  const db = getDb()
  const rows = await db
    .select({ id: serviceAddons.id, name: serviceAddons.name })
    .from(serviceAddons)
    .where(
      input.excludeId
        ? and(
            eq(serviceAddons.salonId, input.salonId),
            eq(serviceAddons.active, true),
            ne(serviceAddons.id, input.excludeId),
          )
        : and(
            eq(serviceAddons.salonId, input.salonId),
            eq(serviceAddons.active, true),
          ),
    )
  const normalized = normalizeServiceAddonName(input.name)
  if (rows.some((row) => normalizeServiceAddonName(row.name) === normalized)) {
    throw new Error('active service add-on name must be unique per salon')
  }
}

async function normalizeAndValidateAddonScopes(
  salonId: string,
  scopes: ServiceAddonScopeInput[],
): Promise<ServiceAddonScopeInput[]> {
  if (scopes.length === 0 || scopes.some((scope) => scope.type === 'all'))
    return [{ type: 'all' }]
  if (scopes.some((scope) => !['category', 'service'].includes(scope.type))) {
    throw new Error('service add-on scope not found')
  }
  const categoryIds = [
    ...new Set(
      scopes
        .filter((scope) => scope.type === 'category')
        .map((scope) => scope.categoryId),
    ),
  ]
  const serviceIds = [
    ...new Set(
      scopes
        .filter((scope) => scope.type === 'service')
        .map((scope) => scope.serviceId),
    ),
  ]

  const db = getDb()
  const categoryRows =
    categoryIds.length === 0
      ? []
      : await db
          .select({ id: serviceCategories.id })
          .from(serviceCategories)
          .where(
            and(
              eq(serviceCategories.salonId, salonId),
              inArray(serviceCategories.id, categoryIds),
            ),
          )
  if (categoryRows.length !== categoryIds.length) {
    throw new Error('service add-on category scope not found')
  }

  const serviceRows =
    serviceIds.length === 0
      ? []
      : await db
          .select({
            id: services.id,
            categoryId: services.categoryId,
            familyId: services.familyId,
          })
          .from(services)
          .where(
            and(
              eq(services.salonId, salonId),
              inArray(services.id, serviceIds),
            ),
          )
  if (serviceRows.length !== serviceIds.length) {
    throw new Error('service add-on service scope not found')
  }

  const serviceFamilyIds = [
    ...new Set(
      serviceRows
        .map((row) => row.familyId)
        .filter((id): id is string => id !== null),
    ),
  ]
  const serviceFamilyRows =
    serviceFamilyIds.length === 0
      ? []
      : await db
          .select({
            id: serviceFamilies.id,
            categoryId: serviceFamilies.categoryId,
          })
          .from(serviceFamilies)
          .where(
            and(
              eq(serviceFamilies.salonId, salonId),
              inArray(serviceFamilies.id, serviceFamilyIds),
            ),
          )
  return normalizeServiceAddonScopes(scopes, {
    families: [
      ...serviceFamilyRows,
    ],
    services: serviceRows,
  })
}

async function replaceAddonScopes(
  addonId: string,
  salonId: string,
  scopes: ServiceAddonScopeInput[],
) {
  const db = getDb()
  await db.transaction(async (tx) => {
    await tx
      .delete(serviceAddonScopes)
      .where(
        and(
          eq(serviceAddonScopes.salonId, salonId),
          eq(serviceAddonScopes.addonId, addonId),
        ),
      )
    await tx
      .delete(serviceAddonCategoryScopes)
      .where(
        and(
          eq(serviceAddonCategoryScopes.salonId, salonId),
          eq(serviceAddonCategoryScopes.addonId, addonId),
        ),
      )
    await tx
      .delete(serviceAddonFamilyScopes)
      .where(
        and(
          eq(serviceAddonFamilyScopes.salonId, salonId),
          eq(serviceAddonFamilyScopes.addonId, addonId),
        ),
      )
    await tx
      .delete(serviceAddonServiceScopes)
      .where(
        and(
          eq(serviceAddonServiceScopes.salonId, salonId),
          eq(serviceAddonServiceScopes.addonId, addonId),
        ),
      )

    if (scopes.length > 0) {
      await tx.insert(serviceAddonScopes).values(
        scopes.map((scope) => ({
          salonId,
          addonId,
          scopeType: scope.type,
          scopeId:
            scope.type === 'category'
              ? scope.categoryId
              : scope.type === 'service'
                ? scope.serviceId
                : null,
        })),
      )
    }
  })
}

async function getAddonScopes(
  addonIds: string[],
  salonId: string,
): Promise<Map<string, ServiceAddonScope[]>> {
  const scopes = new Map<string, ServiceAddonScope[]>()
  for (const id of addonIds) scopes.set(id, [])
  if (addonIds.length === 0) return scopes

  const db = getDb()
  const allRows = await db
    .select({
      addonId: serviceAddonScopes.addonId,
    })
    .from(serviceAddonScopes)
    .where(
      and(
        eq(serviceAddonScopes.salonId, salonId),
        inArray(serviceAddonScopes.addonId, addonIds),
        eq(serviceAddonScopes.scopeType, 'all'),
      ),
    )
  for (const row of allRows) {
    scopes.get(row.addonId)?.push({ type: 'all' })
  }

  const categoryRows = await db
    .select({
      addonId: serviceAddonScopes.addonId,
      categoryId: serviceCategories.id,
      categoryName: serviceCategories.name,
      active: serviceCategories.active,
    })
    .from(serviceAddonScopes)
    .innerJoin(
      serviceCategories,
      eq(serviceAddonScopes.scopeId, serviceCategories.id),
    )
    .where(
      and(
        eq(serviceAddonScopes.salonId, salonId),
        inArray(serviceAddonScopes.addonId, addonIds),
        eq(serviceAddonScopes.scopeType, 'category'),
      ),
    )
  for (const row of categoryRows) {
    scopes.get(row.addonId)?.push({
      type: 'category',
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      active: row.active,
    })
  }

  const serviceRows = await db
    .select({
      addonId: serviceAddonScopes.addonId,
      serviceId: services.id,
      serviceName: services.name,
      familyId: services.familyId,
      active: services.active,
    })
    .from(serviceAddonScopes)
    .innerJoin(services, eq(serviceAddonScopes.scopeId, services.id))
    .where(
      and(
        eq(serviceAddonScopes.salonId, salonId),
        inArray(serviceAddonScopes.addonId, addonIds),
        eq(serviceAddonScopes.scopeType, 'service'),
      ),
    )
  for (const row of serviceRows) {
    scopes.get(row.addonId)?.push({
      type: 'service',
      serviceId: row.serviceId,
      serviceName: row.serviceName,
      familyId: row.familyId,
      active: row.active,
    })
  }

  return scopes
}

async function rowsToAddons(
  rows: Array<typeof serviceAddons.$inferSelect>,
  salonId: string,
): Promise<ServiceAddon[]> {
  const scopes = await getAddonScopes(
    rows.map((row) => row.id),
    salonId,
  )
  return rows.map((row) => ({
    id: row.id,
    salonId: row.salonId,
    name: row.name,
    priceDelta: row.priceDelta,
    durationDelta: row.durationDelta,
    active: row.active,
    sortOrder: row.sortOrder,
    description: row.description,
    color: row.color,
    scopes: scopes.get(row.id) ?? [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }))
}

export async function getAllServiceAddons(
  salonId: string,
  includeInactive = false,
): Promise<ServiceAddon[]> {
  const db = getDb()
  const rows = await db
    .select()
    .from(serviceAddons)
    .where(
      includeInactive
        ? eq(serviceAddons.salonId, salonId)
        : and(
            eq(serviceAddons.salonId, salonId),
            eq(serviceAddons.active, true),
          ),
    )
    .orderBy(asc(serviceAddons.sortOrder), asc(serviceAddons.name))
  return rowsToAddons(rows, salonId)
}

export async function getServiceAddonById(
  id: string,
  salonId: string,
): Promise<ServiceAddon | undefined> {
  const db = getDb()
  const rows = await db
    .select()
    .from(serviceAddons)
    .where(and(eq(serviceAddons.id, id), eq(serviceAddons.salonId, salonId)))
    .limit(1)
  return (await rowsToAddons(rows, salonId))[0]
}

export async function createServiceAddon(
  input: CreateServiceAddonInput,
): Promise<ServiceAddon> {
  validateServiceAddonDeltas(input)
  if (input.active !== false) {
    await assertUniqueActiveAddonName({
      salonId: input.salonId,
      name: input.name,
    })
  }
  const scopes = await normalizeAndValidateAddonScopes(
    input.salonId,
    input.scopes ?? [],
  )

  const db = getDb()
  const values: typeof serviceAddons.$inferInsert = {
    salonId: input.salonId,
    name: input.name,
    priceDelta: input.priceDelta,
    durationDelta: input.durationDelta,
    active: input.active ?? true,
    sortOrder: input.sortOrder ?? 0,
    description: input.description ?? null,
    color: input.color ?? null,
  }
  if (isClientProvidedEntityId(input.id)) values.id = input.id
  const [row] = await db.insert(serviceAddons).values(values).returning()
  await replaceAddonScopes(row.id, input.salonId, scopes)
  const addon = await getServiceAddonById(row.id, input.salonId)
  if (!addon) throw new Error('service add-on not found')
  return addon
}

export async function updateServiceAddon(
  id: string,
  salonId: string,
  data: UpdateServiceAddonInput,
): Promise<ServiceAddon | undefined> {
  const existing = await getServiceAddonById(id, salonId)
  if (!existing) return undefined
  const nextPriceDelta = data.priceDelta ?? existing.priceDelta
  const nextDurationDelta = data.durationDelta ?? existing.durationDelta
  validateServiceAddonDeltas({
    priceDelta: nextPriceDelta,
    durationDelta: nextDurationDelta,
  })
  const nextName = data.name ?? existing.name
  const nextActive = data.active ?? existing.active
  if (nextActive) {
    await assertUniqueActiveAddonName({
      salonId,
      name: nextName,
      excludeId: id,
    })
  }
  const scopes = data.scopes
    ? await normalizeAndValidateAddonScopes(salonId, data.scopes)
    : null

  const db = getDb()
  await db
    .update(serviceAddons)
    .set({
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.priceDelta !== undefined ? { priceDelta: data.priceDelta } : {}),
      ...(data.durationDelta !== undefined
        ? { durationDelta: data.durationDelta }
        : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
      ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
      ...(data.description !== undefined
        ? { description: data.description }
        : {}),
      ...(data.color !== undefined ? { color: data.color } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(serviceAddons.id, id), eq(serviceAddons.salonId, salonId)))
  if (scopes) await replaceAddonScopes(id, salonId, scopes)
  return getServiceAddonById(id, salonId)
}

export async function getActiveServiceAddonsForService(
  serviceId: string,
  salonId: string,
): Promise<ServiceAddon[]> {
  const db = getDb()
  const [service] = await db
    .select({
      id: services.id,
      active: services.active,
      familyId: services.familyId,
      categoryId: services.categoryId,
    })
    .from(services)
    .where(
      and(
        eq(services.id, serviceId),
        eq(services.salonId, salonId),
        eq(services.active, true),
      ),
    )
    .limit(1)
  if (!service) return []

  const rows = await db
    .selectDistinct({ addon: serviceAddons })
    .from(serviceAddons)
    .innerJoin(
      serviceAddonScopes,
      and(
        eq(serviceAddonScopes.addonId, serviceAddons.id),
        eq(serviceAddonScopes.salonId, salonId),
        or(
          eq(serviceAddonScopes.scopeType, 'all'),
          and(
            eq(serviceAddonScopes.scopeType, 'category'),
            eq(serviceAddonScopes.scopeId, service.categoryId),
          ),
          and(
            eq(serviceAddonScopes.scopeType, 'service'),
            eq(serviceAddonScopes.scopeId, service.id),
          ),
        ),
      ),
    )
    .where(
      and(eq(serviceAddons.salonId, salonId), eq(serviceAddons.active, true)),
    )
    .orderBy(asc(serviceAddons.sortOrder), asc(serviceAddons.name))

  return rowsToAddons(
    rows.map((row) => row.addon),
    salonId,
  )
}

export async function getAllServiceCategories(
  salonId: string,
  includeInactive = false,
): Promise<ServiceCategory[]> {
  const db = getDb()
  const rows = await db
    .select()
    .from(serviceCategories)
    .where(
      includeInactive
        ? eq(serviceCategories.salonId, salonId)
        : and(
            eq(serviceCategories.salonId, salonId),
            eq(serviceCategories.active, true),
          ),
    )
    .orderBy(asc(serviceCategories.name))
  return rows.map(rowToServiceCategory)
}

export async function createServiceCategory(
  input: CreateCategoryInput,
): Promise<ServiceCategory> {
  const db = getDb()
  const values: typeof serviceCategories.$inferInsert = {
    salonId: input.salonId,
    name: input.name,
    active: input.active ?? true,
  }
  if (isClientProvidedEntityId(input.id)) values.id = input.id
  const [row] = await db.insert(serviceCategories).values(values).returning()
  return rowToServiceCategory(row)
}

export async function updateServiceCategory(
  id: string,
  salonId: string,
  data: UpdateCategoryInput,
): Promise<ServiceCategory | undefined> {
  const db = getDb()
  const [row] = await db
    .update(serviceCategories)
    .set({
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(eq(serviceCategories.id, id), eq(serviceCategories.salonId, salonId)),
    )
    .returning()
  return row ? rowToServiceCategory(row) : undefined
}

export async function getAllServiceFamilies(
  salonId: string,
  includeInactive = false,
): Promise<ServiceFamily[]> {
  const db = getDb()
  const rows = await db
    .select({
      id: serviceFamilies.id,
      categoryId: serviceFamilies.categoryId,
      categoryName: serviceCategories.name,
      name: serviceFamilies.name,
      active: serviceFamilies.active,
      createdAt: serviceFamilies.createdAt,
      updatedAt: serviceFamilies.updatedAt,
    })
    .from(serviceFamilies)
    .innerJoin(
      serviceCategories,
      eq(serviceFamilies.categoryId, serviceCategories.id),
    )
    .where(
      includeInactive
        ? eq(serviceFamilies.salonId, salonId)
        : and(
            eq(serviceFamilies.salonId, salonId),
            eq(serviceFamilies.active, true),
          ),
    )
    .orderBy(asc(serviceCategories.name), asc(serviceFamilies.name))
  return rows.map(rowToServiceFamily)
}

export async function createServiceFamily(
  input: CreateFamilyInput,
): Promise<ServiceFamily> {
  const db = getDb()
  const [category] = await db
    .select({ id: serviceCategories.id })
    .from(serviceCategories)
    .where(
      and(
        eq(serviceCategories.id, input.categoryId),
        eq(serviceCategories.salonId, input.salonId),
      ),
    )
    .limit(1)
  if (!category) throw new Error('service category not found')
  const values: typeof serviceFamilies.$inferInsert = {
    salonId: input.salonId,
    categoryId: input.categoryId,
    name: input.name,
    active: input.active ?? true,
  }
  if (isClientProvidedEntityId(input.id)) values.id = input.id
  const [row] = await db.insert(serviceFamilies).values(values).returning()
  const family = (await getAllServiceFamilies(input.salonId, true)).find(
    (item) => item.id === row.id,
  )
  return family ?? rowToServiceFamily({ ...row, categoryName: null })
}

export async function updateServiceFamily(
  id: string,
  salonId: string,
  data: UpdateFamilyInput,
): Promise<ServiceFamily | undefined> {
  const db = getDb()
  if (data.categoryId !== undefined) {
    const [category] = await db
      .select({ id: serviceCategories.id })
      .from(serviceCategories)
      .where(
        and(
          eq(serviceCategories.id, data.categoryId),
          eq(serviceCategories.salonId, salonId),
        ),
      )
      .limit(1)
    if (!category) throw new Error('service category not found')
  }
  const [row] = await db
    .update(serviceFamilies)
    .set({
      ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(eq(serviceFamilies.id, id), eq(serviceFamilies.salonId, salonId)),
    )
    .returning()
  if (!row) return undefined
  return (await getAllServiceFamilies(salonId, true)).find(
    (item) => item.id === row.id,
  )
}

export async function importStarterServiceTemplates(salonId: string): Promise<{
  categories: ServiceCategory[]
  services: Service[]
}> {
  const categories: ServiceCategory[] = []
  const importedServices: Service[] = []

  for (const categoryTemplate of PERSIAN_STARTER_SERVICE_TEMPLATES) {
    let category = (await getAllServiceCategories(salonId, true)).find(
      (item) => item.name === categoryTemplate.category,
    )
    if (!category) {
      category = await createServiceCategory({
        salonId,
        name: categoryTemplate.category,
      })
    }
    categories.push(category)

    for (const serviceTemplate of categoryTemplate.services) {
      const existingService = (await getAllServices(salonId, true)).find(
        (item) => item.name === serviceTemplate.name,
      )
      if (existingService) {
        importedServices.push(existingService)
        continue
      }
      importedServices.push(
        await createService({
          salonId,
          categoryId: category.id,
          active: true,
          ...serviceTemplate,
        }),
      )
    }
  }

  return { categories, services: importedServices }
}
