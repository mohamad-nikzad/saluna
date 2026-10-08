/** Only recognized HTTPS players are embedded. Other hosts remain ordinary
 * links so an editor cannot introduce an arbitrary framed application. */
export function guideVideo(value?: string) {
  if (!value) return null
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || url.username || url.password) return null
  let id: string | null = null
  if (url.hostname === 'youtu.be') id = url.pathname.slice(1)
  if (
    ['youtube.com', 'www.youtube.com', 'www.youtube-nocookie.com'].includes(
      url.hostname,
    )
  )
    id = url.pathname.startsWith('/embed/')
      ? url.pathname.split('/')[2]
      : url.searchParams.get('v')
  if (id && /^[\w-]{11}$/.test(id))
    return {
      href: url.href,
      embed: `https://www.youtube-nocookie.com/embed/${id}`,
      file: false,
    }
  return {
    href: url.href,
    embed: null,
    file: /\.(mp4|webm)$/i.test(url.pathname),
  }
}
