---
id: BL-0097
title: Verify CMS recovery and editor usability
status: ready
type: task
triage: ready-for-human
priority: medium
size: medium
parent: BL-0087
blocked_by: [BL-0096]
created: 2026-10-06
updated: 2026-10-07
---

## Problem

A working publishing journey does not prove that the intended editor can use it or that content can be recovered after an upgrade or storage loss.

## Smallest Useful Version

Complete and record the first blog release's staging usability and recovery checks. Resolve unacceptable Persian editing behavior and make production smoke checks detect unavailable CMS content and editing dependencies.

## Acceptance Criteria

- [ ] Identify the intended editor and have them write Persian text, upload and place an image, preview, publish, revise, and unpublish using appropriate content accounts on staging.
- [ ] Record the actual editor trial and resolve any unacceptable untranslated UI or RTL formatting before production publishing is enabled. Automated tests alone do not complete this criterion.
- [x] Rehearse web-container replacement with representative content and media and verify that saved drafts, published articles, and images survive.
- [x] Rehearse an EmDash upgrade on staging and verify editing, authenticated preview, public publication state, and media afterward. Record the tested versions and upgrade procedure.
- [x] Restore CMS content, media, and required encryption keys from backup into a staging recovery environment. Verify draft access, published output, images, and editor authentication after restoration.
- [x] Document backup, restore, upgrade, migration, runtime-secret, and CMS health procedures with the evidence from these rehearsals.
- [x] Production smoke checks detect unavailable CMS content and editing dependencies even when the static landing page remains healthy. Keep the existing landing-page and public Salon checks.

## Notes

- The release checks are required by [BL-0087](../now/BL-0087-publish-blog-and-product-guides-with-emdash.md) and [ADR-0040](../../docs/adr/0040-emdash-for-public-content.md).
- Coordinate the editor trial when implementing this task; do not invent an editor or claim completion without their participation. Staging access is also a rollout input.
- Production publishing waits for these checks. Preparing private drafts does not wait for this task. Three launch drafts, Product Guides, and Grok drafting have their own subtasks.

## Technical verification, 2026-10-07

Implementation `2291bef0edc22a4e913b3f3326cf8f3ab2e9d311` merged into
`codex/bl-0087-emdash-blog-and-guides` at
`817c485131b9005e49f0b609cac0fb327cc2240b`.

Actual native browser and public HTTP rehearsals verified container replacement,
a quiesced database/media/key backup, an isolated aligned EmDash/core auth 1.2.0
upgrade, and a fresh 1.1.0 restore. Each phase checked saved Persian drafts, live
versus staged content, fresh technical operator/Editor passkey authentication,
session-gated signed previews, anonymous denial, exact decoded cover/inline
image bytes and discovery. The isolated 1.2 candidate retained compatible
CodeMirror 6.12.4 after its initially resolved 6.13.0 dependency failed to build.
The repository remains pinned at 1.1.0. The restore helper also refused occupied
media storage without overwriting a sentinel or FIFO.

The recovered copy stays at `http://localhost:3301`, with private environment,
keys, backups, fixture passkeys, an unconsumed native Editor invitation and stable
run commands outside Git. [Deployment procedures](../../docs/EMDASH_DEPLOYMENT.md)
record reproducible versions, upgrades, recovery and runtime secrets. The
optional native public-page toolbar is disabled through supported configuration
after visual inspection found unstyled controls below the preview footer. Native
dashboard preview and publication remain available; Persian fields render
right-aligned. Native English menus remain for the user's usability judgment.

Independent merger verification passed 16 production CMS tests, 29 web tests,
lint/typecheck and the retained copy's fresh native authentication, Save/reopen,
preview privacy, media and discovery. Real database-outage and missing-editor-CSS
faults kept the landing page at 200 while the expanded smoke check reported
failure. Existing Salon smoke checks are preserved; the full Salon HTTP smoke
was not rerun because this isolated environment has no operational API on 3302.

The intended editor is the user. They requested their physical passkey
registration and hands-on Persian trial only after all implementation. Those
first two criteria remain unchecked, so this item stays ready-for-human rather
than done. Automated technical accounts do not substitute for participation.
Continue independent article, guide and Grok tickets meanwhile.
