---
id: BL-0094
title: Render blog pages and private previews
status: ready
type: task
triage: ready-for-agent
priority: medium
size: medium
parent: BL-0087
blocked_by: [BL-0093]
created: 2026-10-06
updated: 2026-10-06
---

## Problem

CMS drafts need a preview in Saluna's design, and published Blog Articles need readable public pages.

## Smallest Useful Version

Render a Persian RTL blog index and individual articles using the existing public layouts. Authenticated editors preview drafts through the same article design; anonymous visitors can read only published content.

## Acceptance Criteria

- [ ] `/blog` and individual Blog Article pages render crawlable Persian RTL HTML using Saluna's public design and appear in site navigation.
- [ ] Published article output includes its title, summary, rich text, default or named byline, optional cover and inline images, and a relevant working signup link.
- [ ] Articles with no cover image remain readable without broken image output.
- [ ] Public pages and the index read published revisions at request time. Draft-only and unknown articles return 404 and do not appear in the public index.
- [ ] An authenticated editor can obtain a draft preview link and see the draft in the actual public article design. Anonymous requests cannot read draft preview content.
- [ ] Preview responses carry a noindex policy and cannot enter a shared public cache or leak through a later anonymous request.
- [ ] Rendered-page and HTTP checks verify Persian content, bylines, optional images, signup links, published-only output, and preview privacy against real CMS states. Existing public pages still pass their checks.

## Notes

- Parent design and privacy requirements are in [BL-0087](BL-0087-publish-blog-and-product-guides-with-emdash.md).
- Publication transitions and renamed URLs follow in BL-0095. Search metadata, sitemap discovery, and branded social-image fallback follow in BL-0096.
