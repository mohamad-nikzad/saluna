/** Seed only the isolated QA database. Never load a developer's root env file. */
const dbUrl = new URL(
  process.env.DATABASE_URL || 'postgresql://invalid/invalid',
)
if (
  process.env.SALUNA_ENVIRONMENT !== 'qa' ||
  dbUrl.pathname !== '/saluna_qa' ||
  dbUrl.username !== 'saluna_qa' ||
  !['postgres', '127.0.0.1', 'localhost'].includes(dbUrl.hostname) ||
  (process.env.DATABASE_URL_DIRECT &&
    process.env.DATABASE_URL_DIRECT !== process.env.DATABASE_URL) ||
  !process.env.QA_SEED_PASSWORD ||
  process.env.QA_SEED_PASSWORD.length < 20 ||
  [
    'SMS_ENABLED',
    'BALE_ENABLED',
    'BALE_SAFIR_ENABLED',
    'TELEGRAM_ENABLED',
  ].some((key) => process.env[key] !== 'false')
) {
  throw new Error(
    'QA seed requires the isolated saluna_qa database, a random password, and disabled delivery.',
  )
}
process.env.SEED_PASSWORD = process.env.QA_SEED_PASSWORD
void import('./db-seed')
