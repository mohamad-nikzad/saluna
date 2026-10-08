import {
  createContentAccess,
  getEmDashCollection,
  getEmDashEntry,
  getEmDashReferences,
  normalizeMediaValue,
  getRequestContext,
  runWithContext,
  type ContentEntry,
  type ImageValue,
  type PortableTextBlock,
} from 'emdash'
import { withEmDashRuntime } from 'emdash/middleware'

type PublicCollection = 'blog_articles' | 'product_guides'

interface BlogArticleData {
  id: string
  title: string
  slug: string
  summary?: string
  body?: PortableTextBlock[]
  cover?: ImageValue | null
  publishedAt?: Date | string | null
  seo_title?: string
  seo_description?: string
  search_excluded?: boolean
}

export interface BlogArticle extends Omit<BlogArticleData, 'publishedAt'> {
  publishedAt?: string
  modifiedAt?: string
  bylines: string[]
}

export interface ProductGuide extends BlogArticle {
  reviewed_at?: string
  reviewer_name?: string
  video_url?: string
  video_transcript?: string
  relatedGuides: { slug: string; title: string }[]
}

function isoDate(value?: Date | string | null): string | undefined {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

async function article(
  entry: ContentEntry<BlogArticleData>,
  collection: PublicCollection = 'blog_articles',
): Promise<BlogArticle> {
  const id = entry.data.id ?? entry.id
  const names: string[] = []
  let cursor: string | undefined
  if (collection === 'blog_articles')
    do {
      const page = await getEmDashReferences<{ title: string }>(
        'blog_articles',
        id,
        'public_authors',
        { limit: 100, cursor },
      )
      if (page.error) throw page.error
      names.push(...page.entries.map((profile) => profile.data.title))
      cursor = page.nextCursor
    } while (cursor)
  // updatedAt belongs to the mutable entry, including draft saves. Only the
  // promoted revision's date may describe the public article's last change.
  const presentation = await withEmDashRuntime(async (runtime) => {
    const content = createContentAccess(runtime.db, { revisions: true })
    const current = await content.get(collection, id)
    const revision = current?.liveRevisionId
      ? await content.getRevision!(collection, id, current.liveRevisionId)
      : null
    let cover = entry.data.cover
    if (cover && !cover.src) {
      // Provider enrichment restores the local storage key missing from some
      // saved image values. A plugin's media asset URL requires authentication.
      const normalized = await normalizeMediaValue(cover, (id) =>
        runtime.getMediaProvider(id),
      )
      const provider = runtime.getMediaProvider(normalized?.provider || 'local')
      if (!normalized || !provider)
        throw new Error('Blog cover provider could not be loaded')
      const embed = await provider.getEmbed(normalized)
      if (embed.type !== 'image') throw new Error('Blog cover is not an image')
      cover = { ...normalized, src: embed.src }
    }
    return { modifiedAt: isoDate(revision?.createdAt), cover }
  })
  return {
    ...entry.data,
    publishedAt: isoDate(entry.data.publishedAt),
    ...presentation,
    bylines: names.length ? names : ['تیم سالونا'],
  }
}

// Ordinary pages always read the live revision, including requests made by
// signed-in editors with EmDash's edit-mode cookie enabled.
function publicRead<T>(read: () => Promise<T>): Promise<T> {
  return runWithContext(
    { ...getRequestContext(), editMode: false, preview: undefined },
    read,
  )
}

export async function readPublicBlogArticles(): Promise<BlogArticle[]> {
  return publicRead(async () => {
    const result = await getEmDashCollection<'blog_articles', BlogArticleData>(
      'blog_articles',
      { status: 'published', orderBy: { published_at: 'desc' } },
    )
    if (result.error) throw result.error
    return Promise.all(result.entries.map((entry) => article(entry)))
  })
}

export async function readPublicBlogArticle(
  slug: string,
): Promise<BlogArticle | null> {
  return publicRead(async () => {
    const result = await getEmDashEntry<'blog_articles', BlogArticleData>(
      'blog_articles',
      slug,
    )
    if (result.error) throw result.error
    return result.entry ? article(result.entry) : null
  })
}

/** Session-backed draft access is granted by middleware. A matching native
 * signed token remains required, even in visual edit mode.
 */
export async function readBlogPreview(
  slug: string,
): Promise<BlogArticle | null> {
  return runWithContext(
    { ...getRequestContext(), editMode: false },
    async () => {
      const result = await getEmDashEntry<'blog_articles', BlogArticleData>(
        'blog_articles',
        slug,
      )
      if (result.error) throw result.error
      return result.isPreview && result.entry ? article(result.entry) : null
    },
  )
}

async function guide(
  entry: ContentEntry<BlogArticleData>,
): Promise<ProductGuide> {
  const common = await article(entry, 'product_guides')
  const data = entry.data as BlogArticleData & {
    reviewed_at?: Date | string
    reviewer_name?: string
    video_url?: string
    video_transcript?: string
  }
  const relatedGuides: ProductGuide['relatedGuides'] = []
  let cursor: string | undefined
  do {
    const page = await getEmDashReferences<{ slug: string; title: string }>(
      'product_guides',
      common.id,
      'related_guides',
      { limit: 100, cursor },
    )
    if (page.error) throw page.error
    for (const related of page.entries) {
      // A preview can select an unpublished related target. Public links still
      // require its published revision, independently of the anchor's token.
      const visible = await publicRead(() =>
        getEmDashEntry<'product_guides', BlogArticleData>(
          'product_guides',
          related.id,
        ),
      )
      if (visible.error) throw visible.error
      if (visible.entry && visible.entry.data.id !== common.id)
        relatedGuides.push({
          slug: visible.entry.data.slug,
          title: visible.entry.data.title,
        })
    }
    cursor = page.nextCursor
  } while (cursor)
  return {
    ...common,
    reviewed_at: isoDate(data.reviewed_at),
    reviewer_name: data.reviewer_name,
    video_url: data.video_url,
    video_transcript: data.video_transcript,
    relatedGuides,
  }
}

export async function readPublicGuides(): Promise<ProductGuide[]> {
  return publicRead(async () => {
    const result = await getEmDashCollection<'product_guides', BlogArticleData>(
      'product_guides',
      { status: 'published', orderBy: { published_at: 'desc' } },
    )
    if (result.error) throw result.error
    return Promise.all(result.entries.map(guide))
  })
}
export async function readPublicGuide(
  slug: string,
): Promise<ProductGuide | null> {
  return publicRead(async () => {
    const result = await getEmDashEntry<'product_guides', BlogArticleData>(
      'product_guides',
      slug,
    )
    if (result.error) throw result.error
    return result.entry ? guide(result.entry) : null
  })
}
export async function readGuidePreview(
  slug: string,
): Promise<ProductGuide | null> {
  return runWithContext(
    { ...getRequestContext(), editMode: false },
    async () => {
      const result = await getEmDashEntry<'product_guides', BlogArticleData>(
        'product_guides',
        slug,
      )
      if (result.error) throw result.error
      return result.isPreview && result.entry ? guide(result.entry) : null
    },
  )
}
