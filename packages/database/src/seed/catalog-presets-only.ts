/**
 * Production-safe seed: upserts global catalog presets only (no salons, users, or demo data).
 *
 *   pnpm db:seed:catalog-presets
 *
 * On the VPS (inside the api image):
 *
 *   docker compose --env-file .env.production -f docker-compose.prod.yml run --rm api \
 *     sh -c 'cd /app && pnpm db:seed:catalog-presets'
 */
import { getDb } from '../client'
import { seedCatalogPresets } from './catalog-presets'

async function main() {
  await seedCatalogPresets(getDb())
  console.log('Catalog presets seeded.')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
