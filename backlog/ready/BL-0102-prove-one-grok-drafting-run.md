---
id: BL-0102
title: Prove one Grok drafting run
status: ready
type: task
triage: ready-for-agent
priority: medium
size: medium
parent: BL-0087
blocked_by: [BL-0098]
created: 2026-10-06
updated: 2026-10-06
---

## Problem

A recurring Grok job needs a tested writing contract and CMS connection before it can produce useful Saluna drafts reliably.

## Smallest Useful Version

Create a Saluna writing skill and use it in one manually triggered Grok drafting run. The run checks current product sources and existing content, creates an unpublished Persian article, and returns its authenticated preview link.

## Acceptance Criteria

- [ ] A reusable Saluna writing skill names prospective Salon Owners as the audience and records allowed salon-management subjects, including Staff Commission, AppointmentRequest handling, Client records, and staff scheduling.
- [ ] The skill specifies current product sources, required article fields, default `تیم سالونا` credit, optional-image behavior, relevant signup links, and draft-only delivery. Product terminology follows the root glossary.
- [ ] The skill requires checking existing published articles and drafts for topic overlap and validating product claims against current behavior. Existing unreviewed or unpublished drafts do not prevent a new distinct draft.
- [ ] Configure the actual Grok connection to the supported EmDash MCP or remote CLI using a dedicated identity with minimum supported content/media access. Recheck version-specific authentication and permissions rather than assuming the earlier agent proof is sufficient.
- [ ] One manual Grok run creates a complete Persian draft, successfully revises it, exercises required media operations, and returns a working authenticated preview link.
- [ ] Create and update operations explicitly preserve draft state. The run does not request publication or schedule it; its article remains absent from public output and discovery.
- [ ] Record the manual run result and connection setup without committing credentials. No daily schedule is enabled by this task.

## Notes

- This is a later phase of [BL-0087](../now/BL-0087-publish-blog-and-product-guides-with-emdash.md).
- Neither Product Guides nor completion, review, or publication of the first three drafts blocks this work.
- Daily scheduling, duplicate avoidance on retries, and failure reporting follow in BL-0103. Publication remains a later explicit editor action.
