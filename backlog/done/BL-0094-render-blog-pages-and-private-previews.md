---
id: BL-0094
title: Render blog pages and private previews
status: done
type: task
triage: ready-for-agent
priority: medium
size: medium
parent: BL-0087
blocked_by: [BL-0093]
created: 2026-10-06
updated: 2026-10-07
---

## Problem

CMS drafts need a preview in Saluna's design, and published Blog Articles need readable public pages.

## Smallest Useful Version

Render a Persian RTL blog index and individual articles using the existing public layouts. Authenticated editors preview drafts through the same article design; anonymous visitors can read only published content.

## Acceptance Criteria

- [x] `/blog` and individual Blog Article pages render crawlable Persian RTL HTML using Saluna's public design and appear in site navigation.
- [x] Published article output includes its title, summary, rich text, default or named byline, optional cover and inline images, and a relevant working signup link.
- [x] Articles with no cover image remain readable without broken image output.
- [x] Public pages and the index read published revisions at request time. Draft-only and unknown articles return 404 and do not appear in the public index.
- [x] An authenticated editor can obtain a draft preview link and see the draft in the actual public article design. Anonymous requests cannot read draft preview content.
- [x] Preview responses carry a noindex policy and cannot enter a shared public cache or leak through a later anonymous request.
- [x] Rendered-page and HTTP checks verify Persian content, bylines, optional images, signup links, published-only output, and preview privacy against real CMS states. Existing public pages still pass their checks.

## Notes

- Parent design and privacy requirements are in [BL-0087](../done/BL-0087-publish-blog-and-product-guides-with-emdash.md).
- Publication transitions and renamed URLs follow in BL-0095. Search metadata, sitemap discovery, and branded social-image fallback follow in BL-0096.

## Implementation and verification

Completed on 2026-10-07, merged and independently verified at `609eeb8a05b8a3a53c44cfdd8460fb27ba65e85c`. Runtime `/blog` and article pages use Saluna's existing Persian RTL layouts, explicit public credit, optional native CMS images and rich text, and the shared signup link. Public queries force published reads even for editors with visual editing enabled.

Private previews require a real CMS session with native draft-read permission and a matching signed token. Responses disable route caching and carry private, no-store and noindex policies, including denied, invalid, unmatched and error paths. Copied links cannot expose a draft to anonymous visitors.

Seven real CMS browser tests passed against disposable Postgres, including admin editing, default and named credit, cover and inline image responses, public HTML, signed-session preview, invalid/expired/cross-entry tokens, Subscriber and anonymous denial, and anonymous requests after preview. All 25 web tests, lint and typecheck passed. The manager target still lists 31 tests and excludes CMS. Raw production build passed with CMS credentials unset; TypeScript passed without the ignored generated EmDash declaration. Desktop and 390px mobile output was visually inspected. Disposable storage and server processes were removed.

Publication transitions and URL redirects follow in BL-0095; article SEO and runtime discovery follow in BL-0096. The intended editor's hands-on trial remains a later release check.
