---
id: BL-0093
title: Configure Blog Article drafting and editor access
status: ready
type: task
triage: ready-for-agent
priority: medium
size: medium
parent: BL-0087
blocked_by: [BL-0092]
created: 2026-10-06
updated: 2026-10-06
---

## Problem

An installed CMS needs a narrow Blog Article model and content roles before nontechnical editors can prepare Saluna content.

## Smallest Useful Version

Configure Blog Articles and supported editor roles. An authorized editor can create and revise a Persian draft with rich text and images through the CMS, independently of their public author credit.

## Acceptance Criteria

- [ ] Blog Articles support a title, stable slug, summary, rich text body, reusable public byline, optional cover and inline images, and page-specific SEO fields.
- [ ] Public credit defaults to `تیم سالونا`; selecting a named author does not require changing the editing account.
- [ ] A nontechnical editor can create, save, reopen, and revise Persian text and upload and place images through the admin interface. Articles remain drafts when saved as drafts.
- [ ] Revisions are enabled so subsequent work can keep draft edits separate from a published revision.
- [ ] Supported content roles allow an authorized editor to publish their own content and an appropriately authorized editor to manage another user's content, without requiring a different reviewer. Editor accounts cannot perform CMS administration or access Salon operational data.
- [ ] Automated checks exercise real CMS account actions and saved content. Supply an isolated CMS/web test target with browser failure artifacts; preserve the existing manager PWA test target.

## Notes

- Follow the current scope in [BL-0087](BL-0087-publish-blog-and-product-guides-with-emdash.md). Its historical separate-review requirement has been superseded.
- Saluna page previews follow in BL-0094. Full public revision and publication behavior follows in BL-0095. The intended editor's staging trial follows in BL-0097.
