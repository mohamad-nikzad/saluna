---
id: BL-0102
title: Prove one Grok drafting run
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

A recurring Grok job needs a tested writing contract and CMS connection before it can produce useful Saluna drafts reliably.

## Smallest Useful Version

Create a Saluna writing skill and use it in one manually triggered Grok drafting run. The run checks current product sources and existing content, creates an unpublished Persian article, and returns its authenticated preview link.

## Acceptance Criteria

- [x] A reusable Saluna writing skill names prospective Salon Owners as the audience and records allowed salon-management subjects, including Staff Commission, AppointmentRequest handling, Client records, and staff scheduling.
- [x] The skill specifies current product sources, required article fields, default `تیم سالونا` credit, optional-image behavior, relevant signup links, and draft-only delivery. Product terminology follows the root glossary.
- [x] The skill requires checking existing published articles and drafts for topic overlap and validating product claims against current behavior. Existing unreviewed or unpublished drafts do not prevent a new distinct draft.
- [x] Configure the actual Grok connection to the supported EmDash MCP or remote CLI using a dedicated identity with minimum supported content/media access. Recheck version-specific authentication and permissions rather than assuming the earlier agent proof is sufficient.
- [x] One manual Grok run creates a complete Persian draft, successfully revises it, exercises required media operations, and returns a working authenticated preview link.
- [x] Create and update operations explicitly preserve draft state. The run does not request publication or schedule it; its article remains absent from public output and discovery.
- [x] Record the manual run result and connection setup without committing credentials. No daily schedule is enabled by this task.

## Notes

- This is a later phase of [BL-0087](../now/BL-0087-publish-blog-and-product-guides-with-emdash.md).
- Neither Product Guides nor completion, review, or publication of the first three drafts blocks this work.
- Daily scheduling, duplicate avoidance on retries, and failure reporting follow in BL-0103. Publication remains a later explicit editor action.

## Verification, 2026-10-08

Implementation `7f5322403b4668d8b97c32ded2761c087e56530b` was independently merged and verified at `b1c00c805c8a8b4c37ee4d8e0a7f4732dafedb32`. The existing Saluna Content Studio account saved the reusable writing skill in its private library, read current product sources and paginated overlap inventory, and created the distinct staff-scheduling article recorded in [delivery.json](../../content/blog-writing/delivery.json). Studio revised the same saved ID and uploaded/read a branded illustration for cover and inline use. It corrected one source wording issue on the same ID and returned a fresh native preview. The article remains an owned, unpublished, unscheduled draft.

Independent checks confirmed the original ID, revision3, all36 saved rich-text blocks, reviewed fields and thirteen current source hashes. Native Author30 identity and exactly four content/media scopes passed; administration/profile requests returned403 and real Saluna API/Better Auth denied Client, Appointment and business-settings access with401. Actual native Author/session preview returned200 with private/no-store/noindex, both images decoded and matched the original bytes, copied or Bearer-only previews returned403, public detail returned404 and discovery excluded the draft. Editor40 reopened its saved fields and media. The original three launch drafts are preserved. Two native wrapper checks and targeted lint, syntax, formatting and whitespace checks passed.

The user personally approved the first Mac command. Current Grok Mac execution displays Always allow, while automatic review remains on, other-computer access denied, traffic routing off and custom rules empty. No agent changed those security settings. This manual run used the user's existing choice; scheduled execution remains BL-0103 work. Credentials, passkeys and signed links stay in protected files outside Git. The stable private wrapper now uses the integration checkout.

The local CMS was safely resumed after Docker stopped during a pause, without replacing or deleting its data. Native English interface judgment and the intended editor's physical trials remain pending at the end. No daily routine or production publication was enabled by this task. See [the writing skill](../../.agents/skills/saluna-writing/SKILL.md) and [connection guide](../../docs/EMDASH_GROK.md).
