---
id: BL-0098
title: Enable agent Blog Article drafting
status: done
type: task
triage: ready-for-agent
priority: medium
size: medium
parent: BL-0087
blocked_by: [BL-0094]
created: 2026-10-06
updated: 2026-10-07
---

## Problem

The initial article batch and later Grok workflow need a supported agent connection that can complete drafting and return usable private previews.

## Smallest Useful Version

Use the installed EmDash release's supported MCP or remote CLI with a dedicated CMS identity. Prove one complete agent drafting journey, including revision and required media operations, while leaving its output unpublished.

## Acceptance Criteria

- [x] Select the supported MCP or remote CLI after verifying its authentication, scopes, role requirements, and content/media operations against the installed release.
- [x] A dedicated identity has the minimum supported content/media access needed for drafting and cannot perform CMS administration or access Salon operational data.
- [x] Through the chosen interface, an agent creates a Persian Blog Article draft with required fields, reads it back, revises it, uploads or registers required media, and attaches images.
- [x] The agent returns an authenticated preview link that displays the saved draft in Saluna's article design. Anonymous requests cannot read the draft.
- [x] Create and update operations explicitly keep content as draft. The drafting journey never requests publication or schedules it, and public pages and lists do not expose the delivered draft.
- [x] Verify the real supported interface and identity with successful create, revision, preview, and media operations. Document connection setup and credential handling without committing credentials.

## Notes

- Follow the current agent contract in [BL-0087](../now/BL-0087-publish-blog-and-product-guides-with-emdash.md). Scopes and roles need separate verification; role names alone are insufficient evidence.
- A mandatory reviewer and custom publication-denial layer are outside scope. Draft-only behavior belongs to the drafting job's operations and deliverable.
- This connection supports both BL-0099 and BL-0102. It does not depend on publication of any initial article or on Product Guides.

## Completion evidence, 2026-10-07

Implementation `0ea44779a44de8e02d6fbf7522fdccead09fb8a4` merged into
`codex/bl-0087-emdash-blog-and-guides` at
`e3c5300458c16b73781af61d771229e831c45760`.

The dedicated native Author account approved exactly the four content/media
read/write OAuth scopes. Supported MCP created, read and revised a Persian
unscheduled draft, uploaded and read media, and attached cover and inline
images. The native REST preview adjunct returned a signed URL that rendered
with actual Author and Editor CMS sessions; anonymous and Bearer-only copies
returned 403. The draft stayed absent from public detail, index and sitemap.
Anonymous requests decoded the uploaded image and matched its original bytes.

Independent verification passed seven browser milestones, five real client
checks, 29 web tests, formatting, syntax and whitespace checks. Native tests
proved lower-role and omitted-scope denials, administration denial, token
refresh with revoked old access, stale-revision conflicts, and refusal to
withdraw an existing published article. The real Saluna API and Better Auth,
using a disposable migrated database, rejected the CMS token with 401 for
clients, appointments and business settings. The database was removed.

The reusable client reads saved state after writes, guards ownership and plain
draft state, uses native revisions, and keeps credentials and private results
outside Git. It does not add publication restrictions to the native role.
Setup and credential handling are in [EMDASH_AGENT.md](../../docs/EMDASH_AGENT.md).
The retained Mac CMS is healthy on localhost:3301; the human Editor invitation
is unconsumed. The user's final trial and actual Grok connection are separate
pending tasks. No production deployment or article publication occurred.
