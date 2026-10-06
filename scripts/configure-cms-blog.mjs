import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Apply Saluna's model through an authenticated CMS administrator account.
 * Existing article data and author profiles are never replaced. This also
 * works on sites initialized before the Blog Article seed was introduced.
 */
export async function configureCmsBlog({ url, token }) {
  if (!url || !token)
    throw new Error('EMDASH_URL and EMDASH_API_TOKEN are required')
  const base = new URL(url)
  if (
    base.protocol !== 'https:' &&
    !['localhost', '127.0.0.1'].includes(base.hostname)
  ) {
    throw new Error('Use HTTPS for remote CMS configuration')
  }
  const seed = JSON.parse(
    await readFile(
      new URL('../apps/web/cms/seed.json', import.meta.url),
      'utf8',
    ),
  )
  async function api(path, body, method = body === undefined ? 'GET' : 'POST') {
    const response = await fetch(new URL(`/_emdash/api/${path}`, base), {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-EmDash-Request': '1',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    const result = await response.json()
    if (!response.ok || !result.success)
      throw new Error(
        `CMS configuration ${method} ${path} failed: ${response.status}`,
      )
    return result.data
  }
  const existing = (await api('schema/collections')).items
  for (const { fields, ...collection } of seed.collections) {
    const path = `schema/collections/${collection.slug}`
    if (existing.some((item) => item.slug === collection.slug)) {
      const { slug: _, ...settings } = collection
      await api(path, settings, 'PUT')
    } else {
      await api('schema/collections', collection)
    }
    const currentFields = (await api(`${path}/fields`)).items
    for (const field of fields) {
      const current = currentFields.find((item) => item.slug === field.slug)
      if (current) {
        if (current.type !== field.type)
          throw new Error(
            `Field ${collection.slug}.${field.slug} needs an explicit type migration`,
          )
        const { slug: _, type: __, ...settings } = field
        await api(`${path}/fields/${field.slug}`, settings, 'PUT')
      } else {
        await api(`${path}/fields`, field)
      }
    }
  }
  for (const { id: _, ...byline } of seed.bylines ?? []) {
    const current = (
      await api(`admin/bylines?search=${encodeURIComponent(byline.slug)}`)
    ).items
    if (!current.some((item) => item.slug === byline.slug))
      await api('admin/bylines', byline)
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  configureCmsBlog({
    url: process.env.EMDASH_URL,
    token: process.env.EMDASH_API_TOKEN,
  })
    .then(() => console.log('Blog Article model and public bylines configured'))
    .catch((error) => {
      console.error(error.message)
      process.exitCode = 1
    })
}
