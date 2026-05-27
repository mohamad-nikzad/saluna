/**
 * Seeds the catalog presets table. Runs after `db:push`, before the main seed
 * (or alongside it). One placeholder preset for now: `قالب عمومی`.
 */
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

import {
  presetTreeSchema,
  type CatalogPresetTree,
} from '@repo/salon-core/forms/catalog-preset'

import { catalogPresets } from '../schema'

const generalTree: CatalogPresetTree = presetTreeSchema.parse([
  {
    name: 'مو',
    families: [
      {
        name: 'کوتاهی و براشینگ',
        variants: [
          { name: 'کوتاهی مو', duration: 45, price: 450_000, color: 'coral' },
          { name: 'براشینگ مو', duration: 45, price: 500_000, color: 'gold' },
        ],
      },
      {
        name: 'رنگ و لایت',
        variants: [
          { name: 'رنگ ریشه', duration: 90, price: 900_000, color: 'violet' },
          { name: 'رنگ کامل مو', duration: 150, price: 1_800_000, color: 'rose' },
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
        ],
      },
    ],
  },
  {
    name: 'پوست',
    families: [
      {
        name: 'فیشیال و مراقبت',
        variants: [
          { name: 'پاکسازی پوست', duration: 60, price: 750_000, color: 'coral' },
          { name: 'آبرسانی پوست', duration: 45, price: 650_000, color: 'gold' },
        ],
      },
    ],
  },
  {
    name: 'اسپا',
    families: [
      {
        name: 'ماساژ و آرامش',
        variants: [
          { name: 'ماساژ ریلکس', duration: 60, price: 1_200_000, color: 'mint' },
        ],
      },
    ],
  },
])

type AnyDrizzle = PostgresJsDatabase<Record<string, unknown>>

export async function seedCatalogPresets(db: AnyDrizzle): Promise<void> {
  await db
    .insert(catalogPresets)
    .values({
      slug: 'general',
      name: 'قالب عمومی',
      description: 'مجموعهٔ پایه‌ای از دسته‌ها، گروه‌ها و خدمات رایج سالن‌های زیبایی.',
      tree: generalTree,
      sortOrder: 0,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: catalogPresets.slug,
      set: {
        name: 'قالب عمومی',
        description:
          'مجموعهٔ پایه‌ای از دسته‌ها، گروه‌ها و خدمات رایج سالن‌های زیبایی.',
        tree: generalTree,
        sortOrder: 0,
        isActive: true,
        updatedAt: new Date(),
      },
    })
}

