---
id: BL-0101
title: Connect manager screens to Product Guides
status: ready
type: task
triage: ready-for-agent
priority: medium
size: small
parent: BL-0087
blocked_by: [BL-0100]
created: 2026-10-06
updated: 2026-10-06
---

## Problem

Managers should reach relevant instructions while performing a Saluna task, and the intended editor must prove they can maintain guides with screenshots and optional video.

## Smallest Useful Version

Link at least one relevant manager PWA screen to its accurate public Product Guide and complete the guide editor's staging trial.

## Acceptance Criteria

- [ ] At least one manager PWA screen has a clearly named link to a published Product Guide for that screen's current task.
- [ ] Following the link opens the correct public guide and its useful written steps without requiring a product login to read the guide itself.
- [ ] A browser journey verifies the manager-screen link and correct guide destination while preserving the screen's existing operational behavior.
- [ ] The intended nontechnical editor completes a staging guide journey covering Persian text, screenshot upload and placement, optional external video placement and transcript, preview, publication, revision, and withdrawal.
- [ ] Record the editor's actual trial and resolve unacceptable untranslated UI, RTL formatting, screenshot, or video-placement behavior before guide rollout.
- [ ] Confirm the linked guide matches the current manager screen and record product staff responsibility for maintaining its accuracy after UI changes.

## Notes

- This completes the manager-link and real-editor guide criteria in [BL-0087](../now/BL-0087-publish-blog-and-product-guides-with-emdash.md).
- Coordinate the intended editor and staging access during implementation. Automated tests do not substitute for the required hands-on trial.
