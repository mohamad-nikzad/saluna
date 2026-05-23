// PROTOTYPE — map service ids / categories to lucide icons.
import {
  Scissors,
  Palette,
  Wind,
  Sparkles,
  Brush,
  Crown,
  Heart,
  Hand,
  Flower2,
  Wand2,
  Eye,
  Smile,
  Zap,
  Droplet,
  Sun,
  Star,
  type LucideIcon,
} from 'lucide-react'

const BY_ID: Record<string, LucideIcon> = {
  's-hair-cut': Scissors,
  's-hair-color': Palette,
  's-hair-blowdry': Wind,
  's-hair-highlight': Sparkles,
  's-hair-balayage': Brush,
  's-hair-keratin': Droplet,
  's-hair-extension': Wand2,
  's-hair-bride': Crown,
  's-nail-mani': Hand,
  's-nail-pedi': Flower2,
  's-nail-gel': Sparkles,
  's-nail-design': Brush,
  's-nail-repair': Wand2,
  's-face-clean': Droplet,
  's-face-makeup': Brush,
  's-face-bride': Crown,
  's-brow': Eye,
  's-face-microblading': Eye,
  's-face-lift': Sparkles,
  's-face-laser': Zap,
  's-body-wax': Sparkles,
  's-body-massage': Heart,
  's-body-laser': Zap,
  's-body-tan': Sun,
}

const BY_CATEGORY: Record<string, LucideIcon> = {
  مو: Scissors,
  ناخن: Hand,
  پوست: Smile,
  بدن: Heart,
}

export function iconFor(serviceId: string, category: string): LucideIcon {
  return BY_ID[serviceId] ?? BY_CATEGORY[category] ?? Star
}
