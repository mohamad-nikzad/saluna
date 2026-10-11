---
id: BL-0101
title: Connect manager screens to Product Guides
status: archive
type: task
triage: wontfix
priority: medium
size: small
parent: BL-0087
blocked_by: [BL-0100]
created: 2026-10-06
updated: 2026-10-11
---

## Removed from scope, 2026-10-11

The user removed this task because its remaining requirements are no longer needed. It is archived, not marked complete. Implemented technical work and the original evidence below are preserved. Its outstanding checks no longer block BL-0087; this change does not alter running services or automation.

## Problem

Managers should reach relevant instructions while performing a Saluna task, and the intended editor must prove they can maintain guides with screenshots and optional video.

## Smallest Useful Version

Link at least one relevant manager PWA screen to its accurate public Product Guide and complete the guide editor's staging trial.

## Acceptance Criteria

- [x] At least one manager PWA screen has a clearly named link to a published Product Guide for that screen's current task.
- [x] Following the link opens the correct public guide and its useful written steps without requiring a product login to read the guide itself.
- [x] A browser journey verifies the manager-screen link and correct guide destination while preserving the screen's existing operational behavior.
- [ ] The intended nontechnical editor completes a staging guide journey covering Persian text, screenshot upload and placement, optional external video placement and transcript, preview, publication, revision, and withdrawal.
- [ ] Record the editor's actual trial and resolve unacceptable untranslated UI, RTL formatting, screenshot, or video-placement behavior before guide rollout.
- [x] Confirm the linked guide matches the current manager screen and record product staff responsibility for maintaining its accuracy after UI changes.

## Notes

- This completes the manager-link and real-editor guide criteria in [BL-0087](../done/BL-0087-publish-blog-and-product-guides-with-emdash.md).
- Coordinate the intended editor and staging access during implementation. Automated tests do not substitute for the required hands-on trial.

## Technical verification and pending human trial

On 2026-10-08, implementation `78f9b7885f83cb042afb44a17623ab26edf344e5`
was independently merged as `65519f4d3516281111be1d8e28f63fe1c476dbec`.
The Clients header link «راهنمای افزودن مشتری» opens the configured public
site in another tab. The browser clicked it to the published local guide,
without CMS or product login cookies, and verified five written steps and
three screenshots. The original Clients route stayed open; valid demo Client
creation and search passed afterward.

Follow-up `fe897b3ef04eacfdb13b7ca7ec81fb7bace4b26e` corrected the full-page
capture timing. The browser now scrolls to each guide image and waits for its
successful decode before capturing the page. The focused journey passed again,
including the third screenshot. Native guide content was unchanged.

Targeted lint, whole PWA TypeScript, production Vite build, formatting, syntax
and diff checks passed. The fixture uses actual PWA components and isolated
external API demo responses, with no operational customer database. Product
staff accuracy and maintenance responsibility are recorded in
[the guide workflow](../../docs/EMDASH_PRODUCT_GUIDES.md). The existing native
published guide remains the content source.

The user requested their physical Editor trial only after all implementation.
Criteria 4 and 5 remain unchecked until they perform the Persian guide journey,
including screenshots, external video/transcript, preview, publication, revision
and withdrawal, and report any unacceptable native English UI or RTL behavior.
This task remains ready-for-human; automated checks do not replace that trial.
