---
id: BL-0103
title: Enable daily Grok drafting
status: ready
type: task
triage: ready-for-agent
priority: medium
size: medium
parent: BL-0087
blocked_by: [BL-0102]
created: 2026-10-06
updated: 2026-10-06
---

## Problem

The verified manual Grok workflow needs daily execution that cannot create duplicate drafts on retries or silently fail.

## Smallest Useful Version

Enable one daily Persian Blog Article drafting run using the Saluna writing skill and tested CMS identity, with durable run tracking, retry behavior, and failure reporting.

## Acceptance Criteria

- [ ] Choose the run time with the person responsible for content before enabling the routine, record it in `Asia/Tehran`, and verify that the configured schedule follows that timezone.
- [ ] A daily run creates one new Persian Blog Article draft using the writing skill, current product sources, overlap checks, required fields, and default byline.
- [ ] Tie retries to the same durable daily run identity. Repeated execution, overlapping attempts, and retries after a draft was saved but the completion response was lost do not create duplicate drafts.
- [ ] Report failed draft creation through the selected operational reporting mechanism, with enough run context to diagnose and retry it. A failed creation cannot be recorded as a successful daily delivery.
- [ ] Successful runs record the created draft and its authenticated preview link. Verify saved state rather than assuming a successful model response means the CMS draft exists.
- [ ] New daily runs progress despite earlier drafts remaining unreviewed or unpublished. The routine never publishes articles or schedules publication, including during retries and updates.
- [ ] Verify actual scheduled execution and meaningful checks for same-run retries, duplicate avoidance, independent progress, failure reporting, and draft-only output. Reconfirm the connection's current authentication and content/media permissions before enabling it.

## Notes

- This completes the recurring drafting criteria in [BL-0087](../now/BL-0087-publish-blog-and-product-guides-with-emdash.md). It is not required for the first blog release.
- Selecting the schedule is an implementation-time rollout input. Do not invent a run time while writing tickets.
- Review is optional. Publication remains a later explicit action outside this routine; a reviewer queue, publication cadence, and conversion attribution remain outside scope.
