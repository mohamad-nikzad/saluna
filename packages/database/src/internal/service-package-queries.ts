import { and, asc, eq, inArray, ne } from 'drizzle-orm'
import type {
  Service,
  ServicePackage,
  ServicePackageComponent,
} from '@repo/salon-core/types'
import { getDb } from '../client'
import {
  serviceCategories,
  serviceFamilies,
  servicePackageComponents,
  servicePackages,
  staffPackageCapabilities,
  services,
} from '../schema'
import { isClientProvidedEntityId } from './client-queries'
import { joinedRowToService } from './row-mappers'

type CreateServicePackageInput = {
  id?: string
  salonId: string
  categoryId?: string | null
  name: string
  description?: string | null
  color?: string | null
  active?: boolean
  priceOverride?: number | null
  sortOrder?: number
}

type UpdateServicePackageInput = Partial<
  Pick<
    ServicePackage,
    | 'categoryId'
    | 'name'
    | 'description'
    | 'color'
    | 'active'
    | 'priceOverride'
    | 'sortOrder'
  >
>

export function normalizeServicePackageName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('fa-IR')
}

export function resolveServicePackagePrice(input: {
  priceOverride: number | null
  componentPriceTotal: number
}): number {
  return input.priceOverride ?? input.componentPriceTotal
}

export function validatePackageComponentReplacement(input: {
  serviceIds: string[]
  foundServices: Array<{ id: string; active: boolean; kind: Service['kind'] }>
}) {
  const { serviceIds, foundServices } = input
  if (new Set(serviceIds).size !== serviceIds.length) {
    throw new Error('service package components cannot contain duplicates')
  }
  if (foundServices.length !== serviceIds.length) {
    throw new Error('service package component service not found')
  }
  if (foundServices.some((row) => !row.active)) {
    throw new Error('service package components must be active services')
  }
  if (foundServices.some((row) => (row.kind ?? 'standard') !== 'standard')) {
    throw new Error('service package cannot contain legacy combo services')
  }
}

async function assertCategoryInSalon(
  salonId: string,
  categoryId: string | null | undefined,
) {
  if (categoryId == null) return
  const db = getDb()
  const rows = await db
    .select({ id: serviceCategories.id })
    .from(serviceCategories)
    .where(
      and(
        eq(serviceCategories.salonId, salonId),
        eq(serviceCategories.id, categoryId),
      ),
    )
    .limit(1)
  if (!rows[0]) throw new Error('service package category not found')
}

async function assertUniqueActivePackageName(input: {
  salonId: string
  name: string
  excludeId?: string
}) {
  const db = getDb()
  const rows = await db
    .select({ id: servicePackages.id, name: servicePackages.name })
    .from(servicePackages)
    .where(
      input.excludeId
        ? and(
            eq(servicePackages.salonId, input.salonId),
            eq(servicePackages.active, true),
            ne(servicePackages.id, input.excludeId),
          )
        : and(
            eq(servicePackages.salonId, input.salonId),
            eq(servicePackages.active, true),
          ),
    )
  const normalized = normalizeServicePackageName(input.name)
  if (
    rows.some((row) => normalizeServicePackageName(row.name) === normalized)
  ) {
    throw new Error('active service package name must be unique per salon')
  }
}

async function getPackageRows(
  salonId: string,
  includeInactive: boolean,
  packageId?: string,
) {
  const db = getDb()
  const where = packageId
    ? and(
        eq(servicePackages.salonId, salonId),
        eq(servicePackages.id, packageId),
      )
    : includeInactive
      ? eq(servicePackages.salonId, salonId)
      : and(
          eq(servicePackages.salonId, salonId),
          eq(servicePackages.active, true),
        )

  return db
    .select({
      package: servicePackages,
      category: {
        id: serviceCategories.id,
        name: serviceCategories.name,
      },
    })
    .from(servicePackages)
    .leftJoin(
      serviceCategories,
      eq(servicePackages.categoryId, serviceCategories.id),
    )
    .where(where)
    .orderBy(asc(servicePackages.sortOrder), asc(servicePackages.name))
}

async function getPackageComponents(
  packageIds: string[],
  salonId: string,
): Promise<Map<string, ServicePackageComponent[]>> {
  const components = new Map<string, ServicePackageComponent[]>()
  for (const packageId of packageIds) components.set(packageId, [])
  if (packageIds.length === 0) return components

  const db = getDb()
  const rows = await db
    .select({
      component: servicePackageComponents,
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
    .from(servicePackageComponents)
    .innerJoin(
      services,
      and(
        eq(servicePackageComponents.serviceId, services.id),
        eq(services.salonId, salonId),
      ),
    )
    .leftJoin(serviceFamilies, eq(services.familyId, serviceFamilies.id))
    .leftJoin(serviceCategories, eq(services.categoryId, serviceCategories.id))
    .where(
      and(
        eq(servicePackageComponents.salonId, salonId),
        inArray(servicePackageComponents.packageId, packageIds),
      ),
    )
    .orderBy(asc(servicePackageComponents.sortOrder), asc(services.name))

  for (const row of rows) {
    const service = joinedRowToService({
      service: row.service,
      family: row.family,
      category: row.category,
    })
    const component: ServicePackageComponent = {
      id: row.component.id,
      salonId: row.component.salonId,
      packageId: row.component.packageId,
      serviceId: row.component.serviceId,
      sortOrder: row.component.sortOrder,
      service,
      createdAt: row.component.createdAt,
      updatedAt: row.component.updatedAt,
    }
    components.get(row.component.packageId)?.push(component)
  }

  return components
}

async function rowsToPackages(
  rows: Awaited<ReturnType<typeof getPackageRows>>,
  salonId: string,
): Promise<ServicePackage[]> {
  const packageIds = rows.map((row) => row.package.id)
  const componentMap = await getPackageComponents(packageIds, salonId)
  const staffIdsByPackage = await getPackageStaffIds(packageIds, salonId)
  return rows.map((row) => {
    const components = componentMap.get(row.package.id) ?? []
    const totalDuration = components.reduce(
      (sum, item) => sum + item.service.duration,
      0,
    )
    const componentPriceTotal = components.reduce(
      (sum, item) => sum + item.service.price,
      0,
    )
    return {
      id: row.package.id,
      salonId: row.package.salonId,
      categoryId: row.package.categoryId,
      categoryName: row.category?.name ?? null,
      name: row.package.name,
      description: row.package.description,
      color: row.package.color,
      active: row.package.active,
      priceOverride: row.package.priceOverride,
      sortOrder: row.package.sortOrder,
      components,
      staffIds: staffIdsByPackage.get(row.package.id) ?? [],
      totalDuration,
      componentPriceTotal,
      resolvedPrice: resolveServicePackagePrice({
        priceOverride: row.package.priceOverride,
        componentPriceTotal,
      }),
      createdAt: row.package.createdAt,
      updatedAt: row.package.updatedAt,
    }
  })
}

async function getPackageStaffIds(
  packageIds: string[],
  salonId: string,
): Promise<Map<string, string[]>> {
  const staffIdsByPackage = new Map<string, string[]>()
  for (const packageId of packageIds) staffIdsByPackage.set(packageId, [])
  if (packageIds.length === 0) return staffIdsByPackage

  const db = getDb()
  const rows = await db
    .select({
      packageId: staffPackageCapabilities.packageId,
      staffId: staffPackageCapabilities.staffId,
    })
    .from(staffPackageCapabilities)
    .where(
      and(
        eq(staffPackageCapabilities.salonId, salonId),
        inArray(staffPackageCapabilities.packageId, packageIds),
      ),
    )
    .orderBy(
      asc(staffPackageCapabilities.packageId),
      asc(staffPackageCapabilities.staffId),
    )

  for (const row of rows) {
    staffIdsByPackage.get(row.packageId)?.push(row.staffId)
  }
  return staffIdsByPackage
}

export async function getAllServicePackages(
  salonId: string,
  includeInactive = false,
): Promise<ServicePackage[]> {
  return rowsToPackages(await getPackageRows(salonId, includeInactive), salonId)
}

export async function getServicePackageById(
  id: string,
  salonId: string,
): Promise<ServicePackage | undefined> {
  const rows = await getPackageRows(salonId, true, id)
  return (await rowsToPackages(rows, salonId))[0]
}

export async function createServicePackage(
  input: CreateServicePackageInput,
): Promise<ServicePackage> {
  await assertCategoryInSalon(input.salonId, input.categoryId)
  if (input.active !== false) {
    await assertUniqueActivePackageName({
      salonId: input.salonId,
      name: input.name,
    })
  }

  const db = getDb()
  const values: typeof servicePackages.$inferInsert = {
    salonId: input.salonId,
    categoryId: input.categoryId ?? null,
    name: input.name,
    description: input.description ?? null,
    color: input.color ?? null,
    active: input.active ?? true,
    priceOverride: input.priceOverride ?? null,
    sortOrder: input.sortOrder ?? 0,
  }
  if (isClientProvidedEntityId(input.id)) values.id = input.id

  const [row] = await db.insert(servicePackages).values(values).returning()
  const created = await getServicePackageById(row.id, input.salonId)
  if (!created) throw new Error('service package not found')
  return created
}

export async function updateServicePackage(
  id: string,
  salonId: string,
  data: UpdateServicePackageInput,
): Promise<ServicePackage | undefined> {
  const existing = await getServicePackageById(id, salonId)
  if (!existing) return undefined
  if (data.categoryId !== undefined) {
    await assertCategoryInSalon(salonId, data.categoryId)
  }
  const nextName = data.name ?? existing.name
  const nextActive = data.active ?? existing.active
  if (nextActive) {
    await assertUniqueActivePackageName({
      salonId,
      name: nextName,
      excludeId: id,
    })
  }

  const db = getDb()
  await db
    .update(servicePackages)
    .set({
      ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined
        ? { description: data.description }
        : {}),
      ...(data.color !== undefined ? { color: data.color } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
      ...(data.priceOverride !== undefined
        ? { priceOverride: data.priceOverride }
        : {}),
      ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(eq(servicePackages.id, id), eq(servicePackages.salonId, salonId)),
    )

  return getServicePackageById(id, salonId)
}

export async function replaceServicePackageComponents(
  packageId: string,
  salonId: string,
  serviceIds: string[],
): Promise<ServicePackage> {
  const existing = await getServicePackageById(packageId, salonId)
  if (!existing) throw new Error('service package not found')

  const db = getDb()
  const serviceRows =
    serviceIds.length === 0
      ? []
      : await db
          .select({
            id: services.id,
            active: services.active,
            kind: services.kind,
          })
          .from(services)
          .where(
            and(
              eq(services.salonId, salonId),
              inArray(services.id, serviceIds),
            ),
          )

  validatePackageComponentReplacement({
    serviceIds,
    foundServices: serviceRows,
  })

  await db.transaction(async (tx) => {
    await tx
      .delete(servicePackageComponents)
      .where(
        and(
          eq(servicePackageComponents.salonId, salonId),
          eq(servicePackageComponents.packageId, packageId),
        ),
      )

    if (serviceIds.length > 0) {
      await tx.insert(servicePackageComponents).values(
        serviceIds.map((serviceId, index) => ({
          salonId,
          packageId,
          serviceId,
          sortOrder: index,
        })),
      )
    }
  })

  const updated = await getServicePackageById(packageId, salonId)
  if (!updated) throw new Error('service package not found')
  return updated
}
