import { cn } from '@repo/ui/utils'

import {
  BRAND_ICON_SVGS,
  isBrandIconSlug,
  type BrandIconSlug,
} from './brand-icon-sources'

type BrandIconProps = {
  slug: string
  size?: number
  className?: string
  title?: string
}

export function BrandIcon({
  slug,
  size = 24,
  className,
  title,
}: BrandIconProps) {
  if (!isBrandIconSlug(slug)) return null

  const svg = BRAND_ICON_SVGS[slug as BrandIconSlug]
  return (
    <span
      role="img"
      aria-label={title ?? slug}
      className={cn('inline-flex shrink-0 text-foreground', className)}
      style={{ width: size, height: size }}
      // SVG strings are static vendored assets from this package.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

export function BrandIconTile({
  slug,
  title,
  size = 22,
}: {
  slug: string
  title?: string
  size?: number
}) {
  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-line-soft bg-foreground/[0.06]">
      <BrandIcon slug={slug} size={size} title={title} />
    </div>
  )
}
