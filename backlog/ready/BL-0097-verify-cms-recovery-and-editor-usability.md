---
id: BL-0097
title: Verify CMS recovery and editor usability
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

A working publishing journey does not prove that the intended editor can use it or that content can be recovered after an upgrade or storage loss.

## Smallest Useful Version

Complete and record the first blog release's staging usability and recovery checks. Resolve unacceptable Persian editing behavior and make production smoke checks detect unavailable CMS content and editing dependencies.

## Acceptance Criteria

- [ ] Identify the intended editor and have them write Persian text, upload and place an image, preview, publish, revise, and unpublish using appropriate content accounts on staging.
- [ ] Record the actual editor trial and resolve any unacceptable untranslated UI or RTL formatting before production publishing is enabled. Automated tests alone do not complete this criterion.
- [ ] Rehearse web-container replacement with representative content and media and verify that saved drafts, published articles, and images survive.
- [ ] Rehearse an EmDash upgrade on staging and verify editing, authenticated preview, public publication state, and media afterward. Record the tested versions and upgrade procedure.
- [ ] Restore CMS content, media, and required encryption keys from backup into a staging recovery environment. Verify draft access, published output, images, and editor authentication after restoration.
- [ ] Document backup, restore, upgrade, migration, runtime-secret, and CMS health procedures with the evidence from these rehearsals.
- [ ] Production smoke checks detect unavailable CMS content and editing dependencies even when the static landing page remains healthy. Keep the existing landing-page and public Salon checks.

## Notes

- The release checks are required by [BL-0087](../now/BL-0087-publish-blog-and-product-guides-with-emdash.md) and [ADR-0040](../../docs/adr/0040-emdash-for-public-content.md).
- Coordinate the editor trial when implementing this task; do not invent an editor or claim completion without their participation. Staging access is also a rollout input.
- Production publishing waits for these checks. Preparing private drafts does not wait for this task. Three launch drafts, Product Guides, and Grok drafting have their own subtasks.
