import { and, asc, eq, inArray } from 'drizzle-orm'
import { PERSIAN_STARTER_SERVICE_TEMPLATES } from '@repo/salon-core/starter-service-templates'
import type { Service, ServiceCategory, ServiceFamily } from '@repo/salon-core/types'
import { getDb } from '../client'
import { serviceCategories, serviceFamilies, services } from '../schema'
import { joinedRowToService, rowToServiceCategory, rowToServiceFamily } from './row-mappers'
import { isClientProvidedEntityId } from './client-queries'

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

type UpdateFamilyInput = Partial<Pick<ServiceFamily, 'categoryId' | 'name' | 'active'>>

export async function validateActiveServiceIds(ids: string[], salonId: string): Promise<boolean> {
  if (ids.length === 0) return true
  const db = getDb()
  const rows = await db
    .select({ id: services.id })
    .from(services)
    .where(and(eq(services.salonId, salonId), eq(services.active, true), inArray(services.id, ids)))
  return rows.length === ids.length
}

export async function getAllServices(salonId: string, includeInactive = false): Promise<Service[]> {
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
        .leftJoin(serviceCategories, eq(serviceFamilies.categoryId, serviceCategories.id))
        .where(eq(services.salonId, salonId))
        .orderBy(asc(serviceCategories.name), asc(serviceFamilies.name), asc(services.name))
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
        .leftJoin(serviceCategories, eq(serviceFamilies.categoryId, serviceCategories.id))
        .where(and(eq(services.salonId, salonId), eq(services.active, true)))
        .orderBy(asc(serviceCategories.name), asc(serviceFamilies.name), asc(services.name))
  return rows.map(joinedRowToService)
}

export async function getServiceById(id: string, salonId: string): Promise<Service | undefined> {
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
    .leftJoin(serviceCategories, eq(serviceFamilies.categoryId, serviceCategories.id))
    .where(and(eq(services.id, id), eq(services.salonId, salonId)))
    .limit(1)
  const row = rows[0]
  return row ? joinedRowToService(row) : undefined
}

async function getActiveFamily(familyId: string, salonId: string) {
  const db = getDb()
  const [row] = await db
    .select({ id: serviceFamilies.id, categoryName: serviceCategories.name })
    .from(serviceFamilies)
    .innerJoin(serviceCategories, eq(serviceFamilies.categoryId, serviceCategories.id))
    .where(
      and(
        eq(serviceFamilies.id, familyId),
        eq(serviceFamilies.salonId, salonId),
        eq(serviceFamilies.active, true),
        eq(serviceCategories.active, true)
      )
    )
    .limit(1)
  return row
}

export async function createService(
  input: Pick<Service, 'name' | 'duration' | 'price' | 'color'> & {
    id?: string
    salonId: string
    familyId: string
    active?: boolean
    description?: string | null
    kind?: Service['kind']
  }
): Promise<Service> {
  const db = getDb()
  const family = await getActiveFamily(input.familyId, input.salonId)
  if (!family) throw new Error('service family not found or inactive')
  const values: typeof services.$inferInsert = {
    salonId: input.salonId,
    name: input.name,
    familyId: input.familyId,
    duration: input.duration,
    price: input.price,
    color: input.color,
    active: input.active ?? true,
    description: input.description ?? null,
    kind: input.kind ?? 'standard',
  }
  if (isClientProvidedEntityId(input.id)) {
    values.id = input.id
  }
  const [row] = await db.insert(services).values(values).returning()
  const service = await getServiceById(row.id, input.salonId)
  return service ?? joinedRowToService({ service: row, family: null, category: null })
}

export async function updateService(
  id: string,
  salonId: string,
  data: Partial<Omit<Service, 'id'>>
): Promise<Service | undefined> {
  const db = getDb()
  if (data.familyId === null) throw new Error('service family is required')
  if (data.familyId !== undefined) {
    const family = await getActiveFamily(data.familyId, salonId)
    if (!family) throw new Error('service family not found or inactive')
  }
  const [row] = await db
    .update(services)
    .set({
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.familyId !== undefined ? { familyId: data.familyId } : {}),
      ...(data.duration !== undefined ? { duration: data.duration } : {}),
      ...(data.price !== undefined ? { price: data.price } : {}),
      ...(data.color !== undefined ? { color: data.color } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.kind !== undefined ? { kind: data.kind } : {}),
    })
    .where(and(eq(services.id, id), eq(services.salonId, salonId)))
    .returning()
  return row ? await getServiceById(row.id, salonId) : undefined
}

export async function getAllServiceCategories(
  salonId: string,
  includeInactive = false
): Promise<ServiceCategory[]> {
  const db = getDb()
  const rows = await db
    .select()
    .from(serviceCategories)
    .where(
      includeInactive
        ? eq(serviceCategories.salonId, salonId)
        : and(eq(serviceCategories.salonId, salonId), eq(serviceCategories.active, true))
    )
    .orderBy(asc(serviceCategories.name))
  return rows.map(rowToServiceCategory)
}

export async function createServiceCategory(input: CreateCategoryInput): Promise<ServiceCategory> {
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
  data: UpdateCategoryInput
): Promise<ServiceCategory | undefined> {
  const db = getDb()
  const [row] = await db
    .update(serviceCategories)
    .set({
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(serviceCategories.id, id), eq(serviceCategories.salonId, salonId)))
    .returning()
  return row ? rowToServiceCategory(row) : undefined
}

export async function getAllServiceFamilies(
  salonId: string,
  includeInactive = false
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
    .innerJoin(serviceCategories, eq(serviceFamilies.categoryId, serviceCategories.id))
    .where(
      includeInactive
        ? eq(serviceFamilies.salonId, salonId)
        : and(eq(serviceFamilies.salonId, salonId), eq(serviceFamilies.active, true))
    )
    .orderBy(asc(serviceCategories.name), asc(serviceFamilies.name))
  return rows.map(rowToServiceFamily)
}

export async function createServiceFamily(input: CreateFamilyInput): Promise<ServiceFamily> {
  const db = getDb()
  const [category] = await db
    .select({ id: serviceCategories.id })
    .from(serviceCategories)
    .where(and(eq(serviceCategories.id, input.categoryId), eq(serviceCategories.salonId, input.salonId)))
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
  const family = (await getAllServiceFamilies(input.salonId, true)).find((item) => item.id === row.id)
  return family ?? rowToServiceFamily({ ...row, categoryName: null })
}

export async function updateServiceFamily(
  id: string,
  salonId: string,
  data: UpdateFamilyInput
): Promise<ServiceFamily | undefined> {
  const db = getDb()
  if (data.categoryId !== undefined) {
    const [category] = await db
      .select({ id: serviceCategories.id })
      .from(serviceCategories)
      .where(and(eq(serviceCategories.id, data.categoryId), eq(serviceCategories.salonId, salonId)))
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
    .where(and(eq(serviceFamilies.id, id), eq(serviceFamilies.salonId, salonId)))
    .returning()
  if (!row) return undefined
  return (await getAllServiceFamilies(salonId, true)).find((item) => item.id === row.id)
}

export async function importStarterServiceTemplates(salonId: string): Promise<{
  categories: ServiceCategory[]
  families: ServiceFamily[]
  services: Service[]
}> {
  const categories: ServiceCategory[] = []
  const families: ServiceFamily[] = []
  const importedServices: Service[] = []

  for (const categoryTemplate of PERSIAN_STARTER_SERVICE_TEMPLATES) {
    let category = (await getAllServiceCategories(salonId, true)).find(
      (item) => item.name === categoryTemplate.category
    )
    if (!category) {
      category = await createServiceCategory({ salonId, name: categoryTemplate.category })
    }
    categories.push(category)

    for (const familyTemplate of categoryTemplate.families) {
      let family = (await getAllServiceFamilies(salonId, true)).find(
        (item) => item.categoryId === category.id && item.name === familyTemplate.name
      )
      if (!family) {
        family = await createServiceFamily({
          salonId,
          categoryId: category.id,
          name: familyTemplate.name,
        })
      }
      families.push(family)

      for (const serviceTemplate of familyTemplate.services) {
        const existingService = (await getAllServices(salonId, true)).find(
          (item) => item.name === serviceTemplate.name
        )
        if (existingService) {
          importedServices.push(existingService)
          continue
        }
        importedServices.push(
          await createService({
            salonId,
            familyId: family.id,
            active: true,
            kind: serviceTemplate.kind ?? 'standard',
            ...serviceTemplate,
          })
        )
      }
    }
  }

  return { categories, families, services: importedServices }
}
