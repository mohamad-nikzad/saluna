import {
  getEmDashCollection,
  getEmDashEntry,
  getRequestContext,
  runWithContext,
  type ImageValue,
  type PortableTextBlock,
} from 'emdash'
import { blogArticleBylines } from './blog-byline'

interface BlogArticleData {
  title: string
  slug: string
  summary?: string
  body?: PortableTextBlock[]
  cover?: ImageValue | null
  publishedAt?: string
  bylines?: Parameters<typeof blogArticleBylines>[0]
}

export interface BlogArticle extends Omit<BlogArticleData, 'bylines'> {
  bylines: string[]
}

function article(data: BlogArticleData): BlogArticle {
  return { ...data, bylines: blogArticleBylines(data.bylines) }
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
  const result = await publicRead(() =>
    getEmDashCollection<'blog_articles', BlogArticleData>('blog_articles', {
      status: 'published',
      orderBy: { published_at: 'desc' },
    }),
  )
  if (result.error) throw result.error
  return result.entries.map((entry) => article(entry.data))
}

export async function readPublicBlogArticle(
  slug: string,
): Promise<BlogArticle | null> {
  const result = await publicRead(() =>
    getEmDashEntry<'blog_articles', BlogArticleData>('blog_articles', slug),
  )
  if (result.error) throw result.error
  return result.entry ? article(result.entry.data) : null
}

/** Called only after middleware grants session-backed draft access. The
 * matching native signed token remains required, even in visual edit mode.
 */
export async function readBlogPreview(
  slug: string,
): Promise<BlogArticle | null> {
  const result = await runWithContext(
    { ...getRequestContext(), editMode: false },
    () =>
      getEmDashEntry<'blog_articles', BlogArticleData>('blog_articles', slug),
  )
  if (result.error) throw result.error
  return result.isPreview && result.entry ? article(result.entry.data) : null
}
