import { createDialect as createPostgresDialect } from 'emdash/db/postgres'

/** EmDash's config is bundled by Astro; only this runtime reads CMS secrets. */
export function createDialect() {
  const connectionString = process.env.CMS_DATABASE_URL
  if (!connectionString) throw new Error('CMS_DATABASE_URL is required')
  let url
  try {
    url = new URL(connectionString)
  } catch {
    throw new Error('CMS_DATABASE_URL must be a Postgres URL')
  }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    url.username !== 'saluna_cms' ||
    url.pathname !== '/saluna_cms'
  ) {
    throw new Error(
      'CMS_DATABASE_URL must use the saluna_cms role and database',
    )
  }
  if (!process.env.EMDASH_ENCRYPTION_KEY) {
    throw new Error('EMDASH_ENCRYPTION_KEY is required')
  }
  return createPostgresDialect({
    connectionString,
    pool: { max: 5, connectionTimeoutMillis: 5000 },
  })
}
