/**
 * Seeds the catalog presets table. These presets mirror common Iranian salon
 * service lines so managers can start from a realistic دسته -> خدمت tree.
 */
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

import {
  normalizeCatalogPresetTree,
  type CatalogPresetTree,
} from '@repo/salon-core/forms/catalog-preset'

import { catalogPresets } from '../schema'

type CatalogPresetSeed = {
  slug: string
  name: string
  description: string
  tree: CatalogPresetTree
  sortOrder: number
}

const catalogPresetSeeds: CatalogPresetSeed[] = [
  {
    slug: 'full-service-women',
    name: 'سالن کامل بانوان',
    description: 'پوشش پایه برای سالن‌های چندلاین: مو، ناخن، پوست، مژه و ابرو.',
    sortOrder: 10,
    tree: normalizeCatalogPresetTree([
      {
        name: 'مو',
        families: [
          {
            name: 'کوتاهی و براشینگ',
            variants: [
              {
                name: 'کوتاهی مو',
                duration: 45,
                price: 450_000,
                color: 'coral',
              },
              {
                name: 'براشینگ مو',
                duration: 45,
                price: 500_000,
                color: 'gold',
              },
              {
                name: 'شینیون ساده',
                duration: 90,
                price: 1_400_000,
                color: 'rose',
              },
            ],
          },
          {
            name: 'رنگ و لایت',
            variants: [
              {
                name: 'رنگ ریشه',
                duration: 90,
                price: 900_000,
                color: 'violet',
              },
              {
                name: 'رنگ کامل مو',
                duration: 150,
                price: 1_800_000,
                color: 'rose',
              },
              {
                name: 'آمبره و بالیاژ',
                duration: 240,
                price: 4_500_000,
                color: 'mint',
              },
            ],
          },
          {
            name: 'صافی و احیا',
            variants: [
              {
                name: 'کراتینه مو',
                duration: 180,
                price: 3_500_000,
                color: 'gold',
              },
              {
                name: 'پروتئین تراپی مو',
                duration: 150,
                price: 2_800_000,
                color: 'mint',
              },
            ],
          },
        ],
      },
      {
        name: 'ناخن',
        families: [
          {
            name: 'مانیکور و پدیکور',
            variants: [
              { name: 'مانیکور', duration: 45, price: 450_000, color: 'coral' },
              { name: 'پدیکور', duration: 60, price: 650_000, color: 'gold' },
              {
                name: 'ژلیش ناخن',
                duration: 60,
                price: 700_000,
                color: 'rose',
              },
            ],
          },
          {
            name: 'کاشت و ترمیم',
            variants: [
              {
                name: 'کاشت پودری',
                duration: 150,
                price: 1_800_000,
                color: 'violet',
              },
              {
                name: 'کاشت ژل',
                duration: 150,
                price: 2_000_000,
                color: 'mint',
              },
              {
                name: 'ترمیم کاشت',
                duration: 90,
                price: 1_100_000,
                color: 'coral',
              },
            ],
          },
        ],
      },
      {
        name: 'پوست',
        families: [
          {
            name: 'فیشیال و پاکسازی',
            variants: [
              {
                name: 'پاکسازی پوست',
                duration: 60,
                price: 750_000,
                color: 'coral',
              },
              {
                name: 'فیشیال تخصصی',
                duration: 90,
                price: 1_500_000,
                color: 'mint',
              },
              {
                name: 'آبرسانی پوست',
                duration: 45,
                price: 650_000,
                color: 'gold',
              },
            ],
          },
        ],
      },
      {
        name: 'مژه و ابرو',
        families: [
          {
            name: 'لیفت و لمینت',
            variants: [
              { name: 'لیفت مژه', duration: 60, price: 850_000, color: 'rose' },
              {
                name: 'لمینت ابرو',
                duration: 45,
                price: 650_000,
                color: 'gold',
              },
            ],
          },
          {
            name: 'اکستنشن و اصلاح',
            variants: [
              {
                name: 'اکستنشن مژه کلاسیک',
                duration: 120,
                price: 1_600_000,
                color: 'violet',
              },
              {
                name: 'اصلاح صورت و ابرو',
                duration: 30,
                price: 350_000,
                color: 'coral',
              },
            ],
          },
        ],
      },
    ]),
  },
  {
    slug: 'hair-specialist',
    name: 'لاین تخصصی مو',
    description:
      'برای سالن‌هایی که روی کوتاهی، رنگ، لایت، صافی و احیای مو تمرکز دارند.',
    sortOrder: 20,
    tree: normalizeCatalogPresetTree([
      {
        name: 'مو',
        families: [
          {
            name: 'کوتاهی و حالت‌دهی',
            variants: [
              {
                name: 'کوتاهی مو',
                duration: 45,
                price: 450_000,
                color: 'coral',
              },
              {
                name: 'کوتاهی تخصصی',
                duration: 60,
                price: 800_000,
                color: 'rose',
              },
              {
                name: 'براشینگ مو',
                duration: 45,
                price: 500_000,
                color: 'gold',
              },
              {
                name: 'شینیون مجلسی',
                duration: 120,
                price: 2_200_000,
                color: 'violet',
              },
            ],
          },
          {
            name: 'رنگ و دکلره',
            variants: [
              {
                name: 'رنگ ریشه',
                duration: 90,
                price: 900_000,
                color: 'violet',
              },
              {
                name: 'رنگ کامل مو',
                duration: 150,
                price: 1_800_000,
                color: 'rose',
              },
              {
                name: 'مش و هایلایت',
                duration: 210,
                price: 3_800_000,
                color: 'gold',
              },
              {
                name: 'آمبره و بالیاژ',
                duration: 240,
                price: 4_500_000,
                color: 'mint',
              },
            ],
          },
          {
            name: 'صافی و احیا',
            variants: [
              {
                name: 'کراتینه مو',
                duration: 180,
                price: 3_500_000,
                color: 'gold',
              },
              {
                name: 'پروتئین تراپی مو',
                duration: 150,
                price: 2_800_000,
                color: 'mint',
              },
              {
                name: 'بوتاکس مو',
                duration: 150,
                price: 2_600_000,
                color: 'coral',
              },
            ],
          },
          {
            name: 'اکستنشن مو',
            variants: [
              {
                name: 'مشاوره اکستنشن مو',
                duration: 30,
                price: 250_000,
                color: 'rose',
              },
              {
                name: 'نصب اکستنشن مو',
                duration: 180,
                price: 3_500_000,
                color: 'violet',
              },
              {
                name: 'ترمیم اکستنشن مو',
                duration: 120,
                price: 2_000_000,
                color: 'mint',
              },
            ],
          },
        ],
      },
    ]),
  },
  {
    slug: 'nail-studio',
    name: 'استودیو ناخن',
    description: 'مانیکور، پدیکور، ژلیش، کاشت، ترمیم و طراحی ناخن.',
    sortOrder: 30,
    tree: normalizeCatalogPresetTree([
      {
        name: 'ناخن',
        families: [
          {
            name: 'مانیکور و پدیکور',
            variants: [
              {
                name: 'مانیکور روسی',
                duration: 60,
                price: 650_000,
                color: 'coral',
              },
              {
                name: 'پدیکور خشک',
                duration: 60,
                price: 700_000,
                color: 'gold',
              },
              {
                name: 'پدیکور درمانی',
                duration: 90,
                price: 1_100_000,
                color: 'mint',
              },
            ],
          },
          {
            name: 'ژلیش و لمینت',
            variants: [
              {
                name: 'ژلیش ناخن دست',
                duration: 60,
                price: 700_000,
                color: 'rose',
              },
              {
                name: 'ژلیش ناخن پا',
                duration: 60,
                price: 650_000,
                color: 'gold',
              },
              {
                name: 'لمینت ناخن',
                duration: 75,
                price: 950_000,
                color: 'violet',
              },
            ],
          },
          {
            name: 'کاشت و ترمیم',
            variants: [
              {
                name: 'کاشت پودری',
                duration: 150,
                price: 1_800_000,
                color: 'violet',
              },
              {
                name: 'کاشت ژل',
                duration: 150,
                price: 2_000_000,
                color: 'mint',
              },
              {
                name: 'پلی ژل',
                duration: 135,
                price: 1_900_000,
                color: 'rose',
              },
              {
                name: 'ترمیم کاشت',
                duration: 90,
                price: 1_100_000,
                color: 'coral',
              },
              {
                name: 'ریموو کاشت',
                duration: 45,
                price: 450_000,
                color: 'gold',
              },
            ],
          },
          {
            name: 'دیزاین',
            variants: [
              {
                name: 'طراحی ساده ناخن',
                duration: 30,
                price: 350_000,
                color: 'rose',
              },
              {
                name: 'فرنچ ناخن',
                duration: 30,
                price: 400_000,
                color: 'violet',
              },
            ],
          },
        ],
      },
    ]),
  },
  {
    slug: 'skin-facial',
    name: 'کلینیک پوست و فیشیال',
    description:
      'خدمات غیرپزشکی پوست برای سالن‌ها: پاکسازی، فیشیال، آبرسانی و مراقبت.',
    sortOrder: 40,
    tree: normalizeCatalogPresetTree([
      {
        name: 'پوست',
        families: [
          {
            name: 'پاکسازی و فیشیال',
            variants: [
              {
                name: 'پاکسازی پایه پوست',
                duration: 60,
                price: 750_000,
                color: 'coral',
              },
              {
                name: 'فیشیال تخصصی',
                duration: 90,
                price: 1_500_000,
                color: 'mint',
              },
              {
                name: 'فیشیال ضدجوش',
                duration: 90,
                price: 1_400_000,
                color: 'violet',
              },
            ],
          },
          {
            name: 'آبرسانی و جوانسازی',
            variants: [
              {
                name: 'آبرسانی پوست',
                duration: 45,
                price: 650_000,
                color: 'gold',
              },
              {
                name: 'ماسک تخصصی صورت',
                duration: 45,
                price: 550_000,
                color: 'rose',
              },
              {
                name: 'ماساژ صورت',
                duration: 30,
                price: 450_000,
                color: 'mint',
              },
            ],
          },
          {
            name: 'مراقبت تکمیلی',
            variants: [
              {
                name: 'درماپلنینگ',
                duration: 45,
                price: 850_000,
                color: 'coral',
              },
              {
                name: 'مراقبت دور چشم',
                duration: 30,
                price: 450_000,
                color: 'gold',
              },
            ],
          },
        ],
      },
    ]),
  },
  {
    slug: 'lash-brow',
    name: 'لاین مژه و ابرو',
    description: 'لیفت، لمینت، اکستنشن، اصلاح و تکنیک‌های رایج فرم‌دهی ابرو.',
    sortOrder: 50,
    tree: normalizeCatalogPresetTree([
      {
        name: 'مژه و ابرو',
        families: [
          {
            name: 'مژه',
            variants: [
              { name: 'لیفت مژه', duration: 60, price: 850_000, color: 'rose' },
              {
                name: 'لمینت مژه',
                duration: 75,
                price: 1_000_000,
                color: 'gold',
              },
              {
                name: 'اکستنشن مژه کلاسیک',
                duration: 120,
                price: 1_600_000,
                color: 'violet',
              },
              {
                name: 'ترمیم اکستنشن مژه',
                duration: 75,
                price: 900_000,
                color: 'mint',
              },
              {
                name: 'ریموو اکستنشن مژه',
                duration: 30,
                price: 350_000,
                color: 'coral',
              },
            ],
          },
          {
            name: 'ابرو',
            variants: [
              {
                name: 'اصلاح ابرو',
                duration: 20,
                price: 250_000,
                color: 'coral',
              },
              {
                name: 'لیفت ابرو',
                duration: 45,
                price: 650_000,
                color: 'rose',
              },
              {
                name: 'لمینت ابرو',
                duration: 45,
                price: 650_000,
                color: 'gold',
              },
              {
                name: 'رنگ ابرو',
                duration: 30,
                price: 350_000,
                color: 'violet',
              },
            ],
          },
          {
            name: 'آرایش دائم',
            variants: [
              {
                name: 'مشاوره میکروبلیدینگ',
                duration: 30,
                price: 300_000,
                color: 'mint',
              },
              {
                name: 'بن مژه',
                duration: 120,
                price: 1_800_000,
                color: 'violet',
              },
            ],
          },
        ],
      },
    ]),
  },
  {
    slug: 'makeup-bridal',
    name: 'میکاپ و عروس',
    description: 'برای سالن‌های میکاپ، شینیون، عروس و آماده‌سازی مراسم.',
    sortOrder: 60,
    tree: normalizeCatalogPresetTree([
      {
        name: 'میکاپ و عروس',
        families: [
          {
            name: 'میکاپ',
            variants: [
              {
                name: 'میکاپ مهمانی',
                duration: 90,
                price: 1_800_000,
                color: 'rose',
              },
              {
                name: 'میکاپ حرفه‌ای',
                duration: 120,
                price: 2_800_000,
                color: 'violet',
              },
              {
                name: 'میکاپ عروس',
                duration: 180,
                price: 8_000_000,
                color: 'gold',
              },
            ],
          },
          {
            name: 'آماده‌سازی عروس',
            variants: [
              {
                name: 'مشاوره عروس',
                duration: 45,
                price: 500_000,
                color: 'mint',
              },
              {
                name: 'تست میکاپ عروس',
                duration: 120,
                price: 2_500_000,
                color: 'coral',
              },
              {
                name: 'پکیج عروس',
                duration: 300,
                price: 14_000_000,
                color: 'gold',
              },
            ],
          },
        ],
      },
      {
        name: 'مو',
        families: [
          {
            name: 'شینیون',
            variants: [
              {
                name: 'شینیون ساده',
                duration: 90,
                price: 1_400_000,
                color: 'rose',
              },
              {
                name: 'شینیون مجلسی',
                duration: 120,
                price: 2_200_000,
                color: 'violet',
              },
              {
                name: 'شینیون عروس',
                duration: 180,
                price: 4_500_000,
                color: 'gold',
              },
            ],
          },
        ],
      },
    ]),
  },
  {
    slug: 'spa-waxing',
    name: 'اسپا، وکس و بدن',
    description: 'اسپا و خدمات بدن شامل ماساژ، وکس و مراقبت‌های آرامش‌بخش.',
    sortOrder: 70,
    tree: normalizeCatalogPresetTree([
      {
        name: 'اسپا',
        families: [
          {
            name: 'ماساژ',
            variants: [
              {
                name: 'ماساژ ریلکس',
                duration: 60,
                price: 1_200_000,
                color: 'mint',
              },
              {
                name: 'ماساژ صورت و گردن',
                duration: 30,
                price: 600_000,
                color: 'gold',
              },
              {
                name: 'ماساژ سر و شانه',
                duration: 30,
                price: 550_000,
                color: 'coral',
              },
            ],
          },
          {
            name: 'مراقبت بدن',
            variants: [
              {
                name: 'اسکراب بدن',
                duration: 60,
                price: 1_000_000,
                color: 'rose',
              },
              {
                name: 'ماساژ پا',
                duration: 30,
                price: 500_000,
                color: 'violet',
              },
            ],
          },
        ],
      },
      {
        name: 'اصلاح و وکس',
        families: [
          {
            name: 'اصلاح صورت',
            variants: [
              {
                name: 'اصلاح صورت با بند',
                duration: 30,
                price: 300_000,
                color: 'coral',
              },
              { name: 'وکس صورت', duration: 30, price: 400_000, color: 'gold' },
            ],
          },
          {
            name: 'وکس بدن',
            variants: [
              { name: 'وکس دست', duration: 30, price: 450_000, color: 'rose' },
              { name: 'وکس پا', duration: 45, price: 650_000, color: 'violet' },
            ],
          },
        ],
      },
    ]),
  },
]

type AnyDrizzle = PostgresJsDatabase<Record<string, unknown>>

export async function seedCatalogPresets(db: AnyDrizzle): Promise<void> {
  for (const preset of catalogPresetSeeds) {
    await db
      .insert(catalogPresets)
      .values({
        slug: preset.slug,
        name: preset.name,
        description: preset.description,
        tree: preset.tree,
        sortOrder: preset.sortOrder,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: catalogPresets.slug,
        set: {
          name: preset.name,
          description: preset.description,
          tree: preset.tree,
          sortOrder: preset.sortOrder,
          isActive: true,
          updatedAt: new Date(),
        },
      })
  }
}
