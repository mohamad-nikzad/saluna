/**
 * Fresh DB seed. Run after schema exists:
 *   pnpm db:push
 *   pnpm db:seed
 */
import bcrypt from 'bcryptjs'
import { drizzle } from 'drizzle-orm/postgres-js'
import { and, asc, count, eq, inArray, like } from 'drizzle-orm'
import postgres from 'postgres'
import { getDatabaseUrl } from './config'
import {
  addDaysYmd,
  salonCurrentHm,
  salonTodayYmd,
} from '@repo/salon-core/salon-local-time'
import * as schema from './schema'
import { seedCatalogPresets } from './seed/catalog-presets'
import {
  appointments,
  businessSettings,
  clientFollowUps,
  clientTags,
  clients,
  locations,
  resources,
  serviceComboComponents,
  serviceAddonCategoryScopes,
  serviceAddonFamilyScopes,
  serviceAddons,
  serviceCategories,
  serviceFamilies,
  serviceAddonServiceScopes,
  salons,
  services,
  staffSchedules,
  staffServices,
  users,
} from './schema'

const client = postgres(getDatabaseUrl({ preferDirect: true }), { max: 1 })
const db = drizzle(client, { schema })

const passwordHash = bcrypt.hashSync('admin123', 10)

function formatDate(d: Date) {
  return d.toISOString().split('T')[0]
}

type SeedAddonRow = {
  name: string
  priceDelta: number
  durationDelta: number
  color: string
  sortOrder: number
  description: string
  categoryScopes?: string[]
  familyScopes?: Array<{ category: string; family: string }>
  serviceScopes?: string[]
}

const primarySeedAddons: SeedAddonRow[] = [
  {
    name: 'دیزاین ناخن',
    priceDelta: 150_000,
    durationDelta: 20,
    color: 'rose',
    sortOrder: 10,
    description: 'طراحی ساده روی چند ناخن',
    categoryScopes: ['ناخن'],
  },
  {
    name: 'فرنچ',
    priceDelta: 180_000,
    durationDelta: 20,
    color: 'violet',
    sortOrder: 20,
    description: 'فرنچ کلاسیک برای خدمات ناخن',
    categoryScopes: ['ناخن'],
  },
  {
    name: 'ریموو ژل یا کاشت',
    priceDelta: 220_000,
    durationDelta: 30,
    color: 'coral',
    sortOrder: 30,
    description: 'برداشتن مواد قبلی قبل از خدمت اصلی',
    familyScopes: [{ category: 'ناخن', family: 'کاشت و ترمیم' }],
  },
  {
    name: 'قد بلند',
    priceDelta: 250_000,
    durationDelta: 30,
    color: 'gold',
    sortOrder: 40,
    description: 'افزایش زمان و قیمت برای قد بلند ناخن یا مو',
    serviceScopes: ['کاشت پودری', 'کاشت ژل', 'رنگ کامل مو', 'آمبره و بالیاژ'],
  },
  {
    name: 'پلکس محافظ مو',
    priceDelta: 450_000,
    durationDelta: 15,
    color: 'mint',
    sortOrder: 50,
    description: 'محافظت اضافه هنگام رنگ و دکلره',
    familyScopes: [{ category: 'مو', family: 'رنگ و لایت' }],
  },
]

function salonYmdTehran(): string {
  return salonTodayYmd()
}

function currentHmTehran(): string {
  return salonCurrentHm()
}

function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(':').map(Number)
  return h * 60 + m
}

function minutesToHm(total: number): string {
  let n = total % (24 * 60)
  if (n < 0) n += 24 * 60
  const h = Math.floor(n / 60)
  const min = n % 60
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

function appointmentSnapshot(service: {
  name: string
  duration: number
  price: number
}) {
  return {
    bookedServiceName: service.name,
    bookedServiceDuration: service.duration,
    bookedServicePrice: service.price,
    bookedTotalDuration: service.duration,
    bookedTotalPrice: service.price,
  }
}

const tagColors: Record<string, string> = {
  VIP: 'bg-amber-100 text-amber-800 border-amber-200',
  حساسیت: 'bg-rose-100 text-rose-800 border-rose-200',
  'رنگ خاص': 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
  'نیاز به پیگیری': 'bg-cyan-100 text-cyan-800 border-cyan-200',
  بدقول: 'bg-orange-100 text-orange-800 border-orange-200',
}

type SeedServiceRow = {
  category: string
  family: string
  name: string
  duration: number
  price: number
  color: 'rose' | 'violet' | 'mint' | 'gold' | 'coral'
}

type SeedComboRow = {
  category: string
  family: string
  name: string
  componentNames: string[]
  duration: number
  price: number
  color: 'rose' | 'violet' | 'mint' | 'gold' | 'coral'
  description: string
}

const primarySeedServices: SeedServiceRow[] = [
  {
    category: 'مو',
    family: 'کوتاهی و براشینگ',
    name: 'کوتاهی مو',
    duration: 45,
    price: 450_000,
    color: 'coral',
  },
  {
    category: 'مو',
    family: 'کوتاهی و براشینگ',
    name: 'براشینگ مو',
    duration: 45,
    price: 500_000,
    color: 'gold',
  },
  {
    category: 'مو',
    family: 'کوتاهی و براشینگ',
    name: 'شینیون',
    duration: 90,
    price: 1_200_000,
    color: 'rose',
  },
  {
    category: 'مو',
    family: 'رنگ و لایت',
    name: 'رنگ ریشه',
    duration: 90,
    price: 900_000,
    color: 'violet',
  },
  {
    category: 'مو',
    family: 'رنگ و لایت',
    name: 'رنگ کامل مو',
    duration: 150,
    price: 1_800_000,
    color: 'rose',
  },
  {
    category: 'مو',
    family: 'رنگ و لایت',
    name: 'مش و هایلایت',
    duration: 180,
    price: 2_400_000,
    color: 'gold',
  },
  {
    category: 'مو',
    family: 'رنگ و لایت',
    name: 'آمبره و بالیاژ',
    duration: 210,
    price: 3_200_000,
    color: 'mint',
  },
  {
    category: 'مو',
    family: 'احیا و صافی',
    name: 'کراتین مو',
    duration: 180,
    price: 2_800_000,
    color: 'coral',
  },
  {
    category: 'مو',
    family: 'احیا و صافی',
    name: 'پروتئین تراپی مو',
    duration: 180,
    price: 2_400_000,
    color: 'violet',
  },
  {
    category: 'ناخن',
    family: 'کاشت و ترمیم',
    name: 'کاشت پودری',
    duration: 120,
    price: 1_100_000,
    color: 'rose',
  },
  {
    category: 'ناخن',
    family: 'کاشت و ترمیم',
    name: 'کاشت ژل',
    duration: 120,
    price: 1_250_000,
    color: 'violet',
  },
  {
    category: 'ناخن',
    family: 'کاشت و ترمیم',
    name: 'ترمیم کاشت',
    duration: 90,
    price: 750_000,
    color: 'mint',
  },
  {
    category: 'ناخن',
    family: 'مانیکور و پدیکور',
    name: 'مانیکور',
    duration: 45,
    price: 450_000,
    color: 'coral',
  },
  {
    category: 'ناخن',
    family: 'مانیکور و پدیکور',
    name: 'پدیکور',
    duration: 60,
    price: 650_000,
    color: 'gold',
  },
  {
    category: 'ناخن',
    family: 'مانیکور و پدیکور',
    name: 'لاک ژل دست',
    duration: 45,
    price: 500_000,
    color: 'rose',
  },
  {
    category: 'ناخن',
    family: 'مانیکور و پدیکور',
    name: 'لاک ژل پا',
    duration: 45,
    price: 550_000,
    color: 'violet',
  },
  {
    category: 'پوست',
    family: 'فیشیال و مراقبت',
    name: 'فیشیال صورت',
    duration: 75,
    price: 950_000,
    color: 'mint',
  },
  {
    category: 'پوست',
    family: 'فیشیال و مراقبت',
    name: 'پاکسازی پوست',
    duration: 60,
    price: 750_000,
    color: 'coral',
  },
  {
    category: 'پوست',
    family: 'فیشیال و مراقبت',
    name: 'آبرسانی پوست',
    duration: 45,
    price: 650_000,
    color: 'gold',
  },
  {
    category: 'مژه',
    family: 'اکستنشن مژه',
    name: 'اکستنشن کلاسیک مژه',
    duration: 120,
    price: 1_100_000,
    color: 'rose',
  },
  {
    category: 'مژه',
    family: 'اکستنشن مژه',
    name: 'اکستنشن والیوم مژه',
    duration: 150,
    price: 1_450_000,
    color: 'violet',
  },
  {
    category: 'مژه',
    family: 'اکستنشن مژه',
    name: 'ترمیم اکستنشن مژه',
    duration: 75,
    price: 700_000,
    color: 'mint',
  },
  {
    category: 'مژه',
    family: 'لیفت و لمینت',
    name: 'لیفت و لمینت مژه',
    duration: 75,
    price: 850_000,
    color: 'gold',
  },
  {
    category: 'ابرو',
    family: 'اصلاح و فرم دهی',
    name: 'اصلاح صورت و ابرو',
    duration: 30,
    price: 250_000,
    color: 'coral',
  },
  {
    category: 'ابرو',
    family: 'اصلاح و فرم دهی',
    name: 'رنگ ابرو',
    duration: 30,
    price: 250_000,
    color: 'gold',
  },
  {
    category: 'ابرو',
    family: 'اصلاح و فرم دهی',
    name: 'لیفت ابرو',
    duration: 60,
    price: 750_000,
    color: 'mint',
  },
  {
    category: 'آرایش دائم',
    family: 'ابرو',
    name: 'فیبروز ابرو',
    duration: 150,
    price: 2_000_000,
    color: 'rose',
  },
  {
    category: 'آرایش دائم',
    family: 'ابرو',
    name: 'میکروبلیدینگ ابرو',
    duration: 150,
    price: 2_200_000,
    color: 'violet',
  },
  {
    category: 'آرایش دائم',
    family: 'چشم و لب',
    name: 'بن مژه',
    duration: 120,
    price: 1_500_000,
    color: 'rose',
  },
  {
    category: 'آرایش دائم',
    family: 'چشم و لب',
    name: 'خط چشم دائم',
    duration: 120,
    price: 1_700_000,
    color: 'violet',
  },
  {
    category: 'آرایش دائم',
    family: 'چشم و لب',
    name: 'شیدینگ لب',
    duration: 150,
    price: 1_900_000,
    color: 'coral',
  },
  {
    category: 'آرایش دائم',
    family: 'ریموو',
    name: 'ریموو تاتو',
    duration: 90,
    price: 1_200_000,
    color: 'mint',
  },
  {
    category: 'اپیلاسیون',
    family: 'وکس و اپیلاسیون',
    name: 'وکس صورت',
    duration: 30,
    price: 250_000,
    color: 'gold',
  },
  {
    category: 'اپیلاسیون',
    family: 'وکس و اپیلاسیون',
    name: 'اپیلاسیون بدن',
    duration: 90,
    price: 900_000,
    color: 'coral',
  },
]

const secondSalonSeedServices: SeedServiceRow[] = [
  {
    category: 'مو',
    family: 'کوتاهی و براشینگ',
    name: 'براشینگ مو',
    duration: 45,
    price: 450_000,
    color: 'gold',
  },
  {
    category: 'ناخن',
    family: 'مانیکور و پدیکور',
    name: 'مانیکور',
    duration: 45,
    price: 400_000,
    color: 'coral',
  },
]

const primarySeedCombos: SeedComboRow[] = [
  {
    category: 'مو',
    family: 'پکیج‌های ترکیبی',
    name: 'پکیج رنگ و براشینگ',
    componentNames: ['رنگ کامل مو', 'براشینگ مو'],
    duration: 180,
    price: 2_150_000,
    color: 'rose',
    description: 'رنگ کامل مو همراه با براشینگ نهایی',
  },
  {
    category: 'ناخن',
    family: 'پکیج‌های ترکیبی',
    name: 'پکیج مانیکور و لاک ژل',
    componentNames: ['مانیکور', 'لاک ژل دست'],
    duration: 75,
    price: 850_000,
    color: 'violet',
    description: 'مانیکور کامل همراه با لاک ژل دست',
  },
  {
    category: 'پوست',
    family: 'پکیج‌های ترکیبی',
    name: 'پکیج پاکسازی و آبرسانی',
    componentNames: ['پاکسازی پوست', 'آبرسانی پوست'],
    duration: 90,
    price: 1_200_000,
    color: 'mint',
    description: 'پاکسازی پوست همراه با آبرسانی تکمیلی',
  },
]

async function seedServiceCatalog(salonId: string, rows: SeedServiceRow[]) {
  const categoryByName = new Map<string, { id: string }>()
  const familyByPath = new Map<string, { id: string }>()

  for (const row of rows) {
    let category = categoryByName.get(row.category)
    if (!category) {
      const [inserted] = await db
        .insert(serviceCategories)
        .values({ salonId, name: row.category, active: true })
        .onConflictDoUpdate({
          target: [serviceCategories.salonId, serviceCategories.name],
          set: { active: true, updatedAt: new Date() },
        })
        .returning({ id: serviceCategories.id })
      category = inserted
      categoryByName.set(row.category, category)
    }

    const familyPath = `${row.category}/${row.family}`
    let family = familyByPath.get(familyPath)
    if (!family) {
      const [inserted] = await db
        .insert(serviceFamilies)
        .values({
          salonId,
          categoryId: category.id,
          name: row.family,
          active: true,
        })
        .onConflictDoUpdate({
          target: [
            serviceFamilies.salonId,
            serviceFamilies.categoryId,
            serviceFamilies.name,
          ],
          set: { active: true, updatedAt: new Date() },
        })
        .returning({ id: serviceFamilies.id })
      family = inserted
      familyByPath.set(familyPath, family)
    }

    await db
      .insert(services)
      .values({
        salonId,
        familyId: family.id,
        name: row.name,
        duration: row.duration,
        price: row.price,
        color: row.color,
        active: true,
      })
      .onConflictDoUpdate({
        target: [services.salonId, services.name],
        set: {
          familyId: family.id,
          duration: row.duration,
          price: row.price,
          color: row.color,
          kind: 'standard',
          active: true,
        },
      })
  }
}

async function seedServiceCombos(salonId: string, rows: SeedComboRow[]) {
  const categories = await db
    .select()
    .from(serviceCategories)
    .where(eq(serviceCategories.salonId, salonId))
  const families = await db
    .select()
    .from(serviceFamilies)
    .where(eq(serviceFamilies.salonId, salonId))
  const serviceRows = await db
    .select()
    .from(services)
    .where(eq(services.salonId, salonId))

  const categoryByName = new Map(categories.map((category) => [category.name, category]))
  const familyByPath = new Map<string, (typeof families)[number]>(
    families.map((family) => {
      const category = categories.find((item) => item.id === family.categoryId)
      return [`${category?.name ?? ''}/${family.name}`, family] as const
    }),
  )
  const serviceByName = new Map(serviceRows.map((service) => [service.name, service]))

  for (const row of rows) {
    let category = categoryByName.get(row.category)
    if (!category) {
      const [inserted] = await db
        .insert(serviceCategories)
        .values({ salonId, name: row.category, active: true })
        .onConflictDoUpdate({
          target: [serviceCategories.salonId, serviceCategories.name],
          set: { active: true, updatedAt: new Date() },
        })
        .returning()
      category = inserted
      categoryByName.set(row.category, category)
    }

    const familyPath = `${row.category}/${row.family}`
    let family = familyByPath.get(familyPath)
    if (!family) {
      const [inserted] = await db
        .insert(serviceFamilies)
        .values({
          salonId,
          categoryId: category.id,
          name: row.family,
          active: true,
        })
        .onConflictDoUpdate({
          target: [
            serviceFamilies.salonId,
            serviceFamilies.categoryId,
            serviceFamilies.name,
          ],
          set: { active: true, updatedAt: new Date() },
        })
        .returning()
      family = inserted
      familyByPath.set(familyPath, family)
    }

    const components = row.componentNames
      .map((name) => serviceByName.get(name))
      .filter((service): service is NonNullable<typeof service> => Boolean(service))

    if (components.length !== row.componentNames.length) {
      console.warn(`Skip combo seed: missing components for ${row.name}.`)
      continue
    }

    const [combo] = await db
      .insert(services)
      .values({
        salonId,
        familyId: family.id,
        name: row.name,
        duration: row.duration,
        price: row.price,
        color: row.color,
        active: true,
        description: row.description,
        kind: 'combo',
      })
      .onConflictDoUpdate({
        target: [services.salonId, services.name],
        set: {
          familyId: family.id,
          duration: row.duration,
          price: row.price,
          color: row.color,
          active: true,
          description: row.description,
          kind: 'combo',
        },
      })
      .returning()

    await db
      .delete(serviceComboComponents)
      .where(eq(serviceComboComponents.comboServiceId, combo.id))

    await db.insert(serviceComboComponents).values(
      components.map((component, index) => ({
        salonId,
        comboServiceId: combo.id,
        componentServiceId: component.id,
        sortOrder: index + 1,
      })),
    )
  }
}

async function seedServiceAddons(salonId: string, rows: SeedAddonRow[]) {
  const categories = await db
    .select()
    .from(serviceCategories)
    .where(eq(serviceCategories.salonId, salonId))
  const families = await db
    .select()
    .from(serviceFamilies)
    .where(eq(serviceFamilies.salonId, salonId))
  const serviceRows = await db
    .select()
    .from(services)
    .where(eq(services.salonId, salonId))

  const categoryByName = new Map(categories.map((category) => [category.name, category]))
  const familyByPath = new Map(
    families.map((family) => {
      const category = categories.find((item) => item.id === family.categoryId)
      return [`${category?.name ?? ''}/${family.name}`, family] as const
    }),
  )
  const serviceByName = new Map(serviceRows.map((service) => [service.name, service]))

  for (const row of rows) {
    const [existing] = await db
      .select()
      .from(serviceAddons)
      .where(and(eq(serviceAddons.salonId, salonId), eq(serviceAddons.name, row.name)))
      .limit(1)

    const [addon] = existing
      ? await db
          .update(serviceAddons)
          .set({
            priceDelta: row.priceDelta,
            durationDelta: row.durationDelta,
            active: true,
            color: row.color,
            sortOrder: row.sortOrder,
            description: row.description,
            updatedAt: new Date(),
          })
          .where(eq(serviceAddons.id, existing.id))
          .returning()
      : await db
          .insert(serviceAddons)
          .values({
            salonId,
            name: row.name,
            priceDelta: row.priceDelta,
            durationDelta: row.durationDelta,
            active: true,
            color: row.color,
            sortOrder: row.sortOrder,
            description: row.description,
          })
          .returning()

    await db.delete(serviceAddonCategoryScopes).where(eq(serviceAddonCategoryScopes.addonId, addon.id))
    await db.delete(serviceAddonFamilyScopes).where(eq(serviceAddonFamilyScopes.addonId, addon.id))
    await db.delete(serviceAddonServiceScopes).where(eq(serviceAddonServiceScopes.addonId, addon.id))

    const categoryScopes = (row.categoryScopes ?? [])
      .map((name) => categoryByName.get(name))
      .filter((category): category is NonNullable<typeof category> => Boolean(category))
      .map((category) => ({ salonId, addonId: addon.id, scopeId: category.id }))
    if (categoryScopes.length > 0) {
      await db.insert(serviceAddonCategoryScopes).values(categoryScopes).onConflictDoNothing()
    }

    const familyScopes = (row.familyScopes ?? [])
      .map((scope) => familyByPath.get(`${scope.category}/${scope.family}`))
      .filter((family): family is NonNullable<typeof family> => Boolean(family))
      .map((family) => ({ salonId, addonId: addon.id, scopeId: family.id }))
    if (familyScopes.length > 0) {
      await db.insert(serviceAddonFamilyScopes).values(familyScopes).onConflictDoNothing()
    }

    const serviceScopes = (row.serviceScopes ?? [])
      .map((name) => serviceByName.get(name))
      .filter((service): service is NonNullable<typeof service> => Boolean(service))
      .map((service) => ({ salonId, addonId: addon.id, scopeId: service.id }))
    if (serviceScopes.length > 0) {
      await db.insert(serviceAddonServiceScopes).values(serviceScopes).onConflictDoNothing()
    }
  }
}

/** Phones 09129900*** — removed and reinserted each run for retention / today / tags demos. */
async function seedRetentionAndFeaturesDemo(salonId: string) {
  const todayStr = salonYmdTehran()
  const yesterdayStr = addDaysYmd(todayStr, -1)
  const d10 = addDaysYmd(todayStr, -10)
  const d20 = addDaysYmd(todayStr, -20)
  const d45 = addDaysYmd(todayStr, -45)
  const d75 = addDaysYmd(todayStr, -75)

  const existingDemo = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.salonId, salonId), like(clients.phone, '09129900%')))
  const demoIds = existingDemo.map((r) => r.id)
  if (demoIds.length > 0) {
    await db.delete(appointments).where(inArray(appointments.clientId, demoIds))
    await db.delete(clientTags).where(inArray(clientTags.clientId, demoIds))
    await db
      .delete(clientFollowUps)
      .where(inArray(clientFollowUps.clientId, demoIds))
    await db.delete(clients).where(inArray(clients.id, demoIds))
  }

  const manager = await db
    .select()
    .from(users)
    .where(and(eq(users.salonId, salonId), eq(users.role, 'manager')))
    .limit(1)
    .then((r) => r[0])
  const staffOrdered = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.salonId, salonId),
        eq(users.active, true),
        eq(users.role, 'staff'),
      ),
    )
    .orderBy(asc(users.name))
  const staffA =
    staffOrdered.find((staff) => staff.phone === '09120000001') ??
    staffOrdered[0]
  const staffB =
    staffOrdered.find((staff) => staff.phone === '09120000002') ??
    staffOrdered[1]
  if (!manager || !staffA || !staffB) {
    console.warn('Skip feature demo seed: need manager + 2 staff.')
    return
  }

  const svcRows = await db
    .select()
    .from(services)
    .where(eq(services.salonId, salonId))
  const hair = svcRows.find((s) => s.name === 'کوتاهی مو')
  const color = svcRows.find((s) => s.name === 'رنگ کامل مو')
  const manicure = svcRows.find((s) => s.name === 'مانیکور')
  const skincare = svcRows.find((s) => s.name === 'پاکسازی پوست')
  const lash = svcRows.find((s) => s.name === 'اکستنشن کلاسیک مژه')
  if (!hair || !color || !manicure || !skincare || !lash) {
    console.warn('Skip feature demo seed: services missing.')
    return
  }

  const nowMin = hmToMinutes(currentHmTehran())
  let overdueDate = todayStr
  let overdueStart: string
  let overdueEnd: string
  if (nowMin < 120) {
    overdueDate = yesterdayStr
    overdueStart = '15:00'
    overdueEnd = '16:30'
  } else {
    overdueStart = minutesToHm(nowMin - 75)
    overdueEnd = minutesToHm(nowMin - 15)
  }

  let soonStart = minutesToHm(nowMin + 35)
  let soonEnd = minutesToHm(nowMin + 95)
  if (hmToMinutes(soonEnd) > 18 * 60 + 30 || hmToMinutes(soonStart) < 9 * 60) {
    soonStart = '11:00'
    soonEnd = '11:45'
  }

  const demoClientSpecs = [
    {
      phone: '09129900101',
      name: 'دمو غیرفعال',
      notes: '[seed-demo] آخرین مراجعهٔ تکمیل‌شده بیش از ۶۰ روز پیش',
    },
    {
      phone: '09129900102',
      name: 'دمو بدون نوبت دوم',
      notes: '[seed-demo] فقط یک مراجعهٔ انجام‌شده',
    },
    {
      phone: '09129900103',
      name: 'دمو غیبت',
      notes: '[seed-demo] دو غیبت برای پیگیری',
    },
    {
      phone: '09129900104',
      name: 'دمو VIP امروز',
      notes: '[seed-demo] برچسب VIP + نوبت امروز',
    },
    {
      phone: '09129900105',
      name: 'دمو بار اول',
      notes: '[seed-demo] اولین نوبت فقط امروز',
    },
    {
      phone: '09129900106',
      name: 'دمو آمار',
      notes: '[seed-demo] لغو و انجام‌شده',
    },
    {
      phone: '09129900107',
      name: 'دمو ارزشمند',
      notes: '[seed-demo] چند مراجعهٔ پرهزینه',
    },
    {
      phone: '09129900108',
      name: 'دمو پیگیری ردشده',
      notes: '[seed-demo] follow-up dismissed',
    },
  ] as const

  const insertedClients = await db
    .insert(clients)
    .values(demoClientSpecs.map((c) => ({ ...c, salonId })))
    .returning()

  const byPhone = (phone: string) =>
    insertedClients.find((c) => c.phone === phone)!
  const cInactive = byPhone('09129900101')
  const cNewOnly = byPhone('09129900102')
  const cNoShow = byPhone('09129900103')
  const cVipToday = byPhone('09129900104')
  const cFirstToday = byPhone('09129900105')
  const cStats = byPhone('09129900106')
  const cHighValue = byPhone('09129900107')
  const cDismissed = byPhone('09129900108')

  await db.insert(clientTags).values([
    { salonId, clientId: cVipToday.id, label: 'VIP', color: tagColors.VIP },
    {
      salonId,
      clientId: cStats.id,
      label: 'حساسیت',
      color: tagColors['حساسیت'],
    },
    {
      salonId,
      clientId: cHighValue.id,
      label: 'بدقول',
      color: tagColors['بدقول'],
    },
  ])

  const legacyVip = await db
    .select()
    .from(clients)
    .where(and(eq(clients.salonId, salonId), eq(clients.phone, '09121234567')))
    .limit(1)
  if (legacyVip[0]) {
    await db
      .insert(clientTags)
      .values({
        salonId,
        clientId: legacyVip[0].id,
        label: 'VIP',
        color: tagColors.VIP,
      })
      .onConflictDoUpdate({
        target: [clientTags.salonId, clientTags.clientId, clientTags.label],
        set: { color: tagColors.VIP },
      })
  }

  await db.insert(clientFollowUps).values({
    salonId,
    clientId: cDismissed.id,
    reason: 'manual',
    status: 'dismissed',
    dueDate: todayStr,
    reviewedAt: null,
  })

  const aptRows: Array<
    Omit<
      typeof appointments.$inferInsert,
      'bookedServiceName' | 'bookedServiceDuration' | 'bookedServicePrice'
      | 'bookedTotalDuration' | 'bookedTotalPrice'
    >
  > = [
    {
      salonId,
      clientId: cInactive.id,
      staffId: staffA.id,
      serviceId: hair.id,
      date: d75,
      startTime: '10:00',
      endTime: '10:45',
      status: 'completed',
      notes: '[seed-demo]',
      createdByUserId: manager.id,
    },
    {
      salonId,
      clientId: cNewOnly.id,
      staffId: staffB.id,
      serviceId: manicure.id,
      date: d10,
      startTime: '11:00',
      endTime: '11:30',
      status: 'completed',
      notes: '[seed-demo]',
      createdByUserId: manager.id,
    },
    {
      salonId,
      clientId: cNoShow.id,
      staffId: staffA.id,
      serviceId: hair.id,
      date: d20,
      startTime: '09:00',
      endTime: '09:45',
      status: 'no-show',
      notes: '[seed-demo]',
      createdByUserId: manager.id,
    },
    {
      salonId,
      clientId: cNoShow.id,
      staffId: staffB.id,
      serviceId: manicure.id,
      date: d45,
      startTime: '14:00',
      endTime: '14:30',
      status: 'no-show',
      notes: '[seed-demo]',
      createdByUserId: manager.id,
    },
    {
      salonId,
      clientId: cNoShow.id,
      staffId: staffA.id,
      serviceId: skincare.id,
      date: d10,
      startTime: '16:00',
      endTime: '17:00',
      status: 'completed',
      notes: '[seed-demo]',
      createdByUserId: manager.id,
    },
    {
      salonId,
      clientId: cNoShow.id,
      staffId: staffB.id,
      serviceId: hair.id,
      date: todayStr,
      startTime: '13:00',
      endTime: '13:45',
      status: 'scheduled',
      notes: '[seed-demo] سابقهٔ غیبت + نوبت امروز',
      createdByUserId: manager.id,
    },
    {
      salonId,
      clientId: cVipToday.id,
      staffId: staffA.id,
      serviceId: color.id,
      date: todayStr,
      startTime: '12:00',
      endTime: '14:00',
      status: 'scheduled',
      notes: '[seed-demo] VIP امروز',
      createdByUserId: manager.id,
    },
    {
      salonId,
      clientId: cFirstToday.id,
      staffId: staffB.id,
      serviceId: hair.id,
      date: todayStr,
      startTime: soonStart,
      endTime: soonEnd,
      status: 'scheduled',
      notes: '[seed-demo] زمان نسبی برای «نزدیک است»',
      createdByUserId: manager.id,
    },
    {
      salonId,
      clientId: cStats.id,
      staffId: staffA.id,
      serviceId: hair.id,
      date: d20,
      startTime: '10:00',
      endTime: '10:45',
      status: 'completed',
      notes: '[seed-demo]',
      createdByUserId: manager.id,
    },
    {
      salonId,
      clientId: cStats.id,
      staffId: staffB.id,
      serviceId: manicure.id,
      date: d10,
      startTime: '15:00',
      endTime: '15:30',
      status: 'cancelled',
      notes: '[seed-demo]',
      createdByUserId: manager.id,
    },
    {
      salonId,
      clientId: cHighValue.id,
      staffId: staffA.id,
      serviceId: color.id,
      date: addDaysYmd(todayStr, -30),
      startTime: '10:00',
      endTime: '12:00',
      status: 'completed',
      notes: '[seed-demo]',
      createdByUserId: manager.id,
    },
    {
      salonId,
      clientId: cHighValue.id,
      staffId: staffA.id,
      serviceId: color.id,
      date: addDaysYmd(todayStr, -25),
      startTime: '10:00',
      endTime: '12:00',
      status: 'completed',
      notes: '[seed-demo]',
      createdByUserId: manager.id,
    },
    {
      salonId,
      clientId: cHighValue.id,
      staffId: staffB.id,
      serviceId: lash.id,
      date: addDaysYmd(todayStr, -15),
      startTime: '11:00',
      endTime: '12:00',
      status: 'completed',
      notes: '[seed-demo]',
      createdByUserId: manager.id,
    },
    {
      salonId,
      clientId: cHighValue.id,
      staffId: staffB.id,
      serviceId: color.id,
      date: addDaysYmd(todayStr, -5),
      startTime: '09:00',
      endTime: '11:00',
      status: 'completed',
      notes: '[seed-demo]',
      createdByUserId: manager.id,
    },
    {
      salonId,
      clientId: cInactive.id,
      staffId: staffB.id,
      serviceId: skincare.id,
      date: overdueDate,
      startTime: overdueStart,
      endTime: overdueEnd,
      status: 'confirmed',
      notes: '[seed-demo] برای «نیاز به ثبت نتیجه»',
      createdByUserId: manager.id,
    },
  ]

  const servicesById = new Map(svcRows.map((service) => [service.id, service]))
  await db.insert(appointments).values(
    aptRows.map((row) => ({
      ...row,
      ...appointmentSnapshot(servicesById.get(row.serviceId)!),
    })),
  )

  const days = [0, 1, 2, 3, 4, 5, 6] as const
  for (const dayOfWeek of days) {
    const active = dayOfWeek !== 5
    await db
      .insert(staffSchedules)
      .values({
        salonId,
        staffId: staffB.id,
        dayOfWeek,
        workingStart: '09:00',
        workingEnd: '18:00',
        active,
      })
      .onConflictDoUpdate({
        target: [
          staffSchedules.salonId,
          staffSchedules.staffId,
          staffSchedules.dayOfWeek,
        ],
        set: {
          active,
          workingStart: '09:00',
          workingEnd: '18:00',
          updatedAt: new Date(),
        },
      })
  }

  console.log('Feature demo: clients 09129900101–09129900108 refreshed.')
}

async function main() {
  const [primarySalon] = await db
    .insert(salons)
    .values({
      name: 'سالن آراویرا',
      slug: 'aravira',
      phone: '02100000000',
      address: 'تهران',
      timezone: 'Asia/Tehran',
      locale: 'fa-IR',
      status: 'active',
    })
    .onConflictDoUpdate({
      target: salons.slug,
      set: {
        name: 'سالن آراویرا',
        phone: '02100000000',
        address: 'تهران',
        timezone: 'Asia/Tehran',
        locale: 'fa-IR',
        status: 'active',
        updatedAt: new Date(),
      },
    })
    .returning()

  const [secondSalon] = await db
    .insert(salons)
    .values({
      name: 'سالن نیلوفر',
      slug: 'niloufar',
      phone: '02100000001',
      address: 'تهران، سعادت‌آباد',
      timezone: 'Asia/Tehran',
      locale: 'fa-IR',
      status: 'active',
    })
    .onConflictDoUpdate({
      target: salons.slug,
      set: {
        name: 'سالن نیلوفر',
        phone: '02100000001',
        address: 'تهران، سعادت‌آباد',
        timezone: 'Asia/Tehran',
        locale: 'fa-IR',
        status: 'active',
        updatedAt: new Date(),
      },
    })
    .returning()

  // Repair early local seeds that were inserted without the leading zero.
  await db
    .update(users)
    .set({ phone: '09120000000' })
    .where(eq(users.phone, '9120000000'))
  await db
    .update(users)
    .set({ phone: '09120000001' })
    .where(eq(users.phone, '9120000001'))
  await db
    .update(users)
    .set({ phone: '09120000002' })
    .where(eq(users.phone, '9120000002'))

  await db
    .insert(businessSettings)
    .values({
      salonId: primarySalon.id,
      workingStart: '09:00',
      workingEnd: '19:00',
      slotDurationMinutes: 30,
    })
    .onConflictDoUpdate({
      target: businessSettings.salonId,
      set: {
        workingStart: '09:00',
        workingEnd: '19:00',
        slotDurationMinutes: 30,
      },
    })

  await db
    .insert(businessSettings)
    .values({
      salonId: secondSalon.id,
      workingStart: '10:00',
      workingEnd: '18:00',
      slotDurationMinutes: 30,
    })
    .onConflictDoUpdate({
      target: businessSettings.salonId,
      set: {
        workingStart: '10:00',
        workingEnd: '18:00',
        slotDurationMinutes: 30,
      },
    })

  const [primaryLocation] = await db
    .insert(locations)
    .values({
      salonId: primarySalon.id,
      name: 'شعبه اصلی',
      address: 'تهران',
      phone: '02100000000',
      active: true,
    })
    .onConflictDoUpdate({
      target: [locations.salonId, locations.name],
      set: {
        address: 'تهران',
        phone: '02100000000',
        active: true,
        updatedAt: new Date(),
      },
    })
    .returning()

  const [secondLocation] = await db
    .insert(locations)
    .values({
      salonId: secondSalon.id,
      name: 'شعبه اصلی',
      address: 'تهران، سعادت‌آباد',
      phone: '02100000001',
      active: true,
    })
    .onConflictDoUpdate({
      target: [locations.salonId, locations.name],
      set: {
        address: 'تهران، سعادت‌آباد',
        phone: '02100000001',
        active: true,
        updatedAt: new Date(),
      },
    })
    .returning()

  await db
    .insert(resources)
    .values([
      {
        salonId: primarySalon.id,
        locationId: primaryLocation.id,
        name: 'اتاق رنگ',
        type: 'room',
        active: true,
      },
      {
        salonId: primarySalon.id,
        locationId: primaryLocation.id,
        name: 'صندلی شماره ۱',
        type: 'chair',
        active: true,
      },
      {
        salonId: secondSalon.id,
        locationId: secondLocation.id,
        name: 'صندلی شماره ۱',
        type: 'chair',
        active: true,
      },
    ])
    .onConflictDoNothing()

  await seedServiceCatalog(primarySalon.id, primarySeedServices)
  await seedServiceCombos(primarySalon.id, primarySeedCombos)
  await seedServiceAddons(primarySalon.id, primarySeedAddons)

  const [{ value: userCount }] = await db
    .select({ value: count() })
    .from(users)
    .where(eq(users.salonId, primarySalon.id))
  if (userCount === 0) {
    await db.insert(users).values([
      {
        salonId: primarySalon.id,
        name: 'مدیر سالن',
        phone: '09120000000',
        passwordHash,
        role: 'manager',
        color: 'gold',
        active: true,
      },
      {
        salonId: primarySalon.id,
        name: 'نیلوفر کاظمی',
        phone: '09120000001',
        passwordHash,
        role: 'staff',
        color: 'coral',
        active: true,
      },
      {
        salonId: primarySalon.id,
        name: 'مریم احمدی',
        phone: '09120000002',
        passwordHash,
        role: 'staff',
        color: 'rose',
        active: true,
      },
    ])
  }

  /** Extra demo staff (idempotent) — only one service for autofill smoke tests. */
  const [existingSara] = await db
    .select()
    .from(users)
    .where(eq(users.phone, '09120000003'))
    .limit(1)
  if (!existingSara) {
    await db.insert(users).values({
      salonId: primarySalon.id,
      name: 'سارا محمودی',
      phone: '09120000003',
      passwordHash,
      role: 'staff',
      color: 'violet',
      active: true,
    })
  }

  const [existingElham] = await db
    .select()
    .from(users)
    .where(eq(users.phone, '09120000004'))
    .limit(1)
  if (!existingElham) {
    await db.insert(users).values({
      salonId: primarySalon.id,
      name: 'الهام رضایی',
      phone: '09120000004',
      passwordHash,
      role: 'staff',
      color: 'mint',
      active: true,
    })
  }

  const clientRows = [
    { name: 'زهرا کریمی', phone: '09121234567', notes: 'مشتری ثابت' },
    { name: 'نازنین حسینی', phone: '09122345678', notes: null },
    {
      name: 'مهسا علیزاده',
      phone: '09123456789',
      notes: 'ترجیح می‌دهد عصر مراجعه کند',
    },
    { name: 'سمیرا باقری', phone: '09124567890', notes: null },
    { name: 'الهام نوری', phone: '09125678901', notes: 'حساسیت به رنگ' },
  ]

  const [{ value: clientCount }] = await db
    .select({ value: count() })
    .from(clients)
    .where(eq(clients.salonId, primarySalon.id))
  if (clientCount === 0) {
    await db
      .insert(clients)
      .values(clientRows.map((row) => ({ ...row, salonId: primarySalon.id })))
  }

  const allUsers = await db
    .select()
    .from(users)
    .where(eq(users.salonId, primarySalon.id))
  const allServices = await db
    .select()
    .from(services)
    .where(eq(services.salonId, primarySalon.id))
  const allClients = await db
    .select()
    .from(clients)
    .where(eq(clients.salonId, primarySalon.id))

  const manager = allUsers.find((u) => u.role === 'manager')
  const staffUsersOrdered = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.salonId, primarySalon.id),
        eq(users.active, true),
        eq(users.role, 'staff'),
      ),
    )
    .orderBy(asc(users.name))
  const staffHair = staffUsersOrdered.find(
    (staff) => staff.phone === '09120000001',
  )
  const staffNails = staffUsersOrdered.find(
    (staff) => staff.phone === '09120000002',
  )
  const staffSkin = staffUsersOrdered.find(
    (staff) => staff.phone === '09120000003',
  )
  const staffLashBrow = staffUsersOrdered.find(
    (staff) => staff.phone === '09120000004',
  )
  const staffA = staffHair
  const staffB = staffNails

  /** Full-week hours so calendar bookings on any weekday match E2E + demo (UTC weekday from YYYY-MM-DD). */
  const primaryWeek = [0, 1, 2, 3, 4, 5, 6] as const
  for (const member of staffUsersOrdered) {
    for (const dayOfWeek of primaryWeek) {
      await db
        .insert(staffSchedules)
        .values({
          salonId: primarySalon.id,
          staffId: member.id,
          dayOfWeek,
          workingStart: '09:00',
          workingEnd: '18:00',
          active: true,
        })
        .onConflictDoUpdate({
          target: [
            staffSchedules.salonId,
            staffSchedules.staffId,
            staffSchedules.dayOfWeek,
          ],
          set: {
            active: true,
            workingStart: '09:00',
            workingEnd: '18:00',
            updatedAt: new Date(),
          },
        })
    }
  }

  const serviceByName = new Map(
    allServices.map((service) => [service.name, service]),
  )
  const servicesFor = (names: string[]) =>
    names
      .map((name) => serviceByName.get(name))
      .filter(
        (
          service,
        ): service is NonNullable<ReturnType<typeof serviceByName.get>> =>
          Boolean(service),
      )

  const specialistStaff = [
    staffHair,
    staffNails,
    staffSkin,
    staffLashBrow,
  ].filter((staff): staff is NonNullable<typeof staffHair> => Boolean(staff))
  if (specialistStaff.length > 0) {
    await db.delete(staffServices).where(
      and(
        eq(staffServices.salonId, primarySalon.id),
        inArray(
          staffServices.staffUserId,
          specialistStaff.map((staff) => staff.id),
        ),
      ),
    )
  }

  const specialistAssignments = [
    {
      staff: staffHair,
      services: servicesFor([
        'کوتاهی مو',
        'براشینگ مو',
        'شینیون',
        'رنگ ریشه',
        'رنگ کامل مو',
        'مش و هایلایت',
        'آمبره و بالیاژ',
        'کراتین مو',
        'پروتئین تراپی مو',
      ]),
    },
    {
      staff: staffNails,
      services: servicesFor([
        'کاشت پودری',
        'کاشت ژل',
        'ترمیم کاشت',
        'مانیکور',
        'پدیکور',
        'لاک ژل دست',
        'لاک ژل پا',
      ]),
    },
    {
      staff: staffSkin,
      services: servicesFor([
        'فیشیال صورت',
        'پاکسازی پوست',
        'آبرسانی پوست',
        'وکس صورت',
        'اپیلاسیون بدن',
      ]),
    },
    {
      staff: staffLashBrow,
      services: servicesFor([
        'اکستنشن کلاسیک مژه',
        'اکستنشن والیوم مژه',
        'ترمیم اکستنشن مژه',
        'لیفت و لمینت مژه',
        'اصلاح صورت و ابرو',
        'رنگ ابرو',
        'لیفت ابرو',
        'فیبروز ابرو',
        'میکروبلیدینگ ابرو',
        'بن مژه',
        'خط چشم دائم',
        'شیدینگ لب',
        'ریموو تاتو',
      ]),
    },
  ]
  const staffServiceRows = specialistAssignments.flatMap(
    ({ staff, services: assignedServices }) =>
      staff
        ? assignedServices.map((service) => ({
            salonId: primarySalon.id,
            staffUserId: staff.id,
            serviceId: service.id,
          }))
        : [],
  )
  if (staffServiceRows.length > 0) {
    await db
      .insert(staffServices)
      .values(staffServiceRows)
      .onConflictDoNothing()
  }

  const hairService = allServices.find((s) => s.name === 'کوتاهی مو')
  const colorService = allServices.find((s) => s.name === 'رنگ کامل مو')
  const manicureService = allServices.find((s) => s.name === 'مانیکور')
  const skincareService = allServices.find((s) => s.name === 'پاکسازی پوست')

  const today = new Date()
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)

  const [{ value: appointmentCount }] = await db
    .select({ value: count() })
    .from(appointments)
    .where(eq(appointments.salonId, primarySalon.id))
  if (
    appointmentCount === 0 &&
    manager &&
    staffA &&
    staffB &&
    staffSkin &&
    hairService &&
    colorService &&
    manicureService &&
    skincareService &&
    allClients.length >= 4
  ) {
    await db.insert(appointments).values([
      {
        salonId: primarySalon.id,
        clientId: allClients[0].id,
        staffId: staffA.id,
        serviceId: hairService.id,
        ...appointmentSnapshot(hairService),
        date: formatDate(today),
        startTime: '09:00',
        endTime: '09:45',
        status: 'confirmed',
        notes: 'کوتاهی کلاسیک',
        createdByUserId: manager.id,
      },
      {
        salonId: primarySalon.id,
        clientId: allClients[1].id,
        staffId: staffB.id,
        serviceId: manicureService.id,
        ...appointmentSnapshot(manicureService),
        date: formatDate(today),
        startTime: '10:00',
        endTime: '10:30',
        status: 'scheduled',
        notes: null,
        createdByUserId: manager.id,
      },
      {
        salonId: primarySalon.id,
        clientId: allClients[2].id,
        staffId: staffA.id,
        serviceId: colorService.id,
        ...appointmentSnapshot(colorService),
        date: formatDate(today),
        startTime: '14:00',
        endTime: '16:00',
        status: 'scheduled',
        notes: 'رنگ کامل',
        createdByUserId: manager.id,
      },
      {
        salonId: primarySalon.id,
        clientId: allClients[3].id,
        staffId: staffSkin.id,
        serviceId: skincareService.id,
        ...appointmentSnapshot(skincareService),
        date: formatDate(tomorrow),
        startTime: '11:00',
        endTime: '12:00',
        status: 'confirmed',
        notes: null,
        createdByUserId: manager.id,
      },
    ])
  }

  const [{ value: secondUserCount }] = await db
    .select({ value: count() })
    .from(users)
    .where(eq(users.salonId, secondSalon.id))
  if (secondUserCount === 0) {
    await db.insert(users).values({
      salonId: secondSalon.id,
      name: 'مدیر نیلوفر',
      phone: '09130000000',
      passwordHash,
      role: 'manager',
      color: 'gold',
      active: true,
    })
  }

  await seedServiceCatalog(secondSalon.id, secondSalonSeedServices)

  const [{ value: secondClientCount }] = await db
    .select({ value: count() })
    .from(clients)
    .where(eq(clients.salonId, secondSalon.id))
  if (secondClientCount === 0) {
    await db.insert(clients).values({
      salonId: secondSalon.id,
      name: 'مشتری نیلوفر',
      phone: '09121234567',
      notes: 'شماره تکراری در سالن دیگر برای تست unique per salon',
    })
  }

  await seedCatalogPresets(db)

  await seedRetentionAndFeaturesDemo(primarySalon.id)

  console.log('Seed complete.')
  console.log('Manager: 09120000000 / admin123')
  console.log('Second salon manager: 09130000000 / admin123')
  console.log(
    'Staff: 09120000001, 09120000002, 09120000003, 09120000004 / admin123',
  )
  console.log(
    'Staff specialties: hair, nails, skin/epilation, lashes/brows/permanent makeup.',
  )
  await client.end()
}

main().catch(async (e) => {
  console.error(e)
  await client.end({ timeout: 1 })
  process.exit(1)
})
