---
id: BL-0098
title: Enable agent Blog Article drafting
status: ready
type: task
triage: ready-for-agent
priority: medium
size: medium
parent: BL-0087
blocked_by: [BL-0094]
created: 2026-10-06
updated: 2026-10-06
---

## Problem

The initial article batch and later Grok workflow need a supported agent connection that can complete drafting and return usable private previews.

## Smallest Useful Version

Use the installed EmDash release's supported MCP or remote CLI with a dedicated CMS identity. Prove one complete agent drafting journey, including revision and required media operations, while leaving its output unpublished.

## Acceptance Criteria

- [ ] Select the supported MCP or remote CLI after verifying its authentication, scopes, role requirements, and content/media operations against the installed release.
- [ ] A dedicated identity has the minimum supported content/media access needed for drafting and cannot perform CMS administration or access Salon operational data.
- [ ] Through the chosen interface, an agent creates a Persian Blog Article draft with required fields, reads it back, revises it, uploads or registers required media, and attaches images.
- [ ] The agent returns an authenticated preview link that displays the saved draft in Saluna's article design. Anonymous requests cannot read the draft.
- [ ] Create and update operations explicitly keep content as draft. The drafting journey never requests publication or schedules it, and public pages and lists do not expose the delivered draft.
- [ ] Verify the real supported interface and identity with successful create, revision, preview, and media operations. Document connection setup and credential handling without committing credentials.

## Notes

- Follow the current agent contract in [BL-0087](BL-0087-publish-blog-and-product-guides-with-emdash.md). Scopes and roles need separate verification; role names alone are insufficient evidence.
- A mandatory reviewer and custom publication-denial layer are outside scope. Draft-only behavior belongs to the drafting job's operations and deliverable.
- This connection supports both BL-0099 and BL-0102. It does not depend on publication of any initial article or on Product Guides.
