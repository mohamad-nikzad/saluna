---
id: BL-0100
title: Publish Product Guides
status: done
type: task
triage: ready-for-agent
priority: medium
size: medium
parent: BL-0087
blocked_by: [BL-0096]
created: 2026-10-06
updated: 2026-10-08
---

## Problem

Managers need maintained public instructions for Saluna tasks. Blog Articles do not provide the structured steps and review information needed by Product Guides.

## Smallest Useful Version

Add a separate Product Guide content type and public RTL templates in the same CMS. Reuse the established preview, publication, metadata, and discovery behavior. Prepare and publish one guide for a current manager task as the complete editor-to-reader example.

## Acceptance Criteria

- [x] Product Guides have their own content type with ordered steps, screenshots, optional externally hosted video and transcript, related guides, and a last-reviewed date or reviewer.
- [x] An authorized nontechnical editor can draft, preview, publish, revise, and unpublish a Persian guide without a code change or Saluna deployment. Draft changes remain separate from live content.
- [x] `/guides` and individual guide pages render crawlable Persian RTL content, appear in site navigation, and can be read without product login.
- [x] Authenticated previews show draft guide content in the public design, remain unindexable, and cannot leak through anonymous requests or shared caches.
- [x] Published guides have appropriate shared metadata and canonical URLs and appear in runtime sitemap discovery. Withdrawal removes public output and discovery without a build; unknown, withdrawn, and deleted guides return 404.
- [x] At least one guide accurately explains a current manager task with ordered steps and screenshots. Exercise optional video, supporting transcript, and related-guide rendering using representative content; large videos are hosted outside the CMS/web container.
- [x] Automated editor and public-page checks cover guide publication, draft revision, media rendering, privacy, metadata, and published-only discovery while retaining Blog Article regression coverage.

## Notes

- This is a later phase of [BL-0087](../now/BL-0087-publish-blog-and-product-guides-with-emdash.md), following [ADR-0040](../../docs/adr/0040-emdash-for-public-content.md).
- Product staff own accuracy after the corresponding UI changes. Record this maintenance responsibility with the guide workflow.
- Manager-screen links and the guide editor's actual staging trial follow in BL-0101. Initial article publication and daily Grok drafting do not block this task.

## Verification

On 2026-10-08, implementation `bce9af8d7b4c48f1b993ce7487bddac6124c9485`
was independently merged as `a4a17a45957e8ca3f74577ac3eeb8fcfe4a152ae`.
Follow-up `83f82960c9cab61a93099e8dfaac477988561908` restored the Blog Article
body label after its accidental guide-label change. The retained initialized
CMS model was corrected through the supported field-settings API; article and
guide records and revisions were preserved. Its existing image still contains
the prior baked label, while the current source and initialized model are fixed.

Independent production CMS checks passed 17/17, retaining the Blog Article
regressions. Web tests passed 31/31, with lint, typecheck and credential-free
production build passing. Native guide editing, staged/live revisions, media,
video/transcript/related controls, private previews, publication, renames,
withdrawal/deletion, metadata and runtime discovery passed.

The original Client guide is published at
`http://localhost:3301/guides/create-client`, native ID
`01M4C5C56VTQDM3K4Y2C833K4N`. Five ordered steps and all three public screenshots
match the reviewed current-product source and image bytes. Isolated actual PWA
create/search capture passed with demo responses at the external API boundary.
All three launch articles remain unscheduled drafts. Maintenance instructions
are in [the Product Guide workflow](../../docs/EMDASH_PRODUCT_GUIDES.md).

The user's physical editing trial and manager-screen link follow in BL-0101.
Automated technical evidence does not replace that end-of-work trial.
