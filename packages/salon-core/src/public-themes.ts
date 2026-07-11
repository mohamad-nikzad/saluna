/**
 * Curated public-page theme presets. Replaces the prior freeform hex
 * accent-color picker so manager-picked themes can never produce unreadable
 * public pages. Theme id is stored as `theme_id` on `salon_public_settings`.
 */

export type PublicThemeId =
  | 'rose'
  | 'sage'
  | 'ocean'
  | 'sand'
  | 'plum'
  | 'charcoal'

export type PublicTheme = {
  id: PublicThemeId
  name: string
  swatch: string
  primary: string
  bg: string
  text: string
}

export const PUBLIC_THEMES: readonly PublicTheme[] = [
  {
    id: 'rose',
    name: 'رز',
    swatch: 'linear-gradient(135deg,#F4C7CE,#B85563)',
    primary: '#B85563',
    bg: '#FBF1F2',
    text: '#3C1A22',
  },
  {
    id: 'sage',
    name: 'سبز چای',
    swatch: 'linear-gradient(135deg,#D6E5D2,#5C8463)',
    primary: '#5C8463',
    bg: '#F2F6EF',
    text: '#1F3424',
  },
  {
    id: 'ocean',
    name: 'اقیانوس',
    swatch: 'linear-gradient(135deg,#C9DEEA,#3B6E8F)',
    primary: '#3B6E8F',
    bg: '#F0F5F9',
    text: '#0F2A3D',
  },
  {
    id: 'sand',
    name: 'شنی',
    swatch: 'linear-gradient(135deg,#EBDDC3,#A8784A)',
    primary: '#A8784A',
    bg: '#FAF4E8',
    text: '#3B2812',
  },
  {
    id: 'plum',
    name: 'آلویی',
    swatch: 'linear-gradient(135deg,#D6C2D9,#6A3E70)',
    primary: '#6A3E70',
    bg: '#F6EFF7',
    text: '#2C1530',
  },
  {
    id: 'charcoal',
    name: 'زغالی',
    swatch: 'linear-gradient(135deg,#D4D4D4,#262626)',
    primary: '#262626',
    bg: '#F5F5F5',
    text: '#0A0A0A',
  },
] as const

export const DEFAULT_PUBLIC_THEME_ID: PublicThemeId = 'rose'

export function resolvePublicTheme(id: string | null | undefined): PublicTheme {
  const found = PUBLIC_THEMES.find((t) => t.id === id)
  return found ?? PUBLIC_THEMES[0]!
}

export function isPublicThemeId(value: unknown): value is PublicThemeId {
  return typeof value === 'string' && PUBLIC_THEMES.some((t) => t.id === value)
}
