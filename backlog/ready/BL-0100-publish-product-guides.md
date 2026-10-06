---
id: BL-0100
title: Publish Product Guides
status: ready
type: task
triage: ready-for-agent
priority: medium
size: medium
parent: BL-0087
blocked_by: [BL-0096]
created: 2026-10-06
updated: 2026-10-06
---

## Problem

Managers need maintained public instructions for Saluna tasks. Blog Articles do not provide the structured steps and review information needed by Product Guides.

## Smallest Useful Version

Add a separate Product Guide content type and public RTL templates in the same CMS. Reuse the established preview, publication, metadata, and discovery behavior. Prepare and publish one guide for a current manager task as the complete editor-to-reader example.

## Acceptance Criteria

- [ ] Product Guides have their own content type with ordered steps, screenshots, optional externally hosted video and transcript, related guides, and a last-reviewed date or reviewer.
- [ ] An authorized nontechnical editor can draft, preview, publish, revise, and unpublish a Persian guide without a code change or Saluna deployment. Draft changes remain separate from live content.
- [ ] `/guides` and individual guide pages render crawlable Persian RTL content, appear in site navigation, and can be read without product login.
- [ ] Authenticated previews show draft guide content in the public design, remain unindexable, and cannot leak through anonymous requests or shared caches.
- [ ] Published guides have appropriate shared metadata and canonical URLs and appear in runtime sitemap discovery. Withdrawal removes public output and discovery without a build; unknown, withdrawn, and deleted guides return 404.
- [ ] At least one guide accurately explains a current manager task with ordered steps and screenshots. Exercise optional video, supporting transcript, and related-guide rendering using representative content; large videos are hosted outside the CMS/web container.
- [ ] Automated editor and public-page checks cover guide publication, draft revision, media rendering, privacy, metadata, and published-only discovery while retaining Blog Article regression coverage.

## Notes

- This is a later phase of [BL-0087](../now/BL-0087-publish-blog-and-product-guides-with-emdash.md), following [ADR-0040](../../docs/adr/0040-emdash-for-public-content.md).
- Product staff own accuracy after the corresponding UI changes. Record this maintenance responsibility with the guide workflow.
- Manager-screen links and the guide editor's actual staging trial follow in BL-0101. Initial article publication and daily Grok drafting do not block this task.
