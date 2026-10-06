---
id: BL-0095
title: Complete blog publishing and URL lifecycle
status: ready
type: task
triage: ready-for-agent
priority: medium
size: medium
parent: BL-0087
blocked_by: [BL-0094]
created: 2026-10-06
updated: 2026-10-06
---

## Problem

Publishing must change what visitors read immediately while unfinished edits and slug changes stay private. Old article URLs must remain correct after renaming or withdrawal.

## Smallest Useful Version

Complete the editor-to-visitor publication journey and stable URL behavior. Publish, revise, republish, rename, withdraw, and delete content through the real CMS without rebuilding or replacing the web image.

## Acceptance Criteria

- [ ] An authorized editor publishes their own draft; an appropriately authorized editor can also publish another editor's draft. No separate reviewer or approval workflow is required.
- [ ] After publication, the next anonymous article and index requests show the published revision without a Saluna build or deployment.
- [ ] Saving a subsequent draft changes its authenticated preview while leaving the live body, title, and URL unchanged. Republishing makes the new revision visible on the next public request.
- [ ] Ordinary title and body edits preserve the slug. A draft slug change does not change live routing until publication.
- [ ] Publishing an explicit slug change permanently redirects the previous URL to the current canonical URL. Successive renames still resolve earlier URLs correctly.
- [ ] Slash variants permanently redirect to the site's canonical URL without a trailing slash.
- [ ] Unpublished, deleted, and unknown content returns 404, including requests through former URLs. Withdrawn content disappears from the public index on the next request.
- [ ] A browser journey against real CMS persistence covers draft creation, image upload, preview, publication, draft revision, republishing, and withdrawal. HTTP checks cover renames, slash variants, and former URLs after withdrawal or deletion.

## Notes

- Apply the current publication and redirect decisions in [BL-0087](BL-0087-publish-blog-and-product-guides-with-emdash.md).
- BL-0096 extends these same state transitions to sitemap discovery and metadata checks. Drafting jobs remain unpublished by their own delivery contract; no custom publication-denial layer is required.
