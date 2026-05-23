import {
  Scissors,
  Palette,
  Sparkles,
  Hand,
  Footprints,
  Brush,
  Eye,
  Crown,
  Flower2,
  Wand2,
  Droplet,
  Sun,
  Heart,
  type LucideIcon,
} from 'lucide-react'
import type { Service } from '@repo/salon-core/types'

const CATEGORY_ICON: Record<Service['category'], LucideIcon> = {
  hair: Scissors,
  nails: Hand,
  skincare: Sparkles,
  spa: Flower2,
}

/** Keyword hints matched against the service name (Persian) for a closer icon. */
const NAME_HINTS: { test: RegExp; icon: LucideIcon }[] = [
  { test: /رنگ|هایلایت|بالیاژ|مش/, icon: Palette },
  { test: /پدیکور|پا/, icon: Footprints },
  { test: /ابرو|مژه|میکروبلیدینگ|لیفت/, icon: Eye },
  { test: /عروس|شینیون/, icon: Crown },
  { test: /میکاپ|آرایش|گریم/, icon: Brush },
  { test: /لیزر|اپیلاسیون/, icon: Wand2 },
  { test: /پاکسازی|ماسک|فیشال/, icon: Droplet },
  { test: /برنزه|تن/, icon: Sun },
  { test: /ماساژ|ریلکس/, icon: Heart },
]

export function iconForService(service: Service): LucideIcon {
  for (const hint of NAME_HINTS) {
    if (hint.test.test(service.name)) return hint.icon
  }
  return CATEGORY_ICON[service.category] ?? Sparkles
}
