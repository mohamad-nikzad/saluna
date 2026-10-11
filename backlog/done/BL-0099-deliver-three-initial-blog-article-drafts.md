---
id: BL-0099
title: Deliver three initial Blog Article drafts
status: done
type: task
triage: ready-for-agent
priority: medium
size: medium
parent: BL-0087
blocked_by: [BL-0098]
created: 2026-10-06
updated: 2026-10-08
---

## Problem

The new publishing system needs the agreed first batch of useful Persian content for prospective Salon Owners.

## Smallest Useful Version

Use the supported agent connection to prepare three Blog Article drafts on Staff Commission calculations, organizing AppointmentRequests, and useful Client records. Deliver private preview links and leave every article unpublished.

## Acceptance Criteria

- [x] Exactly three first-batch articles exist as CMS drafts, each covering one of the agreed subjects in Persian for prospective Salon Owners.
- [x] Each draft has a title, stable slug, summary, rich text body, required SEO fields, a relevant signup link, and the default `تیم سالونا` byline unless an explicit public author is selected. Cover images remain optional.
- [x] Product claims reflect current shipped Saluna behavior and canonical glossary terms. Record the product sources used to verify claims.
- [x] The Staff Commission article includes worked examples consistent with Eligible Commission Basis, Work Allocation, Commission Agreement, and applicable Service Commission Override behavior. It does not confuse booked amounts with collected Client Payments or profit.
- [x] AppointmentRequest content correctly distinguishes a proposal awaiting approval from a scheduled Appointment. Client content accurately describes current Client records and supported workflows.
- [x] Check existing published content and drafts for overlap. Verify each saved draft through its authenticated Saluna preview and deliver all three preview links.
- [x] All three remain unpublished on delivery and absent from public pages, lists, and discovery. Neither review by another person or agent nor publication is required for completion.

## Notes

- This completes the first-batch content milestone in [BL-0087](../done/BL-0087-publish-blog-and-product-guides-with-emdash.md).
- Publication is a later explicit action by an authorized editor, including the editor who wrote the article. This task does not launch a daily routine or add conversion attribution.

## Completion evidence, 2026-10-08

Implementation `86733844dbdcbf52d2504c028cc09c6583687fa7` merged into
`codex/bl-0087-emdash-blog-and-guides` at
`947a191bb74bac376106bb10b3cc7b07ba38a516`.

Exactly three first-batch Persian articles were saved on the retained Mac CMS
using the dedicated native Author connection. Their original IDs, titles,
slugs and product claim sources are in
[the delivery record](../../content/blog-launch/delivery.json) and
[article manifest](../../content/blog-launch/articles.json). Independent native
reads confirmed complete bodies and metadata match the reviewed editorial
sources. Worked commission amounts, request proposal/approval behavior and
Client form, import, profile and birthday claims match current code and ADRs.
Mobile commission calculations use readable Persian sentences.

Actual Editor session previews passed for all three articles, including
revisioned SEO, default team credit, body and shared signup links, branded
social fallback, native reopening, preview privacy and public exclusion.
Anonymous previews returned 403, public details returned 404, and the index
and sitemap omitted the drafts. Two independent renewal runs, including
missing-ledger recovery, preserved the original IDs, total article count,
complete saved records and native revisions. Formatting, syntax and whitespace
checks passed. No app build or deployment was needed for this content delivery.

All three remain unscheduled drafts without live revisions. Current private
preview links are saved outside Git and can be renewed for the final human
handoff with the documented command in
[EMDASH_LAUNCH_DRAFTS.md](../../docs/EMDASH_LAUNCH_DRAFTS.md). The user's physical
Editor invitation remains unconsumed. Publication, a second reviewer and a
Grok routine are not prerequisites for this completed batch.
