---
id: BL-0029
title: Version PWA install icons and manifest asset URLs
status: inbox
type: bug
priority: medium
size: small
created: 2026-06-22
updated: 2026-06-22
---

## Problem

PWA icon asset versioning is only partially implemented. `VITE_PWA_ASSET_VERSION` and
`withPwaAssetVersion()` are used for service worker registration and SW precache, but
`index.html` and `manifest.webmanifest` still reference unversioned paths such as
`/icons/icon-192x192.png` and `/apple-touch-icon.png`.

Installed PWAs can keep showing old icons after a deploy because:

- Home screen icons are often snapshotted at install time and do not reliably refresh.
- Icon files are served with `Cache-Control: public, max-age=31536000, immutable` via
  nginx while filenames stay the same across releases.
- SW precache uses versioned URLs that do not match the paths browsers and the OS use
  during install.

## Smallest Useful Version

Apply `withPwaAssetVersion()` (or equivalent build-time injection) to all PWA-facing
icon and manifest URLs in `index.html` and `manifest.webmanifest`, and ensure
`VITE_PWA_ASSET_VERSION` is bumped whenever icons change in CI/production builds.

## Acceptance Criteria

- [ ] `index.html` icon, favicon, and `apple-touch-icon` links include the PWA asset
      version query param (or use versioned filenames generated at build time).
- [ ] Every `icons` entry in `manifest.webmanifest` uses the same versioning strategy.
- [ ] Shortcut icons in the manifest are versioned.
- [ ] SW precache covers the same icon URLs the manifest and HTML expose (no drift
      between versioned and unversioned paths).
- [ ] Deploy docs note that installed users may still need to reinstall for home screen
      icon updates on some platforms, even after this fix.
- [ ] After bumping `VITE_PWA_ASSET_VERSION` and deploying, a fresh browser session
      fetches updated icon assets instead of serving year-long cached copies.

## Notes

- Related code: `apps/pwa/src/lib/pwa-assets.ts`, `apps/pwa/public/sw.js`,
  `apps/pwa/index.html`, `apps/pwa/public/manifest.webmanifest`,
  `apps/pwa/nginx.conf`.
- `manifest.webmanifest` is already `no-cache`; the main gap is unversioned icon URLs
  plus aggressive immutable caching on `.png` / `.ico` assets.
- BL-0010 covers replacing logo/assets; this item covers cache busting and install-time
  consistency for PWA icon delivery.
