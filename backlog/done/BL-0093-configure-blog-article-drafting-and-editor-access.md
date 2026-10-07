---
id: BL-0093
title: Configure Blog Article drafting and editor access
status: done
type: task
triage: ready-for-agent
priority: medium
size: medium
parent: BL-0087
blocked_by: [BL-0092]
created: 2026-10-06
updated: 2026-10-07
---

## Problem

An installed CMS needs a narrow Blog Article model and content roles before nontechnical editors can prepare Saluna content.

## Smallest Useful Version

Configure Blog Articles and supported editor roles. An authorized editor can create and revise a Persian draft with rich text and images through the CMS, independently of their public author credit.

## Acceptance Criteria

- [x] Blog Articles support a title, stable slug, summary, rich text body, reusable public byline, optional cover and inline images, and page-specific SEO fields.
- [x] Public credit defaults to `تیم سالونا`; selecting a named author does not require changing the editing account.
- [x] A nontechnical editor can create, save, reopen, and revise Persian text and upload and place images through the admin interface. Articles remain drafts when saved as drafts.
- [x] Revisions are enabled so subsequent work can keep draft edits separate from a published revision.
- [x] Supported content roles allow an authorized editor to publish their own content and an appropriately authorized editor to manage another user's content, without requiring a different reviewer. Editor accounts cannot perform CMS administration or access Salon operational data.
- [x] Automated checks exercise real CMS account actions and saved content. Supply an isolated CMS/web test target with browser failure artifacts; preserve the existing manager PWA test target.

## Notes

- Follow the current scope in [BL-0087](../now/BL-0087-publish-blog-and-product-guides-with-emdash.md). Its historical separate-review requirement has been superseded.
- Saluna page previews follow in BL-0094. Full public revision and publication behavior follows in BL-0095. The intended editor's staging trial follows in BL-0097.

## Completion

Implemented in `292707a5` and merged on the integration branch at `ab0b35c2`.
The Blog Article model supports native drafts, revisions, SEO, optional cover and
rich-text images, and reusable public bylines. `blogArticleBylines` selects explicit
credits and otherwise returns `تیم سالونا`, excluding account-inferred credit.
Public templates consume this contract in BL-0094.

The authenticated model configurator works for both fresh and already-initialized
Postgres sites and preserves saved content on repetition. The isolated CMS target
uses real passkeys and invited Author/Editor accounts. Four browser journeys passed
for Persian draft editing, independent public credit, own and cross-user publication
with administrative actions denied, and image/SEO editing. All 25 web tests, lint,
and typecheck passed; the manager target still lists 31 tests in nine files. Both
failed and successful fixture runs removed disposable containers and web processes.

This is local verification. The intended editor's staging usability trial remains
BL-0097. Public output, authenticated previews, and full publication/metadata
separation follow in BL-0094 through BL-0096. Provisioning and editor workflow are
in [EmDash editor](../../docs/EMDASH_EDITOR.md).

## Follow-up in BL-0096

The historical implementation above used native SEO and Bylines. BL-0096 found
that their saves bypass content revision staging in EmDash 1.1.0. The final public
reader uses revisioned SEO fields and references to reusable `public_authors`
entries instead. Legacy native data remains preserved. See
[the editor guide](../../docs/EMDASH_EDITOR.md) for the current field labels,
public credit behavior, and migration procedure.
