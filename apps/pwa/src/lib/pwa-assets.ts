const DEFAULT_PWA_ASSET_VERSION = '2026-05-26-v1'

const rawVersion = import.meta.env.VITE_PWA_ASSET_VERSION as string | undefined

export const PWA_ASSET_VERSION =
  rawVersion && rawVersion.length > 0 ? rawVersion : DEFAULT_PWA_ASSET_VERSION

export function withPwaAssetVersion(path: string) {
  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}v=${encodeURIComponent(PWA_ASSET_VERSION)}`
}
