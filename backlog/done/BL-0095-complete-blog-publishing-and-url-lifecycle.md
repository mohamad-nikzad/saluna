---
id: BL-0095
title: Complete blog publishing and URL lifecycle
status: done
type: task
triage: ready-for-agent
priority: medium
size: medium
parent: BL-0087
blocked_by: [BL-0094]
created: 2026-10-06
updated: 2026-10-07
---

## Problem

Publishing must change what visitors read immediately while unfinished edits and slug changes stay private. Old article URLs must remain correct after renaming or withdrawal.

## Smallest Useful Version

Complete the editor-to-visitor publication journey and stable URL behavior. Publish, revise, republish, rename, withdraw, and delete content through the real CMS without rebuilding or replacing the web image.

## Acceptance Criteria

- [x] An authorized editor publishes their own draft; an appropriately authorized editor can also publish another editor's draft. No separate reviewer or approval workflow is required.
- [x] After publication, the next anonymous article and index requests show the published revision without a Saluna build or deployment.
- [x] Saving a subsequent draft changes its authenticated preview while leaving the live body, title, and URL unchanged. Republishing makes the new revision visible on the next public request.
- [x] Ordinary title and body edits preserve the slug. A draft slug change does not change live routing until publication.
- [x] Publishing an explicit slug change permanently redirects the previous URL to the current canonical URL. Successive renames still resolve earlier URLs correctly.
- [x] Slash variants permanently redirect to the site's canonical URL without a trailing slash.
- [x] Unpublished, deleted, and unknown content returns 404, including requests through former URLs. Withdrawn content disappears from the public index on the next request.
- [x] A browser journey against real CMS persistence covers draft creation, image upload, preview, publication, draft revision, republishing, and withdrawal. HTTP checks cover renames, slash variants, and former URLs after withdrawal or deletion.

## Notes

- Apply the current publication and redirect decisions in [BL-0087](../done/BL-0087-publish-blog-and-product-guides-with-emdash.md).
- BL-0096 extends these same state transitions to sitemap discovery and metadata checks. Drafting jobs remain unpublished by their own delivery contract; no custom publication-denial layer is required.

## Completion

Implemented in `5ecc19ee` and independently merged and verified at
`3036310db2717d90eb373199d7312a31c6c93dba`. Native Author and Editor journeys
cover draft creation, image upload, authenticated preview, own and cross-user
publication, live revision separation, republishing, and withdrawal. Fresh
supported redirect reads validate published destinations, including successive
renames, pagination, trash, permanent deletion, and former URLs. Obsolete
preview URLs fail closed with private cache and noindex headers.

The production target passed all 13 browser/HTTP checks independently. The
development target passed 12 with one production-only skip. Static canonical
redirects preserve query strings and sitemap URLs. The supported Node startup
boundary is used by Docker, package start, and PM2. A warmed CMS outage returns
500 rather than stale public content or aliases. All 25 web tests, lint, and
typecheck passed; the manager target still lists 31 tests and excludes CMS.
Interrupted-build cleanup removed disposable database and child processes.

EmDash 1.1.0 REST slug saves must include a `data` object, even `data: {}`, to
use draft staging. The native admin already sends this shape. The caveat and
production startup contract are documented in [EmDash editor](../../docs/EMDASH_EDITOR.md).
SEO and runtime discovery follow in BL-0096. No production deployment occurred.
