/**
 * Single source of truth for product identity (name, domains, storage keys).
 * Change values here when rebranding — avoid scattering literals in apps.
 */
export const brand = {
  slug: 'saluna',
  name: {
    /** Persian display name */
    fa: 'سالونا',
    /** Latin display name */
    en: 'Saluna',
  },
  domains: {
    public: 'saluna.ir',
    app: 'app.saluna.ir',
    api: 'api.saluna.ir',
  },
  /** Default production API host (Vercel / edge deployment) */
  defaultApiOrigin: 'https://saluna.vercel.app',
  assets: {
    markClean: '/brand/saluna-mark.png',
    markCleanFilename: 'saluna-mark.png',
    markSourceFilename: 'saluna-mark-gradient.png',
    logoCleanFilename: 'saluna-logo-horizontal-fa-en.png',
    landingMark: '/landing/saluna-mark.png',
  },
  storage: {
    theme: 'saloora-theme',
    offlineDb: 'aravira-manager-offline',
    offlineSnapshotPrefix: 'aravira-offline-v1',
    pwaFirstVisit: 'aravira-pwa-first-visit',
    pwaInstallDismissed: 'aravira-pwa-install-dismissed-v2',
    pwaInstallQualified: 'aravira-pwa-install-qualified-v1',
    pwaInstallAutoOpened: 'aravira-pwa-install-auto-opened-v1',
    starterServicesUsedBase: 'saloora:starter-services-used',
    starterServicesUsed: (salonId: string) =>
      `saloora:starter-services-used:${salonId}` as const,
    /** Persisted active salon for multi-salon staff (BL-0016). */
    activeSalonId: 'saluna:active-salon-id',
  },
  sw: {
    staticPrefix: 'aravira-static',
    pagesPrefix: 'aravira-pages',
    mediaPrefix: 'aravira-media',
    assetsPrefix: 'aravira-assets',
  },
  /** Synthetic email domain for dev/test accounts */
  emailLocalDomain: 'saluna.local',
  telegram: {
    botUsername: 'salunabot',
  },
  project: {
    packageName: 'saluna',
    dockerPostgresContainer: 'saluna-postgres',
  },
} as const

export type BrandConfig = typeof brand

/** Public salon page URL, e.g. saluna.ir/rose-salon */
export function publicSalonUrl(slug: string): string {
  return `${brand.domains.public}/${slug}`
}

export function publicSalonUrlWithProtocol(slug: string): string {
  return `https://${publicSalonUrl(slug)}`
}

/** Manager app origin */
export function appOrigin(): string {
  return `https://${brand.domains.app}`
}

/** API origin */
export function apiOrigin(): string {
  return `https://${brand.domains.api}`
}
